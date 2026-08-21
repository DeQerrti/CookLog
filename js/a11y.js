// ═══════════════════════════════════════════════════════════════════════
//  ДОСТУПНОСТЬ: фокус-ловушка для модалок
//  Держит Tab/Shift+Tab внутри открытой модалки, закрывает по Esc,
//  возвращает фокус туда, откуда модалку открыли.
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  ЭКРАНИРОВАНИЕ HTML
//  Данные рецептов приходят из БД и вставляются через innerHTML — экранируем,
//  чтобы название/тег/шаг со спецсимволами не мог внедрить разметку/скрипт.
// ═══════════════════════════════════════════════════════════════════════
window.escapeHtml = function (s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
};

// Разрешаем в src/href только http(s)-ссылки — иначе (javascript:, data: и т.п.) возвращаем пустую строку.
window.safeUrl = function (u) {
  if (!u) return '';
  try {
    const url = new URL(String(u), window.location.origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : '';
  } catch {
    return '';
  }
};

// overlayEl — контейнер модалки (то, что показывается/прячется классом hidden)
// closeFn   — функция закрытия модалки, вызывается по Esc (необязательно)
// Возвращает функцию release() — вызвать сразу после закрытия модалки.
window.trapFocus = function (overlayEl, closeFn) {
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const previouslyFocused = document.activeElement;

  function getFocusable() {
    return [...overlayEl.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && closeFn) {
      closeFn();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = getFocusable();
    if (!focusable.length) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  overlayEl.addEventListener('keydown', onKeydown);

  const focusable = getFocusable();
  (focusable[0] || overlayEl).focus();

  return function release() {
    overlayEl.removeEventListener('keydown', onKeydown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };
};
