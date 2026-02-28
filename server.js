const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
// 配置 CORS：允许前端域名（Netlify）访问
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://*.netlify.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // 允许无 Origin 的请求（如 curl、Postman）和本地开发
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // 生产环境中如果需要更严格，可以在这里返回错误
      // 目前为了调试方便，允许所有来源
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `uploads/${req.params.kbId}`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '_' + originalName);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// 数据文件路径
const DATA_DIR = './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const KB_FILE = path.join(DATA_DIR, 'knowledge_bases.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const CONTENT_DIR = path.join(DATA_DIR, 'contents'); // 存储提取的文本内容

// 初始化数据文件
function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([
      { id: uuidv4(), username: 'admin', password: 'admin123', role: 'admin', avatar: '管理', email: 'admin@aica.com', createdAt: new Date().toISOString() },
      { id: uuidv4(), username: '李明', password: '123456', role: 'user', avatar: '李', email: 'liming@aica.com', department: '人力资源部', createdAt: new Date().toISOString() }
    ], null, 2));
  }
  if (!fs.existsSync(KB_FILE)) {
    fs.writeFileSync(KB_FILE, JSON.stringify([
      { id: 'kb1', name: '公司政策', description: '包含人力资源、报销法程等核心文档…', icon: '📄', color: '#4F46E5', fileCount: 15, updatedAt: '2小时前', files: [] },
      {
        id: 'kb2', name: '产品常见问题', description: '汇总用户最常问的42个产品操作问题…', icon: '❓', color: '#3B82F6', fileCount: 42, updatedAt: '5小时前', files: [
          { id: 'f1', name: '2024产品更新路线图.pdf', size: '2.4 MB', uploadedAt: '10分钟前', status: 'synced' },
          { id: 'f2', name: '常见登录问题解决指南.docx', size: '842 KB', uploadedAt: '1小时前', status: 'synced' },
          { id: 'f3', name: 'API接口集成文档.txt', size: '156 KB', uploadedAt: '天天', status: 'synced' }
        ]
      },
      { id: 'kb3', name: '员工手册', description: '关于公司文化、价值观及日常行为准则…', icon: '📗', color: '#F59E0B', fileCount: 8, updatedAt: '1天前', files: [] },
      { id: 'kb4', name: '售后流程', description: '标准化的售后处理逻辑与退换货政策…', icon: '🔧', color: '#10B981', fileCount: 20, updatedAt: '3天前', files: [] }
    ], null, 2));
  }
  if (!fs.existsSync(CHATS_FILE)) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify([
      {
        id: 'c1', userId: '李明', title: '关于公司带薪休假政策', pinned: true, createdAt: new Date().toISOString(),
        messages: [
          { id: 'm1', role: 'assistant', content: '您好！我是您的智能助理。有什么我可以帮您的吗？您可以询问关于公司政策、报销、福利等方面的问题。', createdAt: '09:41' },
          { id: 'm2', role: 'user', content: '我想了解公司的休假政策，尤其是年假的规定。', createdAt: '09:42' },
          { id: 'm3', role: 'assistant', content: '根据公司的休假政策，正式员工享有的年假安排如下：\n\n• 入职满1年不满10年的员工，每年享有 **5天** 带薪年假。\n• 入职满10年不满20年的员工，每年享有 **10天** 带薪年假。\n• 入职满20年的员工，每年享有 **15天** 带薪年假。\n\n年假申请须提前5个工作日在OA系统提交，并经部门负责人批准。', createdAt: '09:42', source: { name: '公司员工手册 - 福利章节', updatedAt: '2023年8月15日' } }
        ]
      },
      { id: 'c2', userId: '李明', title: '报销流程咨询', pinned: false, createdAt: new Date(Date.now() - 7200000).toISOString(), messages: [] },
      { id: 'c3', userId: '李明', title: 'IT设备申领指南', pinned: false, createdAt: new Date(Date.now() - 86400000).toISOString(), messages: [] },
      { id: 'c4', userId: '李明', title: '如何使用公积金贷款', pinned: false, createdAt: '2023-10-24', messages: [] }
    ], null, 2));
  }
}

initData();

