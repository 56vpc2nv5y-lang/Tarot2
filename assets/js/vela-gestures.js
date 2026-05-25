/* ============================================================
   VELA · 手势识别
   - MediaPipe Hands
   - hand cursor + trail
   - charge ring (0.8s for fist/palm-hover)
   - magnetic snap to center card
   - first-time onboarding
   - camera fallback toast
   ============================================================ */
(function() {
  const { $, storage } = window.VELA_UTIL;

  const CHARGE_MS = 800;
  let videoEl, mpHands, mpCamera;
  let camActive = false;
  let lastLandmarks = null;
  let lastLandmarksTime = 0;
  let chargeStart = 0;
  let chargeMode = null; // 'fist' or 'palm-hover'
  let chargeTargetIdx = -1;
  let lostSince = 0;
  let onChargeComplete = null;
  let cursorEl, ringEl, ringFg;
  let lastTrailTime = 0;

  function avgDist(lm) {
    return [8,12,16,20].reduce((s,i) =>
      s + Math.hypot(lm[i].x-lm[0].x, lm[i].y-lm[0].y), 0) / 4;
  }
  const isFist = lm => avgDist(lm) < 0.23;
  const isPalm = lm => avgDist(lm) > 0.40;

  function showTopToast(text) {
    let t = document.querySelector('.top-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'top-toast';
      document.body.appendChild(t);
    }
    t.textContent = text;
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => t.classList.remove('visible'), 3500);
  }

  function setStatus(text) {
    const s = document.getElementById('status-text');
    if (!s) return;
    if (s.textContent === text) return;
    s.classList.add('changing');
    setTimeout(() => {
      s.textContent = text;
      s.classList.remove('changing');
    }, 220);
  }

  function setCursorVisible(v) {
    if (cursorEl) cursorEl.classList.toggle('visible', v);
    if (ringEl) ringEl.classList.toggle('visible', v && chargeMode !== null);
  }

  function moveCursor(x, y) {
    if (!cursorEl) return;
    cursorEl.style.left = x + 'px';
    cursorEl.style.top = y + 'px';
    if (ringEl) {
      ringEl.style.left = x + 'px';
      ringEl.style.top = y + 'px';
    }
    // trail
    const now = performance.now();
    if (now - lastTrailTime > 40) {
      lastTrailTime = now;
      const t = document.createElement('div');
      t.className = 'trail-dot';
      t.style.left = x + 'px';
      t.style.top = y + 'px';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 500);
    }
  }

  function findNearestCardIndex(x, y) {
    // simplified: use horizontal position relative to scene to choose nearest of currently visible cards
    const carousel = document.querySelector('.carousel');
    if (!carousel) return -1;
    const cards = carousel.querySelectorAll('.carousel-card.center');
    if (cards[0]) {
      const r = cards[0].getBoundingClientRect();
      const cx = r.left + r.width/2;
      const dx = x - cx;
      // bias center
      const cur = window.VELA_CAROUSEL.getCenterIndex();
      // approx 64px per card visually
      const guess = cur + Math.round(dx / 64);
      return Math.max(0, Math.min(window.VELA.deck.length - 1, guess));
    }
    return -1;
  }

  function processHands(results) {
    if (window.VELA.isPaused) return;
    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      lastLandmarks = null;
      // graceful fade
      if (chargeStart && performance.now() - lostSince > 600) {
        chargeStart = 0;
        chargeMode = null;
        ringEl?.classList.add('fading');
        ringFg && (ringFg.style.strokeDashoffset = 176);
      }
      if (!lostSince) lostSince = performance.now();
      if (camActive && window.VELA.state === 'PICKING') {
        setStatus('请将手放入画面');
      }
      setCursorVisible(false);
      window.VELA_CAROUSEL.setLockedIndex(-1);
      return;
    }
    lostSince = 0;
    ringEl?.classList.remove('fading');
    const lm = results.multiHandLandmarks[0];
    lastLandmarks = lm;
    lastLandmarksTime = performance.now();

    // index tip (#8) drives the cursor; mirror x
    const x = (1 - lm[8].x) * innerWidth;
    const y = lm[8].y * innerHeight;
    setCursorVisible(true);
    moveCursor(x, y);

    if (window.VELA.state !== 'PICKING' && window.VELA.state !== 'INTERPRETING' && window.VELA.state !== 'IDLE') {
      // not in interactive state
      return;
    }

    // Detect gesture
    const fist = isFist(lm);
    const palm = isPalm(lm);

    if (window.VELA.state === 'PICKING') {
      // horizontal zones: left third / middle / right third
      const px = x / innerWidth;
      const cur = window.VELA_CAROUSEL.getCenterIndex();
      if (palm) {
        if (px < 0.33) {
          // scroll left
          window.VELA_CAROUSEL.scrollBy(-(0.33 - px) * 0.6);
          window.VELA_CAROUSEL.setLockedIndex(-1);
          chargeStart = 0; chargeMode = null;
          setRingProgress(0);
          setStatus('← 向左浏览');
        } else if (px > 0.67) {
          window.VELA_CAROUSEL.scrollBy((px - 0.67) * 0.6);
          window.VELA_CAROUSEL.setLockedIndex(-1);
          chargeStart = 0; chargeMode = null;
          setRingProgress(0);
          setStatus('向右浏览 →');
        } else {
          // middle zone → magnetic snap + charge
          const snapIdx = findNearestCardIndex(x, y);
          window.VELA_CAROUSEL.setLockedIndex(snapIdx >= 0 ? snapIdx : cur);
          // bounce when newly locked
          if (chargeTargetIdx !== snapIdx) {
            chargeTargetIdx = snapIdx;
            chargeStart = performance.now();
            chargeMode = 'palm-hover';
            cursorEl?.classList.add('locked');
          }
          const elapsed = performance.now() - chargeStart;
          const p = Math.min(1, elapsed / CHARGE_MS);
          setRingProgress(p);
          setStatus('握住选中此牌…');
          if (p >= 1) {
            chargeStart = 0; chargeMode = null;
            window.VELA_CAROUSEL.selectCenter();
            setRingProgress(0);
          }
        }
      } else if (fist) {
        // not used in PICKING for selection; could be cancel
        chargeStart = 0; chargeMode = null;
        cursorEl?.classList.remove('locked');
        setRingProgress(0);
      } else {
        chargeStart = 0; chargeMode = null;
        cursorEl?.classList.remove('locked');
        window.VELA_CAROUSEL.setLockedIndex(-1);
        setRingProgress(0);
        setStatus('张开手掌选牌');
      }
    } else if (window.VELA.state === 'IDLE' || window.VELA.state === 'INTERPRETING') {
      // fist 0.8s to start / trigger AI
      if (fist) {
        if (!chargeStart) { chargeStart = performance.now(); chargeMode = 'fist'; }
        const p = Math.min(1, (performance.now() - chargeStart) / CHARGE_MS);
        setRingProgress(p);
        if (p >= 1) {
          chargeStart = 0; chargeMode = null;
          setRingProgress(0);
          onChargeComplete?.();
        }
      } else {
        chargeStart = 0; chargeMode = null;
        setRingProgress(0);
      }
    }
  }

  function setRingProgress(p) {
    if (!ringFg) return;
    const total = 176;
    ringFg.style.strokeDashoffset = total - p * total;
    if (ringEl) ringEl.classList.toggle('visible', p > 0 && cursorEl?.classList.contains('visible'));
  }

  async function startCamera() {
    videoEl = document.createElement('video');
    videoEl.style.display = 'none';
    document.body.appendChild(videoEl);

    if (typeof Hands === 'undefined') {
      showTopToast('摄像头/手势库未加载，已切换为触摸/键盘 ✨');
      return false;
    }
    try {
      mpHands = new Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
      });
      mpHands.setOptions({
        maxNumHands: 1, modelComplexity: 0,
        minDetectionConfidence: 0.6, minTrackingConfidence: 0.5
      });
      mpHands.onResults(processHands);
      mpCamera = new Camera(videoEl, {
        onFrame: async () => {
          if (!window.VELA.isPaused) await mpHands.send({ image: videoEl });
        },
        width: 640, height: 480
      });
      await mpCamera.start();
      camActive = true;
      // preview if enabled
      const prev = document.getElementById('cam-preview');
      if (prev) {
        prev.querySelector('video')?.remove();
        prev.appendChild(videoEl);
        videoEl.style.display = window.VELA.prefs.cameraPreview ? 'block' : 'none';
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        prev.classList.toggle('visible', window.VELA.prefs.cameraPreview);
      }
      return true;
    } catch (e) {
      console.warn('Camera failed:', e);
      showTopToast('摄像头暂时不可用，已切换为触摸/点击模式 ✨');
      camActive = false;
      return false;
    }
  }

  function setCameraPreview(on) {
    const prev = document.getElementById('cam-preview');
    if (prev) {
      prev.classList.toggle('visible', on);
      if (videoEl) videoEl.style.display = on ? 'block' : 'none';
    }
  }

  function showOnboarding(force = false) {
    const seen = storage.get('vela_gesture_seen', false);
    if (seen && !force) return;
    const ob = document.getElementById('onboard');
    if (ob) ob.classList.add('visible');
  }
  function dismissOnboarding() {
    storage.set('vela_gesture_seen', true);
    document.getElementById('onboard')?.classList.remove('visible');
  }

  function initGestureUI() {
    cursorEl = document.createElement('div'); cursorEl.className = 'hand-cursor';
    document.body.appendChild(cursorEl);
    ringEl = document.createElement('div'); ringEl.className = 'charge-ring';
    ringEl.innerHTML = `<svg width="64" height="64" viewBox="0 0 64 64">
      <circle class="bg" cx="32" cy="32" r="28" stroke-width="3"/>
      <circle class="fg" cx="32" cy="32" r="28" stroke-width="3"/>
    </svg>`;
    document.body.appendChild(ringEl);
    ringFg = ringEl.querySelector('.fg');
  }

  function setOnChargeComplete(cb) { onChargeComplete = cb; }

  window.VELA_GESTURES = {
    initGestureUI, startCamera, setCameraPreview,
    showOnboarding, dismissOnboarding,
    setOnChargeComplete, showTopToast, setStatus
  };
})();
