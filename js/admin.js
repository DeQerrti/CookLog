// ═══════════════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════════════
const ADMIN_PASSWORD = '12179'; // поменяй на свой

const EMOJIS = ['🍳','🥗','🍜','🥩','🍲','🥣','🍕','🥚','🥞','🍱','🥘','🍛','🍝','🥙','🌮','🫕','🍣','🫔','🍞','🧆'];

const DEFAULT_TYPES   = ['Суп', 'Второе', 'Завтрак', 'Десерт', 'Перекус', 'Салат', 'Напиток'];
const DEFAULT_METHODS = ['Жарка', 'Варка', 'Запекание', 'Тушение', 'Без готовки', 'Гриль', 'Пар'];

// ═══════════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════════
let allRecipes  = [];
let editingId   = null;       // null = new recipe, string = existing id
let currentTags = [];
let catGroup    = 'type';     // which group is open in cat modal

// ═══════════════════════════════════════════════════════════════════════
//  LOCAL STORAGE helpers for categories
// ═══════════════════════════════════════════════════════════════════════
const lsGet = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const getTypes   = () => lsGet('cl_types',   DEFAULT_TYPES);
const getMethods = () => lsGet('cl_methods',  DEFAULT_METHODS);

// ═══════════════════════════════════════════════════════════════════════
//  SESSION AUTH
// ═══════════════════════════════════════════════════════════════════════
if (sessionStorage.getItem('cl_auth') === '1') showAdmin();

document.getElementById('auth-btn').addEventListener('click', tryAuth);
document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') tryAuth();
});

function tryAuth() {
  if (document.getElementById('password-input').value === ADMIN_PASSWORD) {
    sessionStorage.setItem('cl_auth', '1');
    showAdmin();
  } else {
    document.getElementById('auth-error').classList.remove('hidden');
    document.getElementById('password-input').value = '';
    document.getElementById('password-input').focus();
  }
}

async function showAdmin() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('admin-main').classList.remove('hidden');
  buildEmojiSuggestions();
  populateCategorySelects();
  await loadRecipes();
  renderSavedTags();
}

// ═══════════════════════════════════════════════════════════════════════
//  LOAD ALL RECIPES
// ═══════════════════════════════════════════════════════════════════════
async function loadRecipes() {
  const grid = document.getElementById('admin-recipes-grid');
  grid.innerHTML = '<div class="loading">Загружаем…</div>';

  const { data, error } = await db.from('recipes').select('*').order('created_at', { ascending: false });
  if (error) { grid.innerHTML = '<div class="loading">Ошибка загрузки :(</div>'; return; }

  allRecipes = data || [];
  renderAdminGrid();
  renderSavedTags();
}

