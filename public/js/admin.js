// 后台知识库管理 JS
const API_BASE = localStorage.getItem('API_BASE') || '';

// 权限检查
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!user || user.role !== 'admin') {
    window.location.href = '/';
}

// 初始化用户信息
if (user) {
    document.getElementById('sidebarUsername').textContent = user.username;
    document.getElementById('sidebarEmail').textContent = user.email || 'admin@aica.com';
    document.getElementById('userAvatarText').textContent = user.avatar || user.username.charAt(0);
}

let allKBs = [];
let selectedKB = null;

// Toast
function showToast(msg, duration = 2500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
}

// 导航点击
function navClick(e, page) {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    e.currentTarget.classList.add('active');
    if (page !== 'knowledge') showToast('该功能即将开放');
}

// 退出登录
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
}

// 文件类型图标
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = { pdf: '📄', docx: '📝', doc: '📝', txt: '📋', md: '📋' };
    const classes = { pdf: 'pdf', docx: 'docx', doc: 'docx', txt: 'txt', md: 'md' };
    return { icon: icons[ext] || '📁', cls: classes[ext] || 'txt' };
}

// 加载知识库列表
async function loadKBs() {
    try {
        const res = await fetch(`${API_BASE}/api/knowledge-bases`);
        allKBs = await res.json();
        renderKBGrid(allKBs);
    } catch (err) {
        console.error(err);
        showToast('加载失败，请刷新重试');
    }
}

// 渲染知识库卡片
function renderKBGrid(kbs) {
    const grid = document.getElementById('kbGrid');
    grid.innerHTML = kbs.map(kb => `
    <div class="kb-card ${selectedKB && selectedKB.id === kb.id ? 'selected' : ''}" id="kb-card-${kb.id}" onclick="selectKB('${kb.id}')">
      <div class="kb-card-icon" style="background:${kb.color}20">${kb.icon}</div>
      <div class="kb-card-name">${kb.name}</div>
      <div class="kb-card-desc">${kb.description || '暂无描述'}</div>
      <div class="kb-card-meta">
        <span class="kb-card-count">${kb.fileCount} 个文档</span>
        <span class="kb-card-time">${kb.updatedAt}更新</span>
      </div>
    </div>
  `).join('');
}

// 过滤知识库
function filterKBs() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allKBs.filter(kb => kb.name.toLowerCase().includes(q) || (kb.description && kb.description.toLowerCase().includes(q)));
    renderKBGrid(filtered);
}

// 选择知识库
async function selectKB(kbId) {
    try {
        const res = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}`);
        if (!res.ok) throw new Error('API error ' + res.status);
        selectedKB = await res.json();

        // 更新卡片选中状态（通过 id 找到对应卡片）
        document.querySelectorAll('.kb-card').forEach(c => c.classList.remove('selected'));
        const card = document.getElementById(`kb-card-${kbId}`);
        if (card) card.classList.add('selected');

        // 更新面包屑
        document.getElementById('breadcrumbCurrent').textContent = selectedKB.name;

        // 显示详情区
        const detail = document.getElementById('kbDetail');
        detail.style.display = 'block';
        document.getElementById('detailTitle').textContent = `知识库详情: ${selectedKB.name}`;

        renderFileList(selectedKB.files || []);
        detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        console.error('selectKB error:', err);
        showToast('加载知识库详情失败：' + err.message);
    }
}

// 渲染文件列表
function renderFileList(files) {
    const fileList = document.getElementById('fileList');
    const fileListHeader = document.getElementById('fileListHeader');
    const fileCount = document.getElementById('fileCount');

    fileCount.textContent = files.length;

    if (files.length > 0) {
        fileListHeader.style.display = 'flex';
        fileList.innerHTML = files.map(f => {
            const { icon, cls } = getFileIcon(f.name);
            const isIndexing = f.status === 'indexing';
            return `
        <div class="file-item" id="file-${f.id}">
          <div class="file-type-icon ${cls}">${icon}</div>
          <div class="file-info">
            <div class="file-name">${f.name}</div>
            <div class="file-meta">${f.size} · 上传于${f.uploadedAt}</div>
          </div>
          <div class="file-status ${isIndexing ? 'status-indexing' : 'status-synced'}">
            ${isIndexing ? '<svg class="spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> 正在索引…' : '已同步'}
          </div>
          <div class="file-actions">
            <button class="file-action-btn" onclick="deleteFile('${selectedKB.id}', '${f.id}')" title="删除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
        }).join('');

        // 对正在索引的文件轮询状态
        const indexingFiles = files.filter(f => f.status === 'indexing');
        if (indexingFiles.length > 0) {
            setTimeout(() => pollFileStatus(selectedKB.id), 5000);
        }
    } else {
        fileListHeader.style.display = 'none';
        fileList.innerHTML = '';
    }
}