// 读写数据工具
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ===== 文本提取函数 =====
async function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  let text = '';

  try {
    if (ext === '.pdf') {
      // 动态 require，避免启动时报错
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text || '';
      console.log(`[PDF] 提取 ${originalName} 成功，字符数: ${text.length}`);
    } else if (ext === '.txt' || ext === '.md') {
      text = fs.readFileSync(filePath, 'utf8');
    } else if (ext === '.docx' || ext === '.doc') {
      // DOCX 提取（简单读取 XML，无需额外依赖）
      try {
        // 尝试读取 docx 内부文本（zip 格式）
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(filePath);
        const entry = zip.getEntry('word/document.xml');
        if (entry) {
          const xml = entry.getData().toString('utf8');
          // 去除 XML 标签提取纯文本
          text = xml
            .replace(/<w:br[^>]*\/>/g, '\n')
            .replace(/<w:p[ >]/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
        }
      } catch (e) {
        // 如果没有 adm-zip，使用文件名提示
        text = `[Word文档 ${originalName}：内容已上传，请确保安装 adm-zip 解析库以获取完整文本]`;
      }
    }
  } catch (err) {
    console.error(`[提取文本失败] ${originalName}:`, err.message);
    text = '';
  }

  // 清理文本：移除多余空白，限制长度
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

// 保存文件内容到本地
function saveFileContent(fileId, content) {
  const contentPath = path.join(CONTENT_DIR, `${fileId}.txt`);
  fs.writeFileSync(contentPath, content, 'utf8');
}

// 读取文件内容
function loadFileContent(fileId) {
  const contentPath = path.join(CONTENT_DIR, `${fileId}.txt`);
  if (fs.existsSync(contentPath)) {
    return fs.readFileSync(contentPath, 'utf8');
  }
  return '';
}

// 从所有知识库中检索相关内容（简单关键词匹配）
function retrieveRelevantContent(userQuery, kbs, maxChars = 3000) {
  const results = [];

  for (const kb of kbs) {
    for (const file of (kb.files || [])) {
      if (file.status !== 'synced') continue;
      const content = loadFileContent(file.id);
      if (!content) continue;

      // 简单相关性评分：统计用户问题关键词在文档中的出现次数
      const queryWords = userQuery.replace(/[，。！？,.?!]/g, ' ').split(/\s+/).filter(w => w.length > 1);
      let score = 0;
      for (const word of queryWords) {
        const regex = new RegExp(word, 'gi');
        const matches = content.match(regex);
        if (matches) score += matches.length;
      }

      if (score > 0 || content.length > 0) {
        results.push({ kb, file, content, score });
      }
    }
  }

  // 按相关性排序
  results.sort((a, b) => b.score - a.score);

  // 提取最相关的内容片段
  let contextText = '';
  let sourceKB = null;

  for (const r of results) {
    if (contextText.length >= maxChars) break;

    const remaining = maxChars - contextText.length;
    let snippet = r.content;

    // 如果文档很长，尝试找到最相关的段落
    if (snippet.length > 1500) {
      const queryWords = userQuery.replace(/[，。！？,.?!]/g, ' ').split(/\s+/).filter(w => w.length > 1);
      // 找到包含关键词的段落
      const paragraphs = snippet.split(/\n+/).filter(p => p.trim().length > 20);
      const relevantParas = paragraphs
        .map(p => {
          let s = 0;
          for (const w of queryWords) {
            if (p.toLowerCase().includes(w.toLowerCase())) s++;
          }
          return { p, s };
        })
        .filter(x => x.s > 0 || queryWords.length === 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 5)
        .map(x => x.p)
        .join('\n');

      snippet = relevantParas || snippet.slice(0, 1500);
    }

    snippet = snippet.slice(0, remaining);
    contextText += `\n\n📄 来源文件：${r.file.name}（知识库：${r.kb.name}）\n${snippet}`;

    if (!sourceKB && r.score > 0) {
      sourceKB = { name: r.kb.name + ' - ' + r.file.name, updatedAt: r.file.uploadedAt || r.kb.updatedAt };
    }
  }

  // 如果没有找到任何内容，返回知识库名称作为上下文
  if (!contextText) {
    const kbNames = kbs.map(k => `「${k.name}」(${k.description})`).join('、');
    contextText = `当前知识库包含：${kbNames}。注意：这些知识库中的文件尚未提取到文本内容，或用户上传的文件未包含索引内容。`;
  }

  return { contextText, sourceKB };
}

// ===== 用户认证 API =====
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token: 'token_' + user.id });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, email } = req.body;
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  const newUser = {
    id: uuidv4(), username, password, email: email || '',
    role: 'user', avatar: username.charAt(0),
    department: '未分配', createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeJSON(USERS_FILE, users);
  const { password: _, ...safeUser } = newUser;
  res.json({ user: safeUser, token: 'token_' + newUser.id });
});

// ===== 知识库 API =====
app.get('/api/knowledge-bases', (req, res) => {
  res.json(readJSON(KB_FILE));
});

