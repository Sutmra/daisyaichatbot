// 登录注册页面 JS 逻辑

// 动态识别 API 地址：优先从 localStorage 读取，本地开发默认为空（同域），生产环境请设置为 Render 后端地址
const API_BASE = localStorage.getItem('API_BASE') || '';

// Tab 切换
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');

    if (tab === 'login') {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        loginTab.classList.remove('active');
        registerTab.classList.add('active');
    }
    // 清除错误
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('registerError').style.display = 'none';
}

// 密码显示/隐藏
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

// Toast 提示
function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// 设置加载状态
function setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = isLoading;
    text.style.display = isLoading ? 'none' : 'block';
    loader.style.display = isLoading ? 'block' : 'none';
}

// 显示错误
function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showError('loginError', '请填写用户名和密码');
        return;
    }

    setLoading('loginBtn', true);
    document.getElementById('loginError').style.display = 'none';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showError('loginError', data.error || '登录失败');
            return;
        }

        // 保存用户信息
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);

        showToast('登录成功！正在跳转...', 1500);

        // 根据角色跳转
        setTimeout(() => {
            if (data.user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/chat.html';
            }
        }, 1000);

    } catch (err) {
        showError('loginError', '网络错误，请重试');
    } finally {
        setLoading('loginBtn', false);
    }
}

// 处理注册
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!username || !password) {
        showError('registerError', '请填写用户名和密码');
        return;
    }
    if (password.length < 6) {
        showError('registerError', '密码至少需要6个字符');
        return;
    }

    setLoading('registerBtn', true);
    document.getElementById('registerError').style.display = 'none';

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showError('registerError', data.error || '注册失败');
            return;
        }

        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        showToast('注册成功！欢迎加入', 1500);
        setTimeout(() => { window.location.href = '/chat.html'; }, 1000);

    } catch (err) {
        showError('registerError', '网络错误，请重试');
    } finally {
        setLoading('registerBtn', false);
    }
}

// 检查是否已登录
(function checkAuth() {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (user && token) {
        const userData = JSON.parse(user);
        if (userData.role === 'admin') {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/chat.html';
        }
    }
})();
