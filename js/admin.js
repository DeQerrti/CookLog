// ─── Пароль (простая защита) ─────────────────────────────────────────────────
// Смени на свой пароль
const ADMIN_PASSWORD = '12179';

const authScreen = document.getElementById('auth-screen');
const adminMain  = document.getElementById('admin-main');

// Проверяем сессию
if (sessionStorage.getItem('cl_auth') === '1') {
  showAdmin();
}

document.getElementById('auth-btn').addEventListener('click', tryAuth);
document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') tryAuth();
});

function tryAuth() {
  const val = document.getElementById('password-input').value;
  if (val === ADMIN_PASSWORD) {
    sessionStorage.setItem('cl_auth', '1');
    showAdmin();
  } else {
    document.getElementById('auth-error').classList.remove('hidden');
    document.getElementById('password-input').value = '';
    document.getElementById('password-input').focus();
  }
}

function showAdmin() {
  authScreen.classList.add('hidden');
  adminMain.classList.remove('hidden');
}

// ─── Превью карточки (живое обновление) ──────────────────────────────────────
const MEAL_LABELS   = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };
const METHOD_LABELS = { fry: 'Жарка', boil: 'Варка', bake: 'Запекание', raw: 'Без готовки' };

function updatePreview() {
  const title  = document.getElementById('f-title').value || 'Название рецепта';
  const meal   = document.getElementById('f-meal').value;
  const method = document.getElementById('f-method').value;
  const time   = document.getElementById('f-time').value;
  const emoji  = document.getElementById('f-emoji').value || '🍽️';
  const image  = document.getElementById('f-image').value;
  const tagsRaw = document.getElementById('f-tags').value;

  document.getElementById('preview-title').textContent = title;
  document.getElementById('preview-placeholder').textContent = emoji;

  const meta = document.getElementById('preview-meta');
  meta.innerHTML = `
    ${meal   ? `<span class="badge-meal">${MEAL_LABELS[meal] || meal}</span>` : ''}
    ${method ? `<span class="badge-method">${METHOD_LABELS[method] || method}</span>` : ''}
    ${time   ? `<span class="badge-time">⏱ ${time} мин</span>` : ''}
  `;

  const tagsEl = document.getElementById('preview-tags');
  tagsEl.innerHTML = tagsRaw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => `<span class="tag">${t}</span>`)
    .join('');

  // Превью изображения
  const imgPreview = document.getElementById('image-preview');
  if (image) {
    document.getElementById('preview-img').src = image;
    imgPreview.classList.remove('hidden');
    document.getElementById('preview-placeholder').style.display = 'none';
  } else {
    imgPreview.classList.add('hidden');
    document.getElementById('preview-placeholder').style.display = 'flex';
  }
}

['f-title','f-meal','f-method','f-time','f-emoji','f-image','f-tags'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updatePreview);
  document.getElementById(id)?.addEventListener('change', updatePreview);
});

// Эмодзи по клику
document.querySelectorAll('.emoji-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('f-emoji').value = btn.dataset.emoji;
    updatePreview();
  });
});

// ─── Сохранение в Supabase ────────────────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', saveRecipe);

async function saveRecipe() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) {
    showStatus('Укажи название рецепта', 'error');
    document.getElementById('f-title').focus();
    return;
  }

  const ingredientsRaw = document.getElementById('f-ingredients').value;
  const stepsRaw       = document.getElementById('f-steps').value;
  const tagsRaw        = document.getElementById('f-tags').value;
  const timeVal        = document.getElementById('f-time').value;

  const recipe = {
    title,
    image_url:    document.getElementById('f-image').value.trim() || null,
    meal:         document.getElementById('f-meal').value || null,
    method:       document.getElementById('f-method').value || null,
    time_minutes: timeVal ? parseInt(timeVal) : null,
    ingredients:  ingredientsRaw.split('\n').map(s => s.trim()).filter(Boolean),
    steps:        stepsRaw.split('\n').map(s => s.trim()).filter(Boolean),
    tags:         tagsRaw.split(',').map(s => s.trim()).filter(Boolean),
    source_label: document.getElementById('f-source-label').value.trim() || null,
    source_url:   document.getElementById('f-source-url').value.trim() || null,
    emoji:        document.getElementById('f-emoji').value.trim() || '🍽️',
  };

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Сохраняем...';

  const { error } = await db.from('recipes').insert([recipe]);

  btn.disabled = false;
  btn.textContent = 'Сохранить рецепт';

  if (error) {
    console.error(error);
    showStatus('Ошибка: ' + error.message, 'error');
  } else {
    showStatus('✓ Рецепт сохранён!', 'success');
    clearForm();
  }
}

// ─── Очистка формы ────────────────────────────────────────────────────────────
document.getElementById('clear-btn').addEventListener('click', () => {
  if (confirm('Очистить форму?')) clearForm();
});

function clearForm() {
  ['f-title','f-image','f-emoji','f-tags','f-source-label','f-source-url','f-time'].forEach(id => {
    document.getElementById(id).value = '';
  });
  ['f-ingredients','f-steps'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-meal').value   = '';
  document.getElementById('f-method').value = '';
  updatePreview();
}

// ─── Статус ───────────────────────────────────────────────────────────────────
function showStatus(msg, type) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = `save-status ${type}`;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ─── Инит ─────────────────────────────────────────────────────────────────────
updatePreview();
