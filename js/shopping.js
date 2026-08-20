// ═══════════════════════════════════════════════════════════════════════
//  СПИСОК ПОКУПОК
//  Сохраняется в localStorage, группируется по рецептам
// ═══════════════════════════════════════════════════════════════════════

(function () {
  const STORAGE_KEY = 'cooklog_shopping';

  // Структура: { recipeId: { title, items: [{ text, checked }] } }
  function loadList() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function saveList(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    updateBadge();
  }

  // ─── Добавить рецепт в список ─────────────────────────────
  window.addRecipeToShopping = function (recipe) {
    const list = loadList();
    const id   = String(recipe.id);

    if (list[id]) {
      // уже есть — убираем (toggle)
      delete list[id];
      saveList(list);
      return false; // removed
    }

    list[id] = {
      title: recipe.title,
      items: (recipe.ingredients || []).map(text => ({ text, checked: false })),
    };
    saveList(list);
    return true; // added
  };

  // ─── Добавить пункт вручную (не из рецепта) ───────────────
  const MANUAL_KEY = '_manual';

  window.addManualShoppingItem = function (text) {
    text = String(text || '').trim();
    if (!text) return;
    const list = loadList();
    if (!list[MANUAL_KEY]) list[MANUAL_KEY] = { title: 'Другое', items: [] };
    list[MANUAL_KEY].items.push({ text, checked: false });
    saveList(list);
  };

  window.isInShopping = function (recipeId) {
    return !!loadList()[String(recipeId)];
  };

  // ─── Бейдж в навигации ───────────────────────────────────
  function updateBadge() {
    const badge = document.getElementById('shopping-badge');
    if (!badge) return;
    const count = Object.keys(loadList()).length;
    badge.textContent = count;
    badge.classList.toggle('visible', count > 0);
  }

  // ─── Рендер модалки ──────────────────────────────────────
  function renderShoppingModal() {
    const list = loadList();
    const body = document.getElementById('shopping-modal-body');
    const keys = Object.keys(list);

    if (!keys.length) {
      body.innerHTML = `
        <div class="shopping-empty">
          <span class="shopping-empty-icon">🛒</span>
          Список пуст — добавь рецепт через кнопку в модалке рецепта
        </div>`;
      return;
    }

    body.innerHTML = keys.map(id => {
      const section = list[id];
      const itemsHtml = section.items.map((item, idx) => `
        <div class="shopping-item ${item.checked ? 'checked' : ''}" data-recipe="${escapeHtml(id)}" data-idx="${idx}">
          <input type="checkbox" ${item.checked ? 'checked' : ''} />
          <span>${escapeHtml(item.text)}</span>
          <button class="shopping-item-del" data-recipe="${escapeHtml(id)}" data-idx="${idx}" title="Удалить">✕</button>
        </div>`).join('');

      return `
        <div class="shopping-recipe-section" data-recipe="${escapeHtml(id)}">
          <div class="shopping-recipe-name">
            ${escapeHtml(section.title)}
            <button class="shopping-remove-recipe" data-recipe="${escapeHtml(id)}">Удалить раздел</button>
          </div>
          ${itemsHtml}
        </div>`;
    }).join('');

    // чекбоксы
    body.querySelectorAll('.shopping-item').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.shopping-item-del')) return;
        const { recipe, idx } = row.dataset;
        const list2 = loadList();
        list2[recipe].items[idx].checked = !list2[recipe].items[idx].checked;
        saveList(list2);
        renderShoppingModal();
      });
    });

    // удалить один пункт
    body.querySelectorAll('.shopping-item-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const { recipe, idx } = btn.dataset;
        const list2 = loadList();
        list2[recipe].items.splice(Number(idx), 1);
        if (!list2[recipe].items.length) delete list2[recipe];
        saveList(list2);
        renderShoppingModal();
      });
    });

    // удалить весь раздел рецепта
    body.querySelectorAll('.shopping-remove-recipe').forEach(btn => {
      btn.addEventListener('click', () => {
        const { recipe } = btn.dataset;
        const list2 = loadList();
        delete list2[recipe];
        saveList(list2);
        renderShoppingModal();
      });
    });
  }

  // ─── Открыть/закрыть модалку ─────────────────────────────
  const shoppingOverlay = document.getElementById('shopping-overlay');
  let releaseShoppingFocus = null;

  window.openShoppingList = function () {
    renderShoppingModal();
    shoppingOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    releaseShoppingFocus = window.trapFocus?.(shoppingOverlay, closeShoppingList);
  };

  function closeShoppingList() {
    shoppingOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    releaseShoppingFocus?.();
    releaseShoppingFocus = null;
  }

  document.getElementById('shopping-close').addEventListener('click', closeShoppingList);
  shoppingOverlay.addEventListener('click', e => { if (e.target === shoppingOverlay) closeShoppingList(); });

  document.getElementById('shopping-clear-btn').addEventListener('click', () => {
    if (!confirm('Очистить весь список покупок?')) return;
    saveList({});
    renderShoppingModal();
  });

  // ручное добавление пункта
  const shoppingAddInput = document.getElementById('shopping-add-input');
  const shoppingAddBtn   = document.getElementById('shopping-add-btn');

  function submitManualItem() {
    if (!shoppingAddInput.value.trim()) return;
    window.addManualShoppingItem(shoppingAddInput.value);
    shoppingAddInput.value = '';
    renderShoppingModal();
    shoppingAddInput.focus();
  }

  shoppingAddBtn?.addEventListener('click', submitManualItem);
  shoppingAddInput?.addEventListener('keydown', e => { if (e.key === 'Enter') submitManualItem(); });

  // nav-кнопка
  document.getElementById('shopping-nav-btn').addEventListener('click', openShoppingList);

  // инит бейджа
  updateBadge();
})();
