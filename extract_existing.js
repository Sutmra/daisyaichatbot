// 对已存在但未提取文本的文件补充提取
// 运行方式：node extract_existing.js

const path = require('path');
const fs = require('fs');

const DATA_DIR = './data';
const KB_FILE = path.join(DATA_DIR, 'knowledge_bases.json');
const CONTENT_DIR = path.join(DATA_DIR, 'contents');

if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

async function extractTextFromFile(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    let text = '';
    try {
        if (ext === '.pdf') {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            text = pdfData.text || '';
        } else if (ext === '.txt' || ext === '.md') {
            text = fs.readFileSync(filePath, 'utf8');
        }
    } catch (err) {
        console.error(`提取失败 ${originalName}:`, err.message);
    }
    return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function main() {
    const kbs = JSON.parse(fs.readFileSync(KB_FILE, 'utf8'));

    for (const kb of kbs) {
        for (const file of (kb.files || [])) {
            const contentPath = path.join(CONTENT_DIR, `${file.id}.txt`);
            const alreadyExtracted = fs.existsSync(contentPath) && fs.statSync(contentPath).size > 10;

            if (alreadyExtracted) {
                console.log(`✅ 已存在: ${file.name} (${fs.statSync(contentPath).size} 字节)`);
                continue;
            }

            if (!file.path || !fs.existsSync(file.path)) {
                console.log(`⚠️  文件不存在: ${file.name} (path: ${file.path})`);
                continue;
            }

            console.log(`📄 正在提取: ${file.name} ...`);
            const text = await extractTextFromFile(file.path, file.name);
            if (text && text.length > 0) {
                fs.writeFileSync(contentPath, text, 'utf8');
                console.log(`✅ 成功提取 ${file.name}: ${text.length} 字符`);
                console.log(`   前200字符预览: ${text.slice(0, 200).replace(/\n/g, ' ')}`);
            } else {
                console.log(`❌ ${file.name} 提取结果为空`);
            }
        }
    }
    console.log('\n提取完成！');
}

main().catch(console.error);
