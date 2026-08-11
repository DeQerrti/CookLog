// ─── State ────────────────────────────────────────────────────────────
const filters  = { types: new Set(), methods: new Set(), ingredients: new Set(), search: '' };
let allRecipes = [];
let allIngredients = [];

// ─── Load ─────────────────────────────────────────────────────────────
async function loadRecipes() {
  const grid = document.getElementById('recipes-grid');
  grid.innerHTML = '<div class="loading">Загружаем рецепты…</div>';

  const { data, error } = await api.recipes.list();
  if (error) { grid.innerHTML = '<div class="loading">Ошибка загрузки. Обнови страницу.</div>'; return; }

  allRecipes = data || [];
  buildDynamicFilters();
  buildIngredientsList();
  applyFilters();
}

// ─── Dynamic filter chips from actual data ────────────────────────────
function buildDynamicFilters() {
  const types   = [...new Set(allRecipes.map(r => r.type   || r.meal   || '').filter(Boolean))].sort();
  const methods = [...new Set(allRecipes.map(r => r.method || '').filter(Boolean))].sort();

  buildChips('type-chips',   'types',   types);
  buildChips('method-chips', 'methods', methods);
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
      const value = chip.dataset.value;
      const set   = filters[filterKey];

      if (value === '') {
        // "Все" — сбрасывает выбор в этой категории
        set.clear();
      } else {
        if (set.has(value)) set.delete(value);
        else set.add(value);
      }

      // Пересчитываем активные чипы по актуальному состоянию set
      el.querySelectorAll('.chip').forEach(c => {
        const isAll = c.dataset.value === '';
        c.classList.toggle('active', isAll ? set.size === 0 : set.has(c.dataset.value));
      });

      applyFilters();
    });
  });
}

// ─── Ingredients panel ─────────────────────────────────────────────────
function buildIngredientsList() {
  const counts = new Map();
  allRecipes.forEach(r => (r.ingredients || []).forEach(raw => {
    const name = normalizeIngredient(raw);
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  }));
  allIngredients = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'));
  renderIngredientsList(allIngredients);
}

// Отрезаем количество/единицы измерения от начала строки ингредиента,
// чтобы "3 яйца" и "яйцо - 2шт" схлопывались в один пункт "яйцо"/"яйца".
function normalizeIngredient(raw) {
  if (!raw) return '';
  let s = String(raw).split(/[—\-:,]/)[0].trim();
  s = s.replace(/^\d+([.,]\d+)?\s*/, '').trim();
  return s.toLowerCase();
}

function renderIngredientsList(list) {
  const el = document.getElementById('ingredients-filter-list');
  if (!list.length) {
    el.innerHTML = '<div class="ingredients-empty">Ничего не найдено</div>';
    return;
  }
  el.innerHTML = list.map(([name]) => `
    <label class="ingredient-row">
      <input type="checkbox" value="${name}" ${filters.ingredients.has(name) ? 'checked' : ''} />
      <span>${name}</span>
    </label>
  `).join('');

  el.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) filters.ingredients.add(cb.value);
      else filters.ingredients.delete(cb.value);
      updateIngredientsToggleLabel();
    });
  });
}

function updateIngredientsToggleLabel() {
  const label = document.getElementById('ingredients-toggle-label');
  const n = filters.ingredients.size;
  label.textContent = n === 0 ? 'Все' : `Выбрано: ${n}`;
  document.getElementById('ingredients-toggle').classList.toggle('active', n > 0);
}

const ingredientsOverlay = document.getElementById('ingredients-overlay');
let releaseIngredientsFocus = null;

function openIngredientsOverlay() {
  renderIngredientsList(allIngredients);
  ingredientsOverlay.classList.remove('hidden');
  releaseIngredientsFocus = window.trapFocus?.(ingredientsOverlay, closeIngredientsOverlay);
}

function closeIngredientsOverlay() {
  ingredientsOverlay.classList.add('hidden');
  releaseIngredientsFocus?.();
  releaseIngredientsFocus = null;
}

document.getElementById('ingredients-toggle').addEventListener('click', openIngredientsOverlay);
document.getElementById('ingredients-close').addEventListener('click', closeIngredientsOverlay);
ingredientsOverlay.addEventListener('click', (e) => { if (e.target === ingredientsOverlay) closeIngredientsOverlay(); });

document.getElementById('ingredients-search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  renderIngredientsList(q ? allIngredients.filter(([name]) => name.includes(q)) : allIngredients);
});

document.getElementById('ingredients-clear').addEventListener('click', () => {
  filters.ingredients.clear();
  updateIngredientsToggleLabel();
  renderIngredientsList(allIngredients);
  applyFilters();
});

document.getElementById('ingredients-apply').addEventListener('click', () => {
  updateIngredientsToggleLabel();
  closeIngredientsOverlay();
  applyFilters();
});

// ─── Filter + render ──────────────────────────────────────────────────
function applyFilters() {
  let result = [...allRecipes];

  if (filters.types.size) {
    result = result.filter(r => filters.types.has(r.type || r.meal || ''));
  }
  if (filters.methods.size) {
    result = result.filter(r => filters.methods.has(r.method || ''));
  }
  if (filters.ingredients.size) {
    result = result.filter(r => {
      const owned = new Set((r.ingredients || []).map(normalizeIngredient));
      return [...filters.ingredients].every(need => owned.has(need));
    });
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

// ─── "Что приготовить?" — случайный рецепт из текущей выборки ─────────
document.getElementById('random-btn').addEventListener('click', () => {
  let pool = [...allRecipes];

  if (filters.types.size) pool = pool.filter(r => filters.types.has(r.type || r.meal || ''));
  if (filters.methods.size) pool = pool.filter(r => filters.methods.has(r.method || ''));
  if (filters.ingredients.size) {
    pool = pool.filter(r => {
      const owned = new Set((r.ingredients || []).map(normalizeIngredient));
      return [...filters.ingredients].every(need => owned.has(need));
    });
  }

  if (!pool.length) pool = allRecipes;
  if (!pool.length) return;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  openModal(pick);
});

// ─── Start ────────────────────────────────────────────────────────────
loadRecipes();
