/* ============================================================
   VELA · 主题 & 背景动画
   ============================================================ */
(function() {
  const { storage } = window.VELA_UTIL;

  // ----- Background canvas for theme A (stars + dust) -----
  let canvas, ctx, stars = [], dust = [], raf;
  function initStarsCanvas() {
    canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    seedStars();
    seedDust();
    loop();
  }
  function resize() {
    if (!canvas) return;
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  function seedStars() {
    stars = [];
    const n = 300;
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 * devicePixelRatio,
        v: (0.15 + Math.random() * 0.4) * devicePixelRatio,
        tw: Math.random() * Math.PI * 2,
        ts: 0.02 + Math.random() * 0.03
      });
    }
  }
  function seedDust() {
    dust = [];
    for (let i = 0; i < 26; i++) {
      dust.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (1 + Math.random() * 2.4) * devicePixelRatio,
        dx: (Math.random() - 0.5) * 0.18 * devicePixelRatio,
        dy: -(0.15 + Math.random() * 0.25) * devicePixelRatio,
        a: 0.15 + Math.random() * 0.35
      });
    }
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (window.VELA.isPaused) return;
    const theme = document.body.getAttribute('data-theme');
    if (theme !== 'A') { ctx.clearRect(0,0,canvas.width,canvas.height); return; }
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // stars
    for (const s of stars) {
      s.y -= s.v;
      s.tw += s.ts;
      if (s.y < -5) { s.y = canvas.height + 5; s.x = Math.random() * canvas.width; }
      const a = 0.4 + Math.sin(s.tw) * 0.4;
      ctx.fillStyle = `rgba(240,234,216,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    }
    // dust
    for (const d of dust) {
      d.x += d.dx; d.y += d.dy;
      if (d.y < -5) { d.y = canvas.height + 5; d.x = Math.random() * canvas.width; }
      const grd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 6);
      grd.addColorStop(0, `rgba(255,224,140,${d.a})`);
      grd.addColorStop(1, 'rgba(255,224,140,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 6, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // ----- Theme switching -----
  function applyTheme(t) {
    document.body.setAttribute('data-theme', t);
    window.VELA.currentTheme = t;
    storage.set('vela_theme', t);
    // update theme swatches
    document.querySelectorAll('.theme-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.t === t);
    });
  }

  // ----- Mandala SVG -----
  function buildMandala() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('mandala-svg');
    if (!svg || svg.firstChild) return;
    svg.setAttribute('viewBox', '-100 -100 200 200');

    // L1 outer: 8 directions short lines + 4 diamonds
    const l1 = document.createElementNS(ns, 'g'); l1.setAttribute('class','layer l1');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x1 = Math.cos(a) * 78, y1 = Math.sin(a) * 78;
      const x2 = Math.cos(a) * 92, y2 = Math.sin(a) * 92;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', 'var(--accent-glow)'); line.setAttribute('stroke-width', '1');
      l1.appendChild(line);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = Math.cos(a) * 85, cy = Math.sin(a) * 85;
      const d = document.createElementNS(ns, 'rect');
      d.setAttribute('x', cx - 2); d.setAttribute('y', cy - 2);
      d.setAttribute('width', 4); d.setAttribute('height', 4);
      d.setAttribute('transform', `rotate(45 ${cx} ${cy})`);
      d.setAttribute('fill', 'none'); d.setAttribute('stroke', 'var(--accent-glow)');
      d.setAttribute('stroke-width', '0.7');
      l1.appendChild(d);
    }
    svg.appendChild(l1);

    // L2 mid: dashed circle + 12-point star + 4 small dots
    const l2 = document.createElementNS(ns, 'g'); l2.setAttribute('class','layer l2');
    const dashed = document.createElementNS(ns, 'circle');
    dashed.setAttribute('cx', 0); dashed.setAttribute('cy', 0); dashed.setAttribute('r', 65);
    dashed.setAttribute('fill', 'none'); dashed.setAttribute('stroke', 'var(--accent-glow)');
    dashed.setAttribute('stroke-width', '0.7'); dashed.setAttribute('stroke-dasharray', '2 3');
    l2.appendChild(dashed);
    // 12-point star
    const points = [];
    for (let i = 0; i < 24; i++) {
      const r = i % 2 === 0 ? 55 : 35;
      const a = (i / 24) * Math.PI * 2;
      points.push(`${Math.cos(a)*r},${Math.sin(a)*r}`);
    }
    const star = document.createElementNS(ns, 'polygon');
    star.setAttribute('points', points.join(' '));
    star.setAttribute('fill', 'none'); star.setAttribute('stroke', 'var(--accent-glow)');
    star.setAttribute('stroke-width', '0.6');
    l2.appendChild(star);
    svg.appendChild(l2);

    // L3 inner: Flower of Life (6 overlapping circles around center)
    const l3 = document.createElementNS(ns, 'g'); l3.setAttribute('class','layer l3');
    const cCenter = document.createElementNS(ns, 'circle');
    cCenter.setAttribute('cx', 0); cCenter.setAttribute('cy', 0); cCenter.setAttribute('r', 14);
    cCenter.setAttribute('fill', 'none'); cCenter.setAttribute('stroke', 'var(--accent-glow)');
    cCenter.setAttribute('stroke-width', '0.7');
    l3.appendChild(cCenter);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', Math.cos(a) * 14); c.setAttribute('cy', Math.sin(a) * 14); c.setAttribute('r', 14);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'var(--accent-glow)');
      c.setAttribute('stroke-width', '0.7');
      l3.appendChild(c);
    }
    svg.appendChild(l3);

    // L4 core: cross + center dot
    const l4 = document.createElementNS(ns, 'g'); l4.setAttribute('class','layer l4');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', 0); line.setAttribute('y1', 0);
      line.setAttribute('x2', Math.cos(a) * 6); line.setAttribute('y2', Math.sin(a) * 6);
      line.setAttribute('stroke', 'var(--accent-lt)'); line.setAttribute('stroke-width', '1.2');
      l4.appendChild(line);
    }
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', 0); dot.setAttribute('cy', 0); dot.setAttribute('r', 2);
    dot.setAttribute('fill', 'var(--accent-lt)');
    l4.appendChild(dot);
    svg.appendChild(l4);
  }

  function showMandala(visible) {
    const m = document.getElementById('mandala');
    if (m) m.classList.toggle('visible', visible);
  }
  function setMandalaCharging(charging) {
    const m = document.getElementById('mandala');
    if (m) m.classList.toggle('charging', charging);
  }

  window.VELA_THEMES = { initStarsCanvas, applyTheme, buildMandala, showMandala, setMandalaCharging };
})();