// 轮询索引状态
async function pollFileStatus(kbId) {
    if (!selectedKB || selectedKB.id !== kbId) return;
    try {
        const res = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}`);
        selectedKB = await res.json();
        renderFileList(selectedKB.files || []);
        // 更新卡片
        renderKBGrid(allKBs.map(k => k.id === kbId ? selectedKB : k));
    } catch (e) { }
}

// 拖拽处理
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.add('drag-over');
}
function handleDragLeave(e) {
    document.getElementById('uploadZone').classList.remove('drag-over');
}
function handleDrop(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('drag-over');
    if (!selectedKB) { showToast('请先选择一个知识库'); return; }
    uploadFiles(e.dataTransfer.files);
}
function handleFileInput(e) {
    if (!selectedKB) { showToast('请先选择一个知识库'); return; }
    uploadFiles(e.target.files);
    e.target.value = '';
}

// 上传文件
async function uploadFiles(files) {
    if (!files.length) return;
    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    const progressDiv = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    progressDiv.style.display = 'block';

    // 模拟进度
    let progress = 0;
    const interval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 15, 90);
        progressFill.style.width = progress + '%';
        progressText.textContent = `正在上传... ${Math.round(progress)}%`;
    }, 200);

    try {
        const res = await fetch(`${API_BASE}/api/knowledge-bases/${selectedKB.id}/upload`, {
            method: 'POST', body: formData
        });
        const data = await res.json();

        clearInterval(interval);
        progressFill.style.width = '100%';
        progressText.textContent = '上传完成！正在建立索引...';

        setTimeout(async () => {
            progressDiv.style.display = 'none';
            progressFill.style.width = '0%';
            showToast(`成功上传 ${data.files.length} 个文件`);
            // 刷新知识库
            const kbRes = await fetch(`/api/knowledge-bases/${selectedKB.id}`);
            selectedKB = await kbRes.json();
            renderFileList(selectedKB.files || []);
            loadKBs();
        }, 800);

    } catch (err) {
        clearInterval(interval);
        progressDiv.style.display = 'none';
        showToast('上传失败，请重试');
    }
}

// 删除文件
async function deleteFile(kbId, fileId) {
    if (!confirm('确定要删除这个文件吗？')) return;
    try {
        await fetch(`${API_BASE}/api/knowledge-bases/${kbId}/files/${fileId}`, { method: 'DELETE' });
        const kbRes = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}`);
        selectedKB = await kbRes.json();
        renderFileList(selectedKB.files || []);
        loadKBs();
        showToast('文件已删除');
    } catch (e) { showToast('删除失败'); }
}

// 全部同步
function syncAll() {
    showToast('正在同步所有文件...');
    setTimeout(() => showToast('所有文件已同步完成 ✓'), 2000);
}

// 显示创建弹窗
function showCreateKBModal() {
    document.getElementById('kbName').value = '';
    document.getElementById('kbDesc').value = '';
    document.getElementById('createKBModal').style.display = 'flex';
    setTimeout(() => document.getElementById('kbName').focus(), 100);
}

// 关闭弹窗（点击遮罩）
function closeModal(e) {
    if (e.target === e.currentTarget) e.target.style.display = 'none';
}

// 创建知识库
async function createKB() {
    const name = document.getElementById('kbName').value.trim();
    const desc = document.getElementById('kbDesc').value.trim();
    if (!name) { showToast('请输入知识库名称'); return; }

    try {
        const res = await fetch(`${API_BASE}/api/knowledge-bases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: desc })
        });
        const newKB = await res.json();
        allKBs.push(newKB);
        renderKBGrid(allKBs);
        document.getElementById('createKBModal').style.display = 'none';
        showToast(`知识库"${name}"创建成功！`);
    } catch (e) { showToast('创建失败，请重试'); }
}

// 初始化
loadKBs();

// 添加旋转动画样式
const style = document.createElement('style');
style.textContent = `.spin-icon { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
