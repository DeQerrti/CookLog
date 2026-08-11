// ═══════════════════════════════════════════════════════════════════════
//  РЕЖИМ ГОТОВКИ
//  Полноэкранный пошаговый режим с Wake Lock и таймером
// ═══════════════════════════════════════════════════════════════════════

(function () {
  const overlay = document.getElementById('cooking-overlay');

  let steps       = [];
  let currentIdx  = 0;
  let wakeLock    = null;
  let releaseCookingFocus = null;

  // ─── Таймер ──────────────────────────────────────────────
  let timerInterval = null;
  let timerSeconds  = 0;
  let timerRunning  = false;

  function timerReset(seconds) {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning  = false;
    timerSeconds  = seconds;
    renderTimer();
  }

  function timerStart() {
    if (timerRunning || timerSeconds <= 0) return;
    timerRunning = true;
    timerInterval = setInterval(() => {
      timerSeconds--;
      if (timerSeconds <= 0) {
        timerSeconds = 0;
        clearInterval(timerInterval);
        timerRunning = false;
        document.querySelector('.cooking-timer-display').classList.add('done');
        navigator.vibrate?.([200, 100, 200, 100, 400]);
      }
      renderTimerDisplay();
    }, 1000);
    document.querySelector('.cooking-timer-display').classList.remove('done');
    document.querySelector('.cooking-timer-display').classList.add('running');
  }

  function timerPause() {
    clearInterval(timerInterval);
    timerRunning = false;
    document.querySelector('.cooking-timer-display')?.classList.remove('running');
  }

  function renderTimerDisplay() {
    const el = document.querySelector('.cooking-timer-display');
    if (!el) return;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const s = String(timerSeconds % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }

  function renderTimer() {
    const wrap = document.querySelector('.cooking-timer');
    if (!wrap) return;
    renderTimerDisplay();
    const startBtn = wrap.querySelector('.btn-timer-start');
    const pauseBtn = wrap.querySelector('.btn-timer-pause');
    if (startBtn) startBtn.style.display = timerRunning ? 'none' : '';
    if (pauseBtn) pauseBtn.style.display = timerRunning ? '' : 'none';
  }

  // ─── Парсим число минут из текста шага ───────────────────
  function extractMinutes(text) {
    const patterns = [
      /(\d+)\s*мин/i,
      /(\d+)\s*минут/i,
      /(\d+)\s*min/i,
      /(\d+)\s*час/i,  // часы → * 60
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const val = parseInt(m[1]);
        if (/час/i.test(p.source)) return val * 60;
        return val;
      }
    }
    return 0;
  }

  // ─── Рендер одного шага ──────────────────────────────────
  function renderStep() {
    const body = document.getElementById('cooking-body');
    const total = steps.length;

    // прогресс
    const fill = document.querySelector('.cooking-progress-fill');
    const counter = document.querySelector('.cooking-step-counter');
    if (fill) fill.style.width = `${((currentIdx + 1) / total) * 100}%`;
    if (counter) counter.textContent = `${currentIdx + 1} / ${total}`;

    // кнопки навигации
    document.getElementById('cook-prev').disabled = currentIdx === 0;
    const nextBtn = document.getElementById('cook-next');
    nextBtn.textContent = currentIdx === total - 1 ? '🏁 Готово!' : 'Дальше →';

    // финальный экран
    if (currentIdx >= total) {
      body.innerHTML = `
        <div class="cooking-finish">
          <span class="cooking-finish-icon">🎉</span>
          <div class="cooking-finish-title">Приятного аппетита!</div>
          <div class="cooking-finish-sub">Блюдо готово</div>
        </div>`;
      return;
    }

    const step = steps[currentIdx];
    const mins = extractMinutes(step);
    const secs = mins * 60;

    // сбрасываем таймер при смене шага
    timerReset(secs);

    const timerHtml = secs > 0 ? `
      <div class="cooking-timer">
        <div class="cooking-timer-display">${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}</div>
        <div class="cooking-timer-btns">
          <button class="btn-timer accent btn-timer-start">▶ Старт</button>
          <button class="btn-timer btn-timer-pause" style="display:none">⏸ Пауза</button>
          <button class="btn-timer btn-timer-reset">↺ Сброс</button>
        </div>
      </div>` : '';

    body.innerHTML = `
      <div class="cooking-step-num">${currentIdx + 1}</div>
      <div class="cooking-step-text">${step}</div>
      ${timerHtml}`;

    if (secs > 0) {
      body.querySelector('.btn-timer-start').addEventListener('click', timerStart);
      body.querySelector('.btn-timer-pause').addEventListener('click', () => { timerPause(); renderTimer(); });
      body.querySelector('.btn-timer-reset').addEventListener('click', () => { timerPause(); timerReset(secs); });
    }
  }

  // ─── Wake Lock ───────────────────────────────────────────
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* не критично */ }
  }

  function releaseWakeLock() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  // ─── Открыть / закрыть ───────────────────────────────────
  window.openCookingMode = function (recipe) {
    steps = (recipe.steps || []).filter(Boolean);
    if (!steps.length) return;

    currentIdx = 0;

    document.querySelector('.cooking-title').textContent = recipe.title;
    document.querySelector('.cooking-progress-fill').style.width = '0%';

    renderStep();
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    acquireWakeLock();
    releaseCookingFocus = window.trapFocus?.(overlay, closeCookingMode);
  };

  function closeCookingMode() {
    timerPause();
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    releaseWakeLock();
    releaseCookingFocus?.();
    releaseCookingFocus = null;
  }

  document.getElementById('cooking-close').addEventListener('click', closeCookingMode);

  document.getElementById('cook-prev').addEventListener('click', () => {
    if (currentIdx > 0) { currentIdx--; renderStep(); }
  });

  document.getElementById('cook-next').addEventListener('click', () => {
    if (currentIdx < steps.length - 1) {
      currentIdx++;
      renderStep();
    } else if (currentIdx === steps.length - 1) {
      // показываем финал
      timerPause();
      currentIdx = steps.length;
      const body = document.getElementById('cooking-body');
      body.innerHTML = `
        <div class="cooking-finish">
          <span class="cooking-finish-icon">🎉</span>
          <div class="cooking-finish-title">Приятного аппетита!</div>
          <div class="cooking-finish-sub">Блюдо готово</div>
        </div>`;
      document.querySelector('.cooking-progress-fill').style.width = '100%';
      document.querySelector('.cooking-step-counter').textContent = `${steps.length} / ${steps.length}`;
      document.getElementById('cook-next').textContent = '✕ Закрыть';
      document.getElementById('cook-next').onclick = closeCookingMode;
    }
  });

  // свайп влево/вправо
  let touchStartX = 0;
  overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && currentIdx < steps.length - 1) { currentIdx++; renderStep(); }
    if (dx > 0 && currentIdx > 0)                 { currentIdx--; renderStep(); }
  }, { passive: true });
})();
