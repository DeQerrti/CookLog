const overlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');

function openModal(recipe) {
  const imageHtml = recipe.image
    ? `<img class="modal-image" src="${recipe.image}" alt="${recipe.title}" />`
    : '';

  const ingredientsHtml = recipe.ingredients
    .map(i => `<li>${i}</li>`)
    .join('');

  const stepsHtml = recipe.steps
    .map((s, idx) => `
      <div class="step">
        <div class="step-num">${idx + 1}</div>
        <div class="step-text">${s}</div>
      </div>
    `)
    .join('');

  const tagsHtml = recipe.tags.map(t => `<span class="tag">${t}</span>`).join('');

  const sourceHtml = recipe.source
    ? `<div class="modal-source">Источник: <a href="${recipe.source.url}" target="_blank" rel="noopener">${recipe.source.label}</a></div>`
    : '';

  const MEAL_LABELS = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };
  const METHOD_LABELS = { fry: 'Жарка', boil: 'Варка', bake: 'Запекание', raw: 'Без готовки' };

  modalContent.innerHTML = `
    ${imageHtml}
    <div class="modal-meta">
      ${recipe.meal ? `<span class="badge-meal">${MEAL_LABELS[recipe.meal] || recipe.meal}</span>` : ''}
      ${recipe.method ? `<span class="badge-method">${METHOD_LABELS[recipe.method] || recipe.method}</span>` : ''}
      ${recipe.time ? `<span class="badge-time">⏱ ${recipe.time}</span>` : ''}
    </div>
    <div class="modal-title">${recipe.title}</div>

    <div class="modal-section-title">Ингредиенты</div>
    <ul class="ingredients-list">${ingredientsHtml}</ul>

    <div class="modal-section-title">Приготовление</div>
    <div class="modal-steps">${stepsHtml}</div>

    <div class="modal-tags">${tagsHtml}</div>
    ${sourceHtml}
  `;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
