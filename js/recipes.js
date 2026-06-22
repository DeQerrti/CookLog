const MEAL_LABELS = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус'
};

const METHOD_LABELS = {
  fry: 'Жарка',
  boil: 'Варка',
  bake: 'Запекание',
  raw: 'Без готовки'
};

// ─── Состояние ────────────────────────────────────────────────────────────────
const filters = { meal: '', method: '', search: '' };
let allRecipes = [];

// ─── Загрузка из Supabase ─────────────────────────────────────────────────────
async function loadRecipes() {
  const grid = document.getElementById('recipes-grid');
  grid.innerHTML = '<div class="loading">Загружаем рецепты...</div>';

  const { data, error } = await db.from('recipes').select('*').order('created_at', { ascending: false });

  if (error) {
    grid.innerHTML = '<div class="loading">Ошибка загрузки. Попробуй обновить страницу.</div>';
    console.error(error);
    return;
  }

  allRecipes = data || [];
  applyFilters();
}

// ─── Рендер карточек ──────────────────────────────────────────────────────────
function renderCards(recipes) {
  const grid = document.getElementById('recipes-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '';

  if (recipes.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  recipes.forEach(r => {
    const card = document.createElement('div');
    card.className = 'recipe-card';

    const imageHtml = r.image_url
      ? `<img class="card-image" src="${r.image_url}" alt="${r.title}" loading="lazy" />`
      : `<div class="card-image-placeholder">${r.emoji || '🍽️'}</div>`;

    const tagsHtml = (r.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    const timeLabel = r.time_minutes ? `⏱ ${r.time_minutes} мин` : '';

    card.innerHTML = `
      ${imageHtml}
      <div class="card-body">
        <div class="card-meta">
          ${r.meal ? `<span class="badge-meal">${MEAL_LABELS[r.meal] || r.meal}</span>` : ''}
          ${r.method ? `<span class="badge-method">${METHOD_LABELS[r.method] || r.method}</span>` : ''}
          ${timeLabel ? `<span class="badge-time">${timeLabel}</span>` : ''}
        </div>
        <div class="card-title">${r.title}</div>
        <div class="card-tags">${tagsHtml}</div>
      </div>
    `;

    card.addEventListener('click', () => openModal(r));
    grid.appendChild(card);
  });
}

// ─── Фильтрация ───────────────────────────────────────────────────────────────
function applyFilters() {
  let result = [...allRecipes];

  if (filters.meal) result = result.filter(r => r.meal === filters.meal);
  if (filters.method) result = result.filter(r => r.method === filters.method);
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

// ─── Чипы фильтров ───────────────────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const ft = chip.dataset.filter;
    document.querySelectorAll(`.chip[data-filter="${ft}"]`).forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    filters[ft] = chip.dataset.value;
    applyFilters();
  });
});

document.getElementById('search-input').addEventListener('input', e => {
  filters.search = e.target.value.trim();
  applyFilters();
});

// ─── Старт ────────────────────────────────────────────────────────────────────
loadRecipes();