// ═══════════════════════════════════════════════════════════════════════
//  ADMIN RECIPE GRID
// ═══════════════════════════════════════════════════════════════════════
function renderAdminGrid() {
  const grid = document.getElementById('admin-recipes-grid');
  grid.innerHTML = '';

  if (!allRecipes.length) {
    grid.innerHTML = '<div class="loading">Рецептов пока нет — добавь первый!</div>';
    return;
  }

  allRecipes.forEach(r => {
    const card = document.createElement('div');
    card.className = 'recipe-card admin-card';

    const imageHtml = r.image_url
      ? `<img class="card-image" src="${r.image_url}" alt="${r.title}" loading="lazy" />`
      : `<div class="card-image-placeholder">${r.emoji || '🍽️'}</div>`;

    const typeLabel   = r.type   || r.meal   || '';
    const methodLabel = r.method || '';

    card.innerHTML = `
      ${imageHtml}
      <div class="card-body">
        <div class="card-meta">
          ${typeLabel   ? `<span class="badge-meal">${typeLabel}</span>` : ''}
          ${methodLabel ? `<span class="badge-method">${methodLabel}</span>` : ''}
          ${r.time_minutes ? `<span class="badge-time">⏱ ${r.time_minutes} мин</span>` : ''}
        </div>
        <div class="card-title">${r.title}</div>
        <div class="card-tags">${(r.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div>
        <div class="admin-card-actions">
          <button class="btn-edit" data-id="${r.id}">✏️ Редактировать</button>
          <button class="btn-del"  data-id="${r.id}">🗑</button>
        </div>
      </div>`;

    card.querySelector('.btn-edit').addEventListener('click', e => { e.stopPropagation(); openEdit(r); });
    card.querySelector('.btn-del').addEventListener('click',  e => { e.stopPropagation(); deleteRecipe(r.id); });
    grid.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  NEW RECIPE
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('new-recipe-btn').addEventListener('click', () => {
  editingId = null;
  clearForm();
  document.getElementById('form-title').textContent = 'Новый рецепт';
  document.getElementById('delete-btn').style.display = 'none';
  document.getElementById('header-mode-label').textContent = 'Новый рецепт';
  showFormSection();
});

// ═══════════════════════════════════════════════════════════════════════
//  OPEN EDIT
// ═══════════════════════════════════════════════════════════════════════
function openEdit(r) {
  editingId = r.id;

  document.getElementById('f-title').value        = r.title || '';
  document.getElementById('f-time').value         = r.time_minutes || '';
  document.getElementById('f-source-label').value = r.source_label || '';
  document.getElementById('f-source-url').value   = r.source_url   || '';
  document.getElementById('f-image').value        = r.image_url    || '';
  document.getElementById('f-emoji').value        = r.emoji        || '';
  document.getElementById('f-ingredients').value  = (r.ingredients || []).join('\n');
  document.getElementById('f-steps').value        = (r.steps || []).join('\n');

  // restore categories (may be stored as type/method or meal/method)
  populateCategorySelects();
  setTimeout(() => {
    document.getElementById('f-type').value   = r.type   || r.meal   || '';
    document.getElementById('f-method').value = r.method || '';
  }, 0);

  currentTags = [...(r.tags || [])];
  autoTags = [];  // при редактировании авто-теги пересчитаем заново при blur
  renderTagChips();
  updatePreview();

  // trigger image preview
  triggerImagePreview(r.image_url || '');

  // clear auto-parse hint
  document.getElementById('parsed-tags-preview').innerHTML = '';

  document.getElementById('form-title').textContent = 'Редактировать рецепт';
  document.getElementById('delete-btn').style.display = '';
  document.getElementById('header-mode-label').textContent = r.title;
  showFormSection();
}

function showFormSection() {
  document.getElementById('form-section').classList.remove('hidden');
  document.getElementById('form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════════════════════════════════════
//  SAVE
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('save-btn').addEventListener('click', saveRecipe);

async function saveRecipe() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { showStatus('Укажи название рецепта', 'error'); document.getElementById('f-title').focus(); return; }

  const ingredientsRaw = document.getElementById('f-ingredients').value;
  const stepsRaw       = document.getElementById('f-steps').value;
  const timeVal        = document.getElementById('f-time').value;

  const recipe = {
    title,
    image_url:    document.getElementById('f-image').value.trim()        || null,
    type:         document.getElementById('f-type').value                || null,
    method:       document.getElementById('f-method').value              || null,
    time_minutes: timeVal ? parseInt(timeVal) : null,
    ingredients:  ingredientsRaw.split('\n').map(s => s.trim()).filter(Boolean),
    steps:        stepsRaw.split('\n').map(s => s.trim()).filter(Boolean),
    tags:         [...currentTags],
    source_label: document.getElementById('f-source-label').value.trim() || null,
    source_url:   document.getElementById('f-source-url').value.trim()   || null,
    emoji:        document.getElementById('f-emoji').value.trim()         || '🍽️',
  };

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Сохраняем…';

  let error;
  if (editingId) {
    ({ error } = await db.from('recipes').update(recipe).eq('id', editingId));
  } else {
    ({ error } = await db.from('recipes').insert([recipe]));
  }

  btn.disabled = false;
  btn.textContent = 'Сохранить рецепт';

  if (error) {
    console.error(error);
    showStatus('Ошибка: ' + error.message, 'error');
  } else {
    showStatus(editingId ? '✓ Рецепт обновлён!' : '✓ Рецепт сохранён!', 'success');
    await loadRecipes();
    cancelEdit();
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  DELETE
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('delete-btn').addEventListener('click', () => {
  if (editingId) deleteRecipe(editingId, true);
});

async function deleteRecipe(id, fromForm = false) {
  if (!confirm('Удалить этот рецепт? Это действие нельзя отменить.')) return;

  const { error } = await db.from('recipes').delete().eq('id', id);
  if (error) { alert('Ошибка удаления: ' + error.message); return; }

  await loadRecipes();
  if (fromForm) cancelEdit();
}

// ═══════════════════════════════════════════════════════════════════════
//  CANCEL / CLEAR
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('cancel-btn').addEventListener('click', cancelEdit);
document.getElementById('clear-btn').addEventListener('click', () => {
  if (confirm('Очистить форму?')) clearForm();
});

function cancelEdit() {
  document.getElementById('form-section').classList.add('hidden');
  document.getElementById('header-mode-label').textContent = 'Редактор';
  editingId = null;
}

function clearForm() {
  ['f-title','f-image','f-emoji','f-time','f-source-label','f-source-url'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-ingredients').value = '';
  document.getElementById('f-steps').value       = '';
  document.getElementById('f-type').value        = '';
  document.getElementById('f-method').value      = '';
  document.getElementById('image-preview').classList.add('hidden');
  document.getElementById('parsed-tags-preview').innerHTML = '';
  currentTags = [];
  autoTags = [];
  renderTagChips();
  updatePreview();
}

// ═══════════════════════════════════════════════════════════════════════
//  CATEGORY SELECTS
// ═══════════════════════════════════════════════════════════════════════
function populateCategorySelects() {
  fillSelect('f-type',   getTypes());
  fillSelect('f-method', getMethods());
}

function fillSelect(id, items) {
  const sel = document.getElementById(id);
  const cur = sel.value;
  sel.innerHTML = '<option value="">— не указано —</option>';
  items.forEach(it => {
    const o = document.createElement('option');
    o.value = it; o.textContent = it;
    sel.appendChild(o);
  });
  if (items.includes(cur)) sel.value = cur;
}

// ═══════════════════════════════════════════════════════════════════════
//  CATEGORY MODAL
// ═══════════════════════════════════════════════════════════════════════
document.querySelectorAll('.btn-manage').forEach(btn => {
  btn.addEventListener('click', () => {
    catGroup = btn.dataset.group;
    document.getElementById('cat-modal-title').textContent =
      catGroup === 'type' ? 'Типы блюда' : 'Способы готовки';
    renderCatList();
    document.getElementById('cat-modal').classList.remove('hidden');
  });
});

document.getElementById('cat-close-btn').addEventListener('click', closeCatModal);
document.getElementById('cat-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('cat-modal')) closeCatModal();
});

function closeCatModal() {
  document.getElementById('cat-modal').classList.add('hidden');
  populateCategorySelects();
}

function renderCatList() {
  const items    = catGroup === 'type' ? getTypes() : getMethods();
  const defaults = catGroup === 'type' ? DEFAULT_TYPES : DEFAULT_METHODS;
  const el = document.getElementById('cat-list');
  el.innerHTML = '';
  items.forEach(name => {
    const div = document.createElement('div');
    div.className = 'cat-item';
    const safeName = name.replace(/'/g, "\\'");
    div.innerHTML = `
      <span class="cat-name">${name}</span>
      ${defaults.includes(name) ? '<span class="cat-badge">базовая</span>' : ''}
      <button class="cat-del-btn" onclick="removeCategory('${safeName}')">✕</button>`;
    el.appendChild(div);
  });
}

document.getElementById('cat-add-btn').addEventListener('click', addCategory);
document.getElementById('new-cat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCategory();
});

function addCategory() {
  const input = document.getElementById('new-cat-input');
  const val   = input.value.trim();
  if (!val) return;
  const key   = catGroup === 'type' ? 'cl_types' : 'cl_methods';
  const items = catGroup === 'type' ? getTypes() : getMethods();
  if (items.includes(val)) return;
  items.push(val);
  lsSet(key, items);
  input.value = '';
  renderCatList();
}

function removeCategory(name) {
  const key   = catGroup === 'type' ? 'cl_types' : 'cl_methods';
  let items   = catGroup === 'type' ? getTypes() : getMethods();
  items = items.filter(i => i !== name);
  lsSet(key, items);
  renderCatList();
}

// ═══════════════════════════════════════════════════════════════════════
//  TAGS
// ═══════════════════════════════════════════════════════════════════════
function renderTagChips() {
  const el = document.getElementById('tags-chips-display');
  el.innerHTML = '';
  currentTags.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    const safe = t.replace(/'/g, "\\'");
    chip.innerHTML = `${t} <button onclick="removeTag('${safe}')">✕</button>`;
    el.appendChild(chip);
  });
  updatePreview();
  renderSavedTags();
}

function removeTag(t) {
  currentTags = currentTags.filter(x => x !== t);
  renderTagChips();
}

document.getElementById('tag-add-btn').addEventListener('click', addTagFromInput);
document.getElementById('tag-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); }
});

function addTagFromInput() {
  const inp = document.getElementById('tag-input');
  const val = inp.value.trim().toLowerCase();
  if (val && !currentTags.includes(val)) { currentTags.push(val); renderTagChips(); }
  inp.value = '';
}

function renderSavedTags() {
  // collect all unique tags from Supabase recipes
  const all = [...new Set(allRecipes.flatMap(r => r.tags || []))].sort();
  const el  = document.getElementById('saved-tags-wrap');
  el.innerHTML = '';
  if (!all.length) { el.textContent = 'пока нет сохранённых'; return; }
  all.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'saved-tag-btn' + (currentTags.includes(t) ? ' used' : '');
    btn.textContent = t;
    btn.addEventListener('click', () => {
      if (!currentTags.includes(t)) { currentTags.push(t); renderTagChips(); }
    });
    el.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  INGREDIENTS AUTO-PARSE
//  Срабатывает только когда пользователь ушёл с поля (blur),
//  а не на каждый введённый символ.
//  Отслеживаем какие теги были авто-добавлены, чтобы при изменении
//  ингредиентов убирать старые авто-теги и добавлять новые.
// ═══════════════════════════════════════════════════════════════════════
let autoTags = []; // теги добавленные автоматически из ингредиентов

document.getElementById('f-ingredients').addEventListener('blur', onIngredientsChange);
// Обновляем только превью-подсказку при вводе, но теги не трогаем
document.getElementById('f-ingredients').addEventListener('input', updateIngredientPreview);

function updateIngredientPreview() {
  const lines  = document.getElementById('f-ingredients').value.split('\n').map(l => l.trim()).filter(Boolean);
  // показываем только полные строки (где есть разделитель или конец строки)
  const parsed = lines
    .map(line => {
      const first = line.split(/[—\-–:,]/)[0].trim().toLowerCase();
      return first.length >= 2 ? first : null; // минимум 2 символа
    })
    .filter(Boolean);

  const preview = document.getElementById('parsed-tags-preview');
  preview.innerHTML = parsed.length
    ? '→ авто-теги при уходе с поля: ' + parsed.map(t => `<span class="auto-tag">${t}</span>`).join(' ')
    : '';
}

function onIngredientsChange() {
  const lines  = document.getElementById('f-ingredients').value.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = lines
    .map(line => {
      const first = line.split(/[—\-–:,]/)[0].trim().toLowerCase();
      return first.length >= 2 ? first : null;
    })
    .filter(Boolean);

  // Убираем старые авто-теги которых больше нет в ингредиентах
  currentTags = currentTags.filter(t => !autoTags.includes(t) || parsed.includes(t));

  // Добавляем новые
  parsed.forEach(t => { if (!currentTags.includes(t)) currentTags.push(t); });

  // Запоминаем текущий набор авто-тегов
  autoTags = [...parsed];

  const preview = document.getElementById('parsed-tags-preview');
  preview.innerHTML = parsed.length
    ? '→ авто-теги: ' + parsed.map(t => `<span class="auto-tag">${t}</span>`).join(' ')
    : '';

  renderTagChips();
}

// ═══════════════════════════════════════════════════════════════════════
//  EMOJI
// ═══════════════════════════════════════════════════════════════════════
function buildEmojiSuggestions() {
  const el = document.getElementById('emoji-suggestions');
  EMOJIS.forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-opt';
    btn.textContent = em;
    btn.dataset.emoji = em;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      document.getElementById('f-emoji').value = em;
      updatePreview();
    });
    el.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  IMAGE PREVIEW
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('f-image').addEventListener('input', e => triggerImagePreview(e.target.value));

function triggerImagePreview(url) {
  const wrap = document.getElementById('image-preview');
  const img  = document.getElementById('preview-img');
  if (url) {
    img.src = url;
    img.onload  = () => wrap.classList.remove('hidden');
    img.onerror = () => wrap.classList.add('hidden');
  } else {
    wrap.classList.add('hidden');
  }
  updatePreview();
}

// ═══════════════════════════════════════════════════════════════════════
//  LIVE PREVIEW
// ═══════════════════════════════════════════════════════════════════════
['f-title','f-type','f-method','f-time','f-emoji','f-image'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updatePreview);
  document.getElementById(id)?.addEventListener('change', updatePreview);
});

function updatePreview() {
  const title  = document.getElementById('f-title').value  || 'Название рецепта';
  const type   = document.getElementById('f-type').value;
  const method = document.getElementById('f-method').value;
  const time   = document.getElementById('f-time').value;
  const emoji  = document.getElementById('f-emoji').value  || '🍽️';
  const image  = document.getElementById('f-image').value;

  document.getElementById('preview-title').textContent = title;

  const meta = document.getElementById('preview-meta');
  meta.innerHTML = `
    ${type   ? `<span class="badge-meal">${type}</span>`   : ''}
    ${method ? `<span class="badge-method">${method}</span>` : ''}
    ${time   ? `<span class="badge-time">⏱ ${time} мин</span>` : ''}`;

  const tagsEl = document.getElementById('preview-tags');
  tagsEl.innerHTML = currentTags.slice(0, 5).map(t => `<span class="tag">${t}</span>`).join('');

  const placeholder = document.getElementById('preview-placeholder');
  const imgCard     = document.getElementById('preview-img-card');
  if (image) {
    imgCard.src = image;
    imgCard.onload  = () => { imgCard.classList.remove('hidden'); placeholder.style.display = 'none'; };
    imgCard.onerror = () => { imgCard.classList.add('hidden'); placeholder.style.display = ''; placeholder.textContent = emoji; };
  } else {
    imgCard.classList.add('hidden');
    placeholder.style.display = '';
    placeholder.textContent = emoji;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  STATUS
// ═══════════════════════════════════════════════════════════════════════
let statusTimer;
function showStatus(msg, type) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = `save-status ${type}`;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

// ═══════════════════════════════════════════════════════════════════════
//  INIT PREVIEW
// ═══════════════════════════════════════════════════════════════════════
updatePreview();
