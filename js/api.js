// ═══════════════════════════════════════════════════════════════════════
//  Тонкая обёртка над /api/* (Cloudflare Pages Functions + D1)
//  Повторяет форму { data, error }, к которой привык остальной код.
// ═══════════════════════════════════════════════════════════════════════

const API_BASE = '/api';

async function apiGet(path) {
  try {
    const res = await fetch(API_BASE + path, { credentials: 'include' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: (data && data.error) || 'Ошибка запроса' };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: 'Нет соединения с сервером' };
  }
}

async function apiSend(path, method, body) {
  try {
    const res = await fetch(API_BASE + path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: (data && data.error) || 'Ошибка запроса' };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: 'Нет соединения с сервером' };
  }
}

const api = {
  recipes: {
    list:   ()            => apiGet('/recipes'),
    create: (recipe)      => apiSend('/recipes', 'POST', recipe),
    update: (id, recipe)  => apiSend(`/recipes/${id}`, 'PUT', recipe),
    remove: (id)          => apiSend(`/recipes/${id}`, 'DELETE'),
  },
  auth: {
    login:  (password)    => apiSend('/auth/login', 'POST', { password }),
    logout: ()            => apiSend('/auth/logout', 'POST'),
    check:  ()            => apiGet('/auth/check'),
  },
};
