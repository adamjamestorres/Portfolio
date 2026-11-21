// Animated topographic contour lines behind the intro.
// A smooth 3D noise field (x, y, time) is traced with marching squares.
(() => {
  const canvas = document.querySelector(".contours");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // ---------- Noise ----------
  const perm = new Uint8Array(512);
  let seed = 20251120;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (x, y, z) => perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255;

  function noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
      w
    );
  }

  const field = (x, y, t) =>
    noise(x, y, t) * 0.65 + noise(x * 2.1 + 17, y * 2.1 + 9, t * 1.3) * 0.35;

  // ---------- Sizing ----------
  const CELL = 14; // px per grid cell
  const SCALE = 0.0042; // noise units per px
  const LEVELS = 14;
  let w = 0, h = 0, cols = 0, rows = 0, grid = new Float32Array(0);
  let line = "", strong = "";

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    line = s.getPropertyValue("--contour").trim();
    strong = s.getPropertyValue("--contour-strong").trim();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL) + 1;
    rows = Math.ceil(h / CELL) + 1;
    grid = new Float32Array(cols * rows);
  }

  // ---------- Draw ----------
  function draw(t) {
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        grid[j * cols + i] = field(i * CELL * SCALE, j * CELL * SCALE, t);

    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = "round";

    for (let l = 1; l < LEVELS; l++) {
      const iso = 0.2 + (l / LEVELS) * 0.6;
      const index = l % 4 === 0;
      ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = grid[j * cols + i];
          const b = grid[j * cols + i + 1];
          const c = grid[(j + 1) * cols + i + 1];
          const d = grid[(j + 1) * cols + i];
          const k = (a > iso) | ((b > iso) << 1) | ((c > iso) << 2) | ((d > iso) << 3);
          if (k === 0 || k === 15) continue;

          const x = i * CELL, y = j * CELL;
          const top = [x + CELL * ((iso - a) / (b - a)), y];
          const right = [x + CELL, y + CELL * ((iso - b) / (c - b))];
          const bottom = [x + CELL * ((iso - d) / (c - d)), y + CELL];
          const left = [x, y + CELL * ((iso - a) / (d - a))];
          const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };

          switch (k) {
            case 1: case 14: seg(left, top); break;
            case 2: case 13: seg(top, right); break;
            case 3: case 12: seg(left, right); break;
            case 4: case 11: seg(right, bottom); break;
            case 5: seg(left, top); seg(right, bottom); break;
            case 6: case 9: seg(top, bottom); break;
            case 7: case 8: seg(left, bottom); break;
            case 10: seg(left, bottom); seg(top, right); break;
          }
        }
      }
      ctx.strokeStyle = index ? strong : line;
      ctx.lineWidth = index ? 1.25 : 0.75;
      ctx.stroke();
    }
  }

  // ---------- Loop ----------
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  let visible = true, last = 0, t = 0, raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30fps is plenty for slow drift
    t += ((now - last) / 1000) * 0.045;
    last = now;
    draw(t);
  }

  function start() {
    cancelAnimationFrame(raf);
    draw(t);
    if (!reduce.matches && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  readColors();
  resize();
  start();

  new ResizeObserver(() => { resize(); draw(t); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(canvas);
  document.addEventListener("visibilitychange", start);
  reduce.addEventListener("change", start);
  dark.addEventListener("change", () => { readColors(); draw(t); });
})();
