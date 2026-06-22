const overlay      = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');

function openModal(r) {
  const imageHtml = r.image_url
    ? `<img class="modal-image" src="${r.image_url}" alt="${r.title}" />`
    : '';

  const ingredientsHtml = (r.ingredients || []).map(i => `<li>${i}</li>`).join('');
  const stepsHtml = (r.steps || []).map((s, idx) => `
    <div class="step">
      <div class="step-num">${idx + 1}</div>
      <div class="step-text">${s}</div>
    </div>`).join('');

  const tagsHtml   = (r.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
  const typeLabel   = r.type   || r.meal   || '';
  const methodLabel = r.method || '';

  const sourceHtml = (r.source_label || r.source_url)
    ? `<div class="modal-source">Источник: <a href="${r.source_url || '#'}" target="_blank" rel="noopener">${r.source_label || r.source_url}</a></div>`
    : '';

  modalContent.innerHTML = `
    ${imageHtml}
    <div class="modal-meta">
      ${typeLabel   ? `<span class="badge-meal">${typeLabel}</span>`     : ''}
      ${methodLabel ? `<span class="badge-method">${methodLabel}</span>` : ''}
      ${r.time_minutes ? `<span class="badge-time">⏱ ${r.time_minutes} мин</span>` : ''}
    </div>
    <div class="modal-title">${r.title}</div>
    ${ingredientsHtml ? `<div class="modal-section-title">Ингредиенты</div><ul class="ingredients-list">${ingredientsHtml}</ul>` : ''}
    ${stepsHtml ? `<div class="modal-section-title">Приготовление</div><div class="modal-steps">${stepsHtml}</div>` : ''}
    ${tagsHtml ? `<div class="modal-tags">${tagsHtml}</div>` : ''}
    ${sourceHtml}`;

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
