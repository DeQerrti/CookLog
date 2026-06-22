// ─── Моковые данные (потом заменим на Supabase) ──────────────────────────────
const MOCK_RECIPES = [
  {
    id: 1,
    title: 'Овсянка с бананом и арахисовой пастой',
    image: null,
    meal: 'breakfast',
    method: 'boil',
    time: '10 мин',
    ingredients: ['Овсяные хлопья — 80 г', 'Молоко — 200 мл', 'Банан — 1 шт', 'Арахисовая паста — 1 ст.л.'],
    steps: ['Залить хлопья молоком и варить 5 минут на среднем огне.', 'Нарезать банан кружочками.', 'Переложить в миску, сверху выложить банан и арахисовую пасту.'],
    tags: ['овёс', 'банан', 'арахис', 'быстро'],
    source: null,
    emoji: '🥣'
  },
  {
    id: 2,
    title: 'Яичница с помидорами и базиликом',
    image: null,
    meal: 'breakfast',
    method: 'fry',
    time: '8 мин',
    ingredients: ['Яйца — 2 шт', 'Помидор — 1 шт', 'Базилик — несколько листьев', 'Оливковое масло', 'Соль, перец'],
    steps: ['Разогреть масло на сковороде.', 'Нарезать помидор, обжарить 2 минуты.', 'Вбить яйца, посолить. Готовить до нужной степени.', 'Украсить базиликом.'],
    tags: ['яйца', 'помидор', 'базилик'],
    source: null,
    emoji: '🍳'
  },
  {
    id: 3,
    title: 'Куриный суп с лапшой',
    image: null,
    meal: 'lunch',
    method: 'boil',
    time: '45 мин',
    ingredients: ['Куриное филе — 300 г', 'Морковь — 1 шт', 'Лук — 1 шт', 'Яичная лапша — 100 г', 'Лавровый лист', 'Соль, перец'],
    steps: ['Сварить бульон из куриного филе (~30 мин), снять пену.', 'Достать курицу, нарезать кубиками.', 'Добавить нарезанные морковь и лук, варить 10 мин.', 'Добавить лапшу и курицу, варить ещё 5 мин. Посолить.'],
    tags: ['курица', 'суп', 'лапша', 'морковь'],
    source: null,
    emoji: '🍜'
  },
  {
    id: 4,
    title: 'Говядина с картошкой в духовке',
    image: null,
    meal: 'dinner',
    method: 'bake',
    time: '70 мин',
    ingredients: ['Говядина — 500 г', 'Картофель — 4 шт', 'Лук — 1 шт', 'Чеснок — 3 зубчика', 'Растительное масло', 'Тимьян, соль, перец'],
    steps: ['Нарезать говядину кусками, обжарить на сильном огне до корочки.', 'Картофель нарезать дольками, смешать с маслом и тимьяном.', 'Выложить всё в форму, добавить лук и чеснок.', 'Запекать при 200°C 50–60 минут.'],
    tags: ['говядина', 'картошка', 'духовка'],
    source: { label: 'Рецепт с YouTube', url: 'https://youtube.com' },
    emoji: '🥩'
  }
];

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

// ─── Состояние фильтров ───────────────────────────────────────────────────────
const filters = { meal: '', method: '', search: '' };

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
    card.dataset.id = r.id;

    const imageHtml = r.image
      ? `<img class="card-image" src="${r.image}" alt="${r.title}" loading="lazy" />`
      : `<div class="card-image-placeholder">${r.emoji || '🍽️'}</div>`;

    const tagsHtml = r.tags.map(t => `<span class="tag">${t}</span>`).join('');

    card.innerHTML = `
      ${imageHtml}
      <div class="card-body">
        <div class="card-meta">
          ${r.meal ? `<span class="badge-meal">${MEAL_LABELS[r.meal] || r.meal}</span>` : ''}
          ${r.method ? `<span class="badge-method">${METHOD_LABELS[r.method] || r.method}</span>` : ''}
          ${r.time ? `<span class="badge-time">⏱ ${r.time}</span>` : ''}
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
  let result = MOCK_RECIPES;

  if (filters.meal) result = result.filter(r => r.meal === filters.meal);
  if (filters.method) result = result.filter(r => r.method === filters.method);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.ingredients.some(i => i.toLowerCase().includes(q))
    );
  }

  renderCards(result);
}

// ─── Инициализация фильтров ───────────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const filterType = chip.dataset.filter;
    const value = chip.dataset.value;

    // Сбросить активный в группе
    document.querySelectorAll(`.chip[data-filter="${filterType}"]`).forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    filters[filterType] = value;
    applyFilters();
  });
});

document.getElementById('search-input').addEventListener('input', e => {
  filters.search = e.target.value.trim();
  applyFilters();
});

// ─── Старт ────────────────────────────────────────────────────────────────────
renderCards(MOCK_RECIPES);
