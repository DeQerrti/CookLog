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
    remove: (id)      => api._fetch(`/api/recipes/${id}`, { method: 'DELETE' }), // алиас delete — так его вызывает admin.js
  },

  auth: {
    login:  (password) => api._fetch('/api/auth/login',  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }),
    logout: ()         => api._fetch('/api/auth/logout', { method: 'POST' }),
    check:  ()         => api._fetch('/api/auth/check'),
  },
};
