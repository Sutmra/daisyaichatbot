// 用户端 AI 对话 JS
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'https://daisyaichatbot001.onrender.com';

// 权限检查（允许未登录访问，使用默认用户）
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
if (!currentUser) {
    currentUser = { username: '访客', avatar: '访', department: '' };
}

// 初始化用户信息
document.getElementById('chatUserName').textContent = currentUser.username;
document.getElementById('chatUserDept').textContent = currentUser.department || '';
document.getElementById('chatUserAvatar').textContent = currentUser.avatar || currentUser.username.charAt(0);

let currentChatId = null;
let isLoading = false;

// Toast
function showToast(msg, duration = 2500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
}

// 退出登录
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/index.html';
}

// 退出登录
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/index.html';
}

// 转到管理后台
function goToAdmin() {
    if (currentUser.role === 'admin') {
        window.location.href = '/admin.html';
    } else {
        showToast('需要管理员权限');
    }
}

// 加载历史对话列表
async function loadChatHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/chats`);
        const chats = await res.json();
        renderChatHistory(chats);
        // 默认加载第一个对话
        if (chats.length > 0 && !currentChatId) {
            loadChat(chats[0].id);
        }
    } catch (e) { console.error(e); }
}

// 渲染历史对话列表
function renderChatHistory(chats) {
    const list = document.getElementById('chatHistoryList');
    const now = Date.now();
    list.innerHTML = chats.map(c => {
        const isActive = c.id === currentChatId;
        const timeStr = formatRelativeTime(c.createdAt);
        const isPinned = c.pinned;
        return `
      <div class="history-item ${isActive ? 'active' : ''}" onclick="loadChat('${c.id}')" id="history-${c.id}">
        <div class="history-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            ${isPinned
                ? '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
                : '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
            }
          </svg>
        </div>
        <div>
          <div class="history-title">${c.title}</div>
          <div class="history-time">${timeStr}</div>
        </div>
      </div>
    `;
    }).join('');
}

// 格式化相对时间
function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    // 支持 "2小时前"、"天天" 等已格式化的字符串
    if (!/^\d{4}/.test(dateStr)) return dateStr;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const diff = Date.now() - date.getTime();
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return date.toLocaleDateString('zh-CN');
}

// 加载对话内容
async function loadChat(chatId) {
    currentChatId = chatId;

    // 更新侧边栏选中状态
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`history-${chatId}`);
    if (activeEl) activeEl.classList.add('active');

    try {
        const res = await fetch(`${API_BASE}/api/chats/${chatId}`);
        const chat = await res.json();

        // 更新标题
        document.getElementById('chatTitle').textContent = chat.title || '新对话';

        // 显示/隐藏欢迎状态
        const welcomeState = document.getElementById('welcomeState');
        const messagesList = document.getElementById('messagesList');
        const quickActions = document.getElementById('quickActions');
        const kbBadge = document.getElementById('kbBadge');

        if (chat.messages && chat.messages.length > 0) {
            welcomeState.style.display = 'none';
            kbBadge.style.display = 'block';
            quickActions.style.display = 'flex';
            renderMessages(chat.messages);
            scrollToBottom();
        } else {
            welcomeState.style.display = 'block';
            messagesList.innerHTML = '';
            kbBadge.style.display = 'none';
            quickActions.style.display = 'none';
        }
    } catch (e) {
        console.error(e);
    }
}

// 渲染所有消息
function renderMessages(messages) {
    const list = document.getElementById('messagesList');
    list.innerHTML = messages.map(msg => renderMessageHTML(msg)).join('');
}

// 渲染单条消息 HTML
function renderMessageHTML(msg, streaming = false) {
    const isAI = msg.role === 'assistant';
    const timeStr = msg.createdAt || '';
    const content = formatMessageContent(msg.content);

    let sourceHTML = '';
    if (isAI && msg.source) {
        sourceHTML = `
      <div class="source-card">
        <div class="source-info">
          <div class="source-icon">📄</div>
          <div>
            <div class="source-name">来源：${msg.source.name}</div>
            <div class="source-updated">最后更新于 ${msg.source.updatedAt}</div>
          </div>
        </div>
        <button class="source-link">查看原文</button>
      </div>
    `;
    }

    let actionsHTML = '';
    if (isAI && !streaming) {
        actionsHTML = `
      <div class="msg-actions">
        <button class="msg-action" onclick="toggleLike(this, 'like')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          有用
        </button>
        <button class="msg-action" onclick="toggleLike(this, 'dislike')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
          无用
        </button>
        <button class="msg-action" onclick="copyMsg(this, '${msg.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          复制
        </button>
      </div>
    `;
    }

    if (isAI) {
        return `
      <div class="msg-row" id="msg-${msg.id}">
        <div class="msg-avatar ai">
          <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="10" r="2.5" fill="white" opacity="0.9"/><circle cx="15" cy="10" r="2.5" fill="white" opacity="0.9"/>
            <circle cx="9" cy="10" r="1" fill="#3b4ef8"/><circle cx="15" cy="10" r="1" fill="#3b4ef8"/>
            <rect x="7" y="15" width="10" height="2.5" rx="1.2" fill="white" opacity="0.7"/>
          </svg>
        </div>
        <div class="msg-content-wrap">
          <div><span class="msg-name">智谱 AI 助手</span><span class="msg-time">${timeStr}</span></div>
          <div class="msg-bubble ai" id="bubble-${msg.id}">${content}${streaming ? '<span class="cursor"></span>' : ''}</div>
          ${sourceHTML}
          ${actionsHTML}
        </div>
      </div>
    `;
    } else {
        return `
      <div class="msg-row user" id="msg-${msg.id}">
        <div class="msg-avatar user-av">${currentUser.avatar || currentUser.username.charAt(0)}</div>
        <div class="msg-content-wrap">
          <div><span class="msg-time">${timeStr}</span><span class="msg-name">我</span></div>
          <div class="msg-bubble user">${content}</div>
        </div>
      </div>
    `;
    }
}

// 格式化消息内容（Markdown 简单解析）
function formatMessageContent(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/• (.+)/g, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n/g, '<br>');
}

// 滚动到底部
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// 创建新对话
async function createNewChat() {
    try {
        const res = await fetch(`${API_BASE}/api/chats`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const chat = await res.json();
        await loadChatHistory();
        await loadChat(chat.id);
    } catch (e) { showToast('创建失败，请重试'); }
}

// 快捷问题
function sendQuickQuestion(question) {
    const input = document.getElementById('messageInput');
    input.value = question;
    autoResize(input);
    updateSendBtn();
    sendMessage();
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || isLoading) return;

    // 如果没有对话，先创建
    if (!currentChatId) {
        await createNewChat();
        await new Promise(r => setTimeout(r, 300));
    }

    isLoading = true;
    input.value = '';
    autoResize(input);
    updateSendBtn();

    // 隐藏欢迎状态
    document.getElementById('welcomeState').style.display = 'none';
    document.getElementById('quickActions').style.display = 'flex';
    document.getElementById('kbBadge').style.display = 'block';

    const time = getCurrentTime();

    // 添加用户消息
    const userMsgId = 'user_' + Date.now();
    const userMsg = { id: userMsgId, role: 'user', content, createdAt: time };
    appendMessage(userMsg);

    // 添加 AI 打字占位
    const aiMsgId = 'ai_streaming_' + Date.now();
    const aiPlaceholder = { id: aiMsgId, role: 'assistant', content: '', createdAt: time };
    appendMessage(aiPlaceholder, true);

    const bubble = document.getElementById(`bubble-${aiMsgId}`);
    scrollToBottom();

    try {
        const response = await fetch(`${API_BASE}/api/chats/${currentChatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let lastSource = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n');

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'delta') {
                        fullContent += data.content;
                        bubble.innerHTML = formatMessageContent(fullContent) + '<span class="cursor"></span>';
                        scrollToBottom();
                    } else if (data.type === 'done') {
                        lastSource = data.source;
                    } else if (data.type === 'error') {
                        fullContent = data.content;
                    }
                } catch (e) { }
            }
        }

        // 完成：更新消息
        const finalMsg = { id: aiMsgId, role: 'assistant', content: fullContent, createdAt: time, source: lastSource };
        const msgRow = document.getElementById(`msg-${aiMsgId}`);
        if (msgRow) {
            msgRow.outerHTML = renderMessageHTML(finalMsg);
        }

        // 更新标题
        const titleEl = document.getElementById('chatTitle');
        if (titleEl.textContent === '新对话' || titleEl.textContent === '智谱 AI 助手') {
            titleEl.textContent = content.slice(0, 20) + (content.length > 20 ? '…' : '');
        }

        loadChatHistory();
        scrollToBottom();

    } catch (err) {
        const msgRow = document.getElementById(`msg-${aiMsgId}`);
        if (msgRow) {
            const errMsg = { id: aiMsgId, role: 'assistant', content: '抱歉，暂时无法回答，请稍后重试。', createdAt: time };
            msgRow.outerHTML = renderMessageHTML(errMsg);
        }
    } finally {
        isLoading = false;
        updateSendBtn();
    }
}

// 追加消息到列表
function appendMessage(msg, streaming = false) {
    const list = document.getElementById('messagesList');
    list.insertAdjacentHTML('beforeend', renderMessageHTML(msg, streaming));
}

// 键盘处理
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    updateSendBtn();
}

// 自动调整高度
function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    updateSendBtn();
}

// 更新发送按钮状态
function updateSendBtn() {
    const input = document.getElementById('messageInput');
    const btn = document.getElementById('sendBtn');
    btn.disabled = !input.value.trim() || isLoading;
}

// 获取当前时间
function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// 复制消息
function copyMsg(btn, msgId) {
    const bubble = document.getElementById(`bubble-${msgId}`);
    const text = bubble ? bubble.innerText : '';
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('active');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> 已复制`;
        setTimeout(() => {
            btn.classList.remove('active');
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 复制`;
        }, 2000);
    });
}

// 点赞/踩
function toggleLike(btn, type) {
    const parent = btn.parentElement;
    const buttons = parent.querySelectorAll('.msg-action');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showToast(type === 'like' ? '感谢您的反馈！' : '已记录，我们将改进回答质量');
}

// 监听输入
document.getElementById('messageInput').addEventListener('input', updateSendBtn);

// 初始化
loadChatHistory();
