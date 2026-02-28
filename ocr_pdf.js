// PDF 图片型内容识别脚本
// 使用 pdfjs-dist + canvas 将每页渲染为图片，再调用 GLM-4V 识别文字
// 运行：node ocr_pdf.js <pdf文件路径> <文件ID>

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = './data';
const CONTENT_DIR = path.join(DATA_DIR, 'contents');
if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

const pdfPath = process.argv[2];
const fileId = process.argv[3];
if (!pdfPath || !fileId) {
    console.error('用法: node ocr_pdf.js <pdf路径> <文件ID>');
    process.exit(1);
}

// 调用智谱 GLM-4V-Flash 接口识别图片文字
function callGLM4V(imageBase64, pageNum, totalPages) {
    return new Promise((resolve, reject) => {
        const requestData = JSON.stringify({
            model: 'glm-4v-flash',
            messages: [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
                    { type: 'text', text: `这是PPT文档第${pageNum}页（共${totalPages}页）。请提取这页所有文字内容，包括标题、正文、要点等，结构化输出。只输出内容本身。` }
                ]
            }],
            temperature: 0.1, max_tokens: 1500
        });

        const req = https.request({
            hostname: 'open.bigmodel.cn',
            path: '/api/paas/v4/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 6eb4b8d348a84b9488aad8c7e3952baa.qEW8uP0etsZyKDKL',
                'Content-Length': Buffer.byteLength(requestData)
            }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    resolve(data.choices?.[0]?.message?.content || '');
                } catch (e) {
                    reject(new Error('解析失败: ' + body.slice(0, 300)));
                }
            });
        });
        req.on('error', reject);
        req.write(requestData);
        req.end();
    });
}

async function main() {
    console.log(`📄 开始处理: ${pdfPath}`);

    // 使用 pdfjs-dist（mjs 格式，需要动态 import）
    let getDocument, GlobalWorkerOptions;
    try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        getDocument = pdfjs.getDocument;
        GlobalWorkerOptions = pdfjs.GlobalWorkerOptions;
    } catch (e) {
        const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
        getDocument = pdfjs.getDocument;
        GlobalWorkerOptions = pdfjs.GlobalWorkerOptions;
    }

    // 设置 worker 路径（使用 worker 的 mjs 文件）
    const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
    if (fs.existsSync(workerPath)) {
        GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
    } else {
        const workerPath2 = path.resolve('node_modules/pdfjs-dist/build/pdf.worker.mjs');
        GlobalWorkerOptions.workerSrc = `file://${workerPath2}`;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await getDocument({
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: true
    }).promise;
    const totalPages = pdfDoc.numPages;
    console.log(`📊 共 ${totalPages} 页`);

    const { createCanvas } = require('canvas');
    let allText = '';
    const maxPages = Math.min(totalPages, 15);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        console.log(`\n📖 处理第 ${pageNum}/${maxPages} 页...`);
        try {
            const page = await pdfDoc.getPage(pageNum);
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            context.fillStyle = 'white';
            context.fillRect(0, 0, viewport.width, viewport.height);

            await page.render({ canvasContext: context, viewport }).promise;

            const imageBase64 = canvas.toBuffer('image/png').toString('base64');
            console.log(`   图片大小: ${Math.round(imageBase64.length * 0.75 / 1024)} KB`);

            const pageText = await callGLM4V(imageBase64, pageNum, totalPages);
            console.log(`   ✅ 识别 ${pageText.length} 字符: ${pageText.slice(0, 80).replace(/\n/g, ' ')}`);

            allText += `\n===第${pageNum}页===\n${pageText}\n`;

            if (pageNum < maxPages) await new Promise(r => setTimeout(r, 500));

        } catch (err) {
            console.error(`   ❌ 第 ${pageNum} 页失败:`, err.message);
            allText += `\n===第${pageNum}页===\n[识别失败]\n`;
        }
    }

    // 保存内容
    const contentPath = path.join(CONTENT_DIR, `${fileId}.txt`);
    fs.writeFileSync(contentPath, allText.trim(), 'utf8');
    console.log(`\n✅ 完成！总字符数: ${allText.length}`);
    console.log(`💾 保存到: ${contentPath}`);

    // 更新知识库文件状态
    const KB_FILE = path.join(DATA_DIR, 'knowledge_bases.json');
    const kbs = JSON.parse(fs.readFileSync(KB_FILE, 'utf8'));
    for (const kb of kbs) {
        const f = (kb.files || []).find(f => f.id === fileId);
        if (f) { f.status = 'synced'; console.log(`✅ 文件状态已更新: ${f.name}`); }
    }
    fs.writeFileSync(KB_FILE, JSON.stringify(kbs, null, 2));
}

main().catch(err => {
    console.error('失败:', err.message);
    process.exit(1);
});
