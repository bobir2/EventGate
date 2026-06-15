const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  updateCartBadge();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

function toast(msg, type = 'info') {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    box.className = 'toast-box';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && token && !path.includes('/auth/')) {
      logout();
    }
    throw new Error(data.error || 'Помилка запиту');
  }
  return data;
}

async function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge || !getToken()) return;
  try {
    const { count } = await api('/cart/count');
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  } catch { badge.style.display = 'none'; }
}

async function refreshUserBalance() {
  if (!getToken()) return;
  try {
    const { user } = await api('/profile');
    setAuth(getToken(), user);
    renderHeader();
  } catch {}
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatPrice(n) {
  return Number(n).toLocaleString('uk-UA') + ' ₴';
}

function typeBadge(type) {
  const labels = { concert: 'Концерт', standup: 'Стендап', cinema: 'Кіно' };
  return `<span class="badge badge-${type}">${labels[type] || type}</span>`;
}

const IMG_FALLBACK = {
  concert: '/images/events/01.jpg',
  standup: '/images/events/02.jpg',
  cinema: '/images/events/03.jpg',
  default: '/images/events/01.jpg',
};

function eventImg(event, extraClass = '') {
  const type = event.event_type || 'default';
  const fallback = IMG_FALLBACK[type] || IMG_FALLBACK.default;
  const src = (event.image_url && !event.image_url.startsWith('https://')) ? event.image_url : fallback;
  return `<img src="${src}" alt="${event.title || ''}" class="${extraClass}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">`;
}

function moodBadge(mood) {
  const labels = { energetic: 'Енергійний', romantic: 'Романтичний', fun: 'Веселий', cultural: 'Культурний' };
  if (!mood) return '';
  return `<span class="badge badge-mood">${labels[mood] || mood}</span>`;
}

function confirmModal({ title = 'Підтвердження', message = 'Ви впевнені?', confirmText = 'Так', cancelText = 'Скасувати', type = 'primary' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline modal-cancel">${cancelText}</button>
          <button type="button" class="btn btn-${type} modal-confirm">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const close = (result) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('.modal-cancel').onclick = () => close(false);
    overlay.querySelector('.modal-confirm').onclick = () => close(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
    });
  });
}

function promptModal({
  title = 'Введіть значення',
  message = '',
  label = '',
  placeholder = '',
  defaultValue = '',
  inputType = 'text',
  min,
  confirmText = 'OK',
  cancelText = 'Скасувати',
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3 class="modal-title">${title}</h3>
        ${message ? `<p class="modal-message">${message}</p>` : ''}
        ${label ? `<label class="modal-label">${label}</label>` : ''}
        <input class="modal-input" type="${inputType}" placeholder="${placeholder}" value="${defaultValue}" ${min != null ? `min="${min}"` : ''}>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline modal-cancel">${cancelText}</button>
          <button type="button" class="btn btn-primary modal-confirm">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('.modal-input');
    requestAnimationFrame(() => { overlay.classList.add('show'); input.focus(); input.select(); });

    const close = (value) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(value);
    };

    overlay.querySelector('.modal-cancel').onclick = () => close(null);
    overlay.querySelector('.modal-confirm').onclick = () => close(input.value);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value);
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(null); }
    });
  });
}

function renderHeader() {
  const el = document.getElementById('header');
  if (!el) return;

  const user = getUser();
  const path = window.location.pathname;

  el.innerHTML = `
    <header class="header">
      <div class="container header-inner">
        <a href="/" class="logo">Event<span>Gate</span></a>
        <nav class="nav">
          <a href="/" class="${path === '/' || path.endsWith('index.html') ? 'active' : ''}">Головна</a>
          <a href="/catalog.html" class="${path.includes('catalog') ? 'active' : ''}">Каталог</a>
          <a href="/evening.html" class="${path.includes('evening') ? 'active' : ''}">Маршрут вечора</a>
          <a href="/marketplace.html" class="${path.includes('marketplace') ? 'active' : ''}">Ринок</a>
          <a href="/auctions.html" class="${path.includes('auctions') ? 'active' : ''}">Аукціони</a>
          ${user ? `
            <a href="/cart.html" class="${path.includes('cart') ? 'active' : ''} cart-link">
              Кошик <span id="cart-badge" class="cart-badge" style="display:none">0</span>
            </a>
            <a href="/profile.html" class="${path.includes('profile') ? 'active' : ''}">Профіль</a>
            ${user.role === 'admin' ? `<a href="/admin.html" class="${path.includes('admin') ? 'active' : ''}">Адмін</a>` : ''}
            <span class="balance-badge" id="header-balance">${formatPrice(user.balance || 0)}</span>
            <button class="btn-logout" onclick="logout()">Вийти</button>
          ` : `
            <a href="/login.html">Увійти</a>
            <a href="/register.html" class="btn btn-primary btn-sm">Реєстрація</a>
          `}
        </nav>
      </div>
    </header>
  `;
  updateCartBadge();
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  if (getToken()) refreshUserBalance();
});
