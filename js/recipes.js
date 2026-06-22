// ─── State ────────────────────────────────────────────────────────────
const filters  = { type: '', method: '', search: '' };
let allRecipes = [];

// ─── Supabase load ────────────────────────────────────────────────────
async function loadRecipes() {
  const grid = document.getElementById('recipes-grid');
  grid.innerHTML = '<div class="loading">Загружаем рецепты…</div>';

  const { data, error } = await db.from('recipes').select('*').order('created_at', { ascending: false });
  if (error) { grid.innerHTML = '<div class="loading">Ошибка загрузки. Обнови страницу.</div>'; return; }

  allRecipes = data || [];
  buildDynamicFilters();
  applyFilters();
}

// ─── Dynamic filter chips from actual data ────────────────────────────
function buildDynamicFilters() {
  const types   = [...new Set(allRecipes.map(r => r.type   || r.meal   || '').filter(Boolean))].sort();
  const methods = [...new Set(allRecipes.map(r => r.method || '').filter(Boolean))].sort();

  buildChips('type-chips',   'type',   types);
  buildChips('method-chips', 'method', methods);
}

function buildChips(containerId, filterKey, values) {
  const el = document.getElementById(containerId);
  el.innerHTML = `<button class="chip active" data-filter="${filterKey}" data-value="">Все</button>`;
  values.forEach(val => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.filter = filterKey;
    btn.dataset.value  = val;
    btn.textContent    = val;
    el.appendChild(btn);
  });
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      el.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filters[filterKey] = chip.dataset.value;
      applyFilters();
    });
  });
}

// ─── Filter + render ──────────────────────────────────────────────────
function applyFilters() {
  let result = [...allRecipes];

  if (filters.type) {
    result = result.filter(r => (r.type || r.meal || '') === filters.type);
  }
  if (filters.method) {
    result = result.filter(r => (r.method || '') === filters.method);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (r.ingredients || []).some(i => i.toLowerCase().includes(q))
    );
  }

  renderCards(result);
}

function renderCards(recipes) {
  const grid  = document.getElementById('recipes-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('recipes-count');
  grid.innerHTML = '';

  if (!recipes.length) {
    empty.classList.remove('hidden');
    if (count) count.textContent = '';
    return;
  }
  empty.classList.add('hidden');
  if (count) count.textContent = `${recipes.length} ${plural(recipes.length)}`;

  recipes.forEach(r => {
    const card = document.createElement('div');
    card.className = 'recipe-card';

    const imageHtml = r.image_url
      ? `<img class="card-image" src="${r.image_url}" alt="${r.title}" loading="lazy" />`
      : `<div class="card-image-placeholder">${r.emoji || '🍽️'}</div>`;

    const typeLabel   = r.type   || r.meal   || '';
    const methodLabel = r.method || '';

    card.innerHTML = `
      ${imageHtml}
      <div class="card-body">
        <div class="card-meta">
          ${typeLabel   ? `<span class="badge-meal">${typeLabel}</span>`     : ''}
          ${methodLabel ? `<span class="badge-method">${methodLabel}</span>` : ''}
          ${r.time_minutes ? `<span class="badge-time">⏱ ${r.time_minutes} мин</span>` : ''}
        </div>
        <div class="card-title">${r.title}</div>
        <div class="card-tags">${(r.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div>
      </div>`;

    card.addEventListener('click', () => openModal(r));
    grid.appendChild(card);
  });
}

// ─── Plural helper ────────────────────────────────────────────────────
function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'рецепт';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'рецепта';
  return 'рецептов';
}

// ─── Search ───────────────────────────────────────────────────────────
document.getElementById('search-input').addEventListener('input', e => {
  filters.search = e.target.value.trim();
  applyFilters();
});

// ─── Start ────────────────────────────────────────────────────────────
loadRecipes();
