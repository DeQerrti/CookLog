// ═══════════════════════════════════════════════════════════════════════
//  API-клиент
// ═══════════════════════════════════════════════════════════════════════

const api = {
  async _fetch(url, opts = {}) {
    try {
      const r = await fetch(url, { credentials: 'same-origin', ...opts });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return { data: null, error: data.error || `HTTP ${r.status}` };
      return { data, error: null };
    } catch (e) {
      return { data: null, error: e.message };
    }
  },

  recipes: {
    list:   ()        => api._fetch('/api/recipes'),
    create: (body)    => api._fetch('/api/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    update: (id, body)=> api._fetch(`/api/recipes/${id}`, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    delete: (id)      => api._fetch(`/api/recipes/${id}`, { method: 'DELETE' }),
    import: (body)    => api._fetch('/api/recipes/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  },

  auth: {
    login:  (password) => api._fetch('/api/auth/login',  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }),
    logout: ()         => api._fetch('/api/auth/logout', { method: 'POST' }),
    check:  ()         => api._fetch('/api/auth/check'),
  },

  // Загрузка фото — multipart, не JSON
  async uploadImage(file) {
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const r = await fetch('/api/upload-image', { method: 'POST', credentials: 'same-origin', body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return { data: null, error: data.error || `HTTP ${r.status}` };
      return { data, error: null };
    } catch (e) {
      return { data: null, error: e.message };
    }
  },
};