app.post('/api/knowledge-bases', (req, res) => {
  const { name, description } = req.body;
  const kbs = readJSON(KB_FILE);
  const icons = ['📄', '❓', '📗', '🔧', '📊', '🎯', '💡', '📋'];
  const colors = ['#4F46E5', '#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'];
  const newKB = {
    id: 'kb_' + uuidv4().slice(0, 8),
    name, description: description || '',
    icon: icons[Math.floor(Math.random() * icons.length)],
    color: colors[Math.floor(Math.random() * colors.length)],
    fileCount: 0, updatedAt: '刚刚', files: []
  };
  kbs.push(newKB);
  writeJSON(KB_FILE, kbs);
  res.json(newKB);
});

app.get('/api/knowledge-bases/:kbId', (req, res) => {
  const kbs = readJSON(KB_FILE);
  const kb = kbs.find(k => k.id === req.params.kbId);
  if (!kb) return res.status(404).json({ error: '知识库不存在' });
  res.json(kb);
});

// 上传文件并提取文本
app.post('/api/knowledge-bases/:kbId/upload', upload.array('files'), async (req, res) => {
  const kbs = readJSON(KB_FILE);
  const kb = kbs.find(k => k.id === req.params.kbId);
  if (!kb) return res.status(404).json({ error: '知识库不存在' });

  const newFiles = req.files.map(f => {
    const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
    return {
      id: 'f_' + uuidv4().slice(0, 8),
      name: originalName,
      size: formatFileSize(f.size),
      uploadedAt: '刚刚',
      status: 'indexing',
      path: f.path
    };
  });

  kb.files = [...(kb.files || []), ...newFiles];
  kb.fileCount = kb.files.length;
  kb.updatedAt = '刚刚';
  writeJSON(KB_FILE, kbs);

  // 立即响应，然后在后台提取文本内容
  res.json({ files: newFiles });

  // 后台异步提取文本内容
  for (const fileInfo of newFiles) {
    const uploadedFile = req.files.find(f => {
      const oName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      return oName === fileInfo.name;
    });
    if (!uploadedFile) continue;

    try {
      console.log(`[索引] 正在提取文本内容：${fileInfo.name}`);
      const text = await extractTextFromFile(uploadedFile.path, fileInfo.name);
      if (text) {
        saveFileContent(fileInfo.id, text);
        console.log(`[索引] ${fileInfo.name} 提取完成，${text.length} 字符`);
      } else {
        console.log(`[索引] ${fileInfo.name} 未提取到文本内容`);
        saveFileContent(fileInfo.id, `[文件 ${fileInfo.name} 已上传，文本提取结果为空]`);
      }
    } catch (err) {
      console.error(`[索引] ${fileInfo.name} 提取失败:`, err.message);
      saveFileContent(fileInfo.id, `[文件 ${fileInfo.name} 文本提取失败: ${err.message}]`);
    }

    // 更新文件状态为 synced
    const kbs2 = readJSON(KB_FILE);
    const kb2 = kbs2.find(k => k.id === req.params.kbId);
    if (kb2) {
      const f = kb2.files.find(f => f.id === fileInfo.id);
      if (f) f.status = 'synced';
      writeJSON(KB_FILE, kbs2);
    }
  }
});

// 获取文件内容预览（调试用）
app.get('/api/knowledge-bases/:kbId/files/:fileId/content', (req, res) => {
  const content = loadFileContent(req.params.fileId);
  res.json({ content: content.slice(0, 2000), length: content.length });
});

app.delete('/api/knowledge-bases/:kbId/files/:fileId', (req, res) => {
  const kbs = readJSON(KB_FILE);
  const kb = kbs.find(k => k.id === req.params.kbId);
  if (!kb) return res.status(404).json({ error: '知识库不存在' });
  kb.files = kb.files.filter(f => f.id !== req.params.fileId);
  kb.fileCount = kb.files.length;
  writeJSON(KB_FILE, kbs);
  // 删除内容文件
  const contentPath = path.join(CONTENT_DIR, `${req.params.fileId}.txt`);
  if (fs.existsSync(contentPath)) fs.unlinkSync(contentPath);
  res.json({ success: true });
});

// ===== 聊天 API =====
app.get('/api/chats', (req, res) => {
  const chats = readJSON(CHATS_FILE);
  res.json(chats.map(c => ({ ...c, messages: undefined, messageCount: c.messages.length })));
});

app.post('/api/chats', (req, res) => {
  const chats = readJSON(CHATS_FILE);
  const newChat = {
    id: 'c_' + uuidv4().slice(0, 8), userId: '李明',
    title: '新对话', pinned: false,
    createdAt: new Date().toISOString(), messages: []
  };
  chats.unshift(newChat);
  writeJSON(CHATS_FILE, chats);
  res.json(newChat);
});

app.get('/api/chats/:chatId', (req, res) => {
  const chats = readJSON(CHATS_FILE);
  const chat = chats.find(c => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: '对话不存在' });
  res.json(chat);
});

// AI 对话（流式），含文档内容 RAG
app.post('/api/chats/:chatId/messages', async (req, res) => {
  const { content } = req.body;
  const chats = readJSON(CHATS_FILE);
  const chat = chats.find(c => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: '对话不存在' });

  // 保存用户消息
  const userMsg = { id: 'm_' + uuidv4().slice(0, 8), role: 'user', content, createdAt: formatTime() };
  chat.messages.push(userMsg);

  // 更新对话标题
  if (chat.messages.filter(m => m.role === 'user').length === 1) {
    chat.title = content.slice(0, 20) + (content.length > 20 ? '…' : '');
  }

  // 设置流式响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // ===== 核心：从知识库提取相关内容 =====
  const kbs = readJSON(KB_FILE);
  const { contextText, sourceKB: retrievedSource } = retrieveRelevantContent(content, kbs);

  // 输出到控制台，便于调试
  console.log(`[RAG] 用户问题: "${content}"`);
  console.log(`[RAG] 找到上下文长度: ${contextText.length} 字符`);

  // 构建历史消息
  const historyMessages = chat.messages.slice(-6, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  const systemPrompt = `你是一个企业智能客服助手，名叫"智谱AI助手"。

以下是从知识库中检索到的相关文档内容，请优先基于这些内容来回答用户问题：

=====知识库文档内容=====
${contextText}
======================

回答规则：
1. **优先使用**上方文档中的实际内容回答，尽量引用原文中的关键数据和信息
2. 使用 **加粗** 标注关键信息
3. 如果文档中有相关内容，在回答末尾用【来源：文件名或知识库名】标注
4. 如果文档内容不足以完整回答，可以补充通用知识，但要说明哪些是文档内容，哪些是补充
5. 语言简洁专业，可使用分点列举
6. 如果完全没有相关内容，诚实说明`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content }
  ];

  // 调用智谱 AI GLM-4-Flash 流式接口
  const requestData = JSON.stringify({
    model: 'glm-4-flash',
    messages,
    stream: true,
    temperature: 0.5,
    max_tokens: 2000
  });

  // API Key 优先从 Render 环境变量读取
  const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || '6eb4b8d348a84b9488aad8c7e3952baa.qEW8uP0etsZyKDKL';

  const options = {
    hostname: 'open.bigmodel.cn',
    path: '/api/paas/v4/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ZHIPU_API_KEY}`,
      'Content-Length': Buffer.byteLength(requestData)
    }
  };

  let fullContent = '';
  let finalSource = retrievedSource;

  const apiReq = https.request(options, (apiRes) => {
    apiRes.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      lines.forEach(line => {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
            }
          } catch (e) { }
        }
      });
    });

    apiRes.on('end', () => {
      // 提取 AI 在回答中主动标注的来源
      const sourceMatch = fullContent.match(/【来源：([^】]+)】/);
      if (sourceMatch) {
        const sourceName = sourceMatch[1];
        // 优先用 AI 自己标注的来源
        const matchedKB = kbs.find(k => k.name.includes(sourceName) || sourceName.includes(k.name));
        finalSource = matchedKB
          ? { name: matchedKB.name, updatedAt: matchedKB.updatedAt }
          : { name: sourceName, updatedAt: '刚刚更新' };
        fullContent = fullContent.replace(/【来源：[^】]+】/g, '').trim();
      }

      // 保存 AI 回复
      const assistantMsg = {
        id: 'm_' + uuidv4().slice(0, 8),
        role: 'assistant',
        content: fullContent,
        createdAt: formatTime(),
        source: finalSource
      };
      chat.messages.push(assistantMsg);
      writeJSON(CHATS_FILE, chats);

      res.write(`data: ${JSON.stringify({ type: 'done', source: finalSource, messageId: assistantMsg.id })}\n\n`);
      res.end();
    });
  });

  apiReq.on('error', (err) => {
    console.error('API Error:', err);
    const errorMsg = { id: 'm_' + uuidv4().slice(0, 8), role: 'assistant', content: '抱歉，服务暂时不可用，请稍后重试。', createdAt: formatTime() };
    chat.messages.push(errorMsg);
    writeJSON(CHATS_FILE, chats);
    res.write(`data: ${JSON.stringify({ type: 'error', content: '抱歉，服务暂时不可用，请稍后重试。' })}\n\n`);
    res.end();
  });

  apiReq.write(requestData);
  apiReq.end();
});

// 工具函数
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 智能客服平台运行在 http://localhost:${PORT}`);
  console.log(`📚 文档内容目录: ${path.resolve(CONTENT_DIR)}`);
});
