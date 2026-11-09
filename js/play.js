// Drawing and input for each test. mount() shows the puzzle and collects a guess;
// reveal() redraws it with the real answer next to the guess.
import { BOX, trackY, trackPath, error } from './rounds.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}

let boards = 0;

// The playing box. Anything drawn into svg.inside is clipped to its rounded corners.
function board(stage) {
  const svg = svgEl('svg', { viewBox: `0 0 ${BOX.w} ${BOX.h}`, class: 'board', role: 'img' });
  const id = `clip-${++boards}`;
  const box = { x: 1, y: 1, width: BOX.w - 2, height: BOX.h - 2, rx: 12 };
  svgEl('rect', box, svgEl('clipPath', { id }, svgEl('defs', {}, svg)));
  svgEl('rect', { ...box, class: 's-box' }, svg);
  svg.inside = svgEl('g', { 'clip-path': `url(#${id})` }, svg);
  stage.append(svg);
  return svg;
}

function text(svg, x, y, value, cls = 's-label') {
  const t = svgEl('text', { x, y, class: cls }, svg);
  t.textContent = value;
  return t;
}

// Pointer position in board units, whatever size the board is drawn at.
function toBoard(svg, e) {
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
}

// Calls onPoint while the pointer is pressed (or on a tap); arrow keys call onKey(step).
function drag(svg, onPoint, onKey) {
  let down = false;
  const move = (e) => { if (down) onPoint(toBoard(svg, e)); };
  svg.addEventListener('pointerdown', (e) => {
    down = true;
    svg.setPointerCapture(e.pointerId);
    onPoint(toBoard(svg, e));
  });
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', () => { down = false; });
  svg.addEventListener('pointercancel', () => { down = false; });
  svg.tabIndex = 0;
  svg.addEventListener('keydown', (e) => {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (step) { e.preventDefault(); onKey(e.shiftKey ? step * 10 : step); }
  });
}

const rad = (deg) => (deg * Math.PI) / 180;
const pct = (x) => `${Math.round(x * 100)}%`;

function ray(svg, pivot, worldDeg, len, cls) {
  const x = pivot.x + Math.cos(rad(worldDeg)) * len;
  const y = pivot.y - Math.sin(rad(worldDeg)) * len;
  return svgEl('line', { x1: pivot.x, y1: pivot.y, x2: x, y2: y, class: cls }, svg);
}

function setRay(line, pivot, worldDeg, len) {
  line.setAttribute('x2', pivot.x + Math.cos(rad(worldDeg)) * len);
  line.setAttribute('y2', pivot.y - Math.sin(rad(worldDeg)) * len);
}

// Arc from the baseline, counter-clockwise by deg.
function arc(svg, pivot, base, deg, r, cls) {
  const a = rad(base), b = rad(base + deg);
  const d = `M ${pivot.x + Math.cos(a) * r} ${pivot.y - Math.sin(a) * r} A ${r} ${r} 0 ${deg > 180 ? 1 : 0} 0 ${pivot.x + Math.cos(b) * r} ${pivot.y - Math.sin(b) * r}`;
  return svgEl('path', { d, class: cls }, svg);
}

const ANGLE_LEN = { easy: 130, normal: 130, hard: 135 };
// On hard the dark line is shorter, so you can't just compare line ends.
const baseLen = (pz) => (pz.difficulty === 'hard' ? 70 : ANGLE_LEN[pz.difficulty]);

export const TESTS = {
  count: {
    name: 'Count',
    how: 'Dots flash for a moment. Guess how many there were.',
    ask: (pz) => `How many dots? You get ${(pz.showMs / 1000).toFixed(1)} seconds.`,
    mount(stage, pz, { ready, submit }) {
      const svg = board(stage);
      const dots = svgEl('g', {}, svg);
      for (const d of pz.dots) svgEl('circle', { cx: d.x, cy: d.y, r: d.r, class: 's-dot' }, dots);
      const form = document.createElement('form');
      form.className = 'count-form';
      form.innerHTML = '<label class="sr-only" for="count-guess">Your guess</label><input id="count-guess" class="text-input count-input" type="number" inputmode="numeric" min="0" max="999" placeholder="Watch…" disabled autocomplete="off">';
      stage.append(form);
      const input = form.querySelector('input');
      const timer = setTimeout(() => {
        dots.remove();
        text(svg, BOX.w / 2, BOX.h / 2, '?', 's-big');
        input.disabled = false;
        input.placeholder = 'Your guess';
        input.focus();
      }, pz.showMs);
      const value = () => (/^\d{1,3}$/.test(input.value) ? Number(input.value) : null);
      input.addEventListener('input', () => ready(value() !== null));
      form.addEventListener('submit', (e) => { e.preventDefault(); if (value() !== null) submit(); });
      return { guess: value, destroy: () => clearTimeout(timer) };
    },
    reveal(stage, pz, guess) {
      const svg = board(stage);
      for (const d of pz.dots) svgEl('circle', { cx: d.x, cy: d.y, r: d.r, class: 's-dot dim' }, svg);
      return [['Dots', pz.answer], ['You said', guess ?? '–']];
    },
  },

  track: {
    name: 'Track',
    how: 'A ball flies right, bouncing off the top and bottom, and vanishes into the fog. Mark where it hits the right wall.',
    ask: () => 'Where will the ball hit the right wall?',
    mount(stage, pz, { ready, hint }) {
      const svg = board(stage);
      svgEl('rect', { x: pz.visibleX, y: 0, width: BOX.w - pz.visibleX, height: BOX.h, class: 's-fog' }, svg.inside);
      svgEl('line', { x1: BOX.w - 6, y1: 16, x2: BOX.w - 6, y2: BOX.h - 16, class: 's-wall' }, svg);
      const ball = svgEl('circle', { cx: pz.x0, cy: pz.y0, r: pz.ballR, class: 's-ball' }, svg);
      const mark = svgEl('g', { class: 's-you', visibility: 'hidden' }, svg);
      svgEl('line', { x1: pz.wallX - 22, y1: 0, x2: pz.wallX + pz.ballR, y2: 0 }, mark);
      svgEl('circle', { cx: pz.wallX, cy: 0, r: pz.ballR }, mark);
      let y = null, armed = false, raf = 0;
      const begin = performance.now() + 700;
      const frame = (now) => {
        const x = pz.x0 + (pz.speed * Math.max(0, now - begin)) / 1000;
        if (x >= pz.visibleX) {
          ball.remove();
          armed = true;
          svg.classList.add('aim');
          hint('Tap the right wall where it lands, then lock in.');
          return;
        }
        ball.setAttribute('cx', x);
        ball.setAttribute('cy', trackY(pz, x));
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      const place = (v) => {
        if (!armed) return;
        y = Math.min(BOX.h - pz.ballR, Math.max(pz.ballR, v));
        mark.setAttribute('transform', `translate(0 ${y})`);
        mark.setAttribute('visibility', 'visible');
        ready(true);
      };
      drag(svg, (p) => place(p.y), (step) => place((y ?? BOX.h / 2) - step));
      return { guess: () => y, destroy: () => cancelAnimationFrame(raf) };
    },
    reveal(stage, pz, guess) {
      const svg = board(stage);
      svgEl('polyline', { points: trackPath(pz).map((p) => p.join(',')).join(' '), class: 's-path' }, svg);
      svgEl('circle', { cx: pz.x0, cy: pz.y0, r: pz.ballR, class: 's-ball dim' }, svg);
      if (guess !== null) {
        svgEl('line', { x1: pz.wallX, y1: guess, x2: pz.wallX, y2: pz.answer, class: 's-gap' }, svg);
        svgEl('circle', { cx: pz.wallX, cy: guess, r: pz.ballR, class: 's-you-dot' }, svg);
      }
      svgEl('circle', { cx: pz.wallX, cy: pz.answer, r: pz.ballR, class: 's-true-dot' }, svg);
      return [['Off by', guess === null ? '–' : `${pct(error(pz, guess))} of the wall`]];
    },
  },

  angle: {
    name: 'Angle',
    how: 'Drag the blue line until the angle between it and the dark line matches the target. Either side works.',
    ask: (pz) => `Make a ${pz.target}° angle`,
    mount(stage, pz, { ready }) {
      const svg = board(stage);
      const len = ANGLE_LEN[pz.difficulty];
      ray(svg, pz.pivot, pz.baseline, baseLen(pz), 's-ray');
      let a = pz.start;
      const mine = ray(svg, pz.pivot, pz.baseline + a, len, 's-ray you');
      const knob = svgEl('circle', { r: 11, class: 's-knob' }, svg);
      svgEl('circle', { cx: pz.pivot.x, cy: pz.pivot.y, r: 5, class: 's-pivot' }, svg);
      const draw = () => {
        setRay(mine, pz.pivot, pz.baseline + a, len);
        knob.setAttribute('cx', mine.getAttribute('x2'));
        knob.setAttribute('cy', mine.getAttribute('y2'));
      };
      draw();
      svg.classList.add('aim');
      drag(svg, (p) => {
        if (Math.hypot(p.x - pz.pivot.x, p.y - pz.pivot.y) < 8) return;
        const world = (Math.atan2(pz.pivot.y - p.y, p.x - pz.pivot.x) * 180) / Math.PI;
        a = (((world - pz.baseline) % 360) + 360) % 360;
        draw();
        ready(true);
      }, (step) => { a = (((a + step) % 360) + 360) % 360; draw(); ready(true); });
      return { guess: () => Math.round((a > 180 ? a - 360 : a) * 10) / 10, destroy() {} };
    },
    reveal(stage, pz, guess) {
      const svg = board(stage);
      const len = ANGLE_LEN[pz.difficulty];
      const side = guess !== null && guess < 0 ? -1 : 1;   // show the answer on the side they used
      arc(svg, pz.pivot, side > 0 ? pz.baseline : pz.baseline - pz.target, pz.target, 42, 's-arc');
      ray(svg, pz.pivot, pz.baseline, baseLen(pz), 's-ray');
      ray(svg, pz.pivot, pz.baseline + side * pz.target, len, 's-ray true');
      if (guess !== null) ray(svg, pz.pivot, pz.baseline + guess, len, 's-ray you');
      svgEl('circle', { cx: pz.pivot.x, cy: pz.pivot.y, r: 5, class: 's-pivot' }, svg);
      return [['Target', `${pz.target}°`], ['You made', guess === null ? '–' : `${Math.round(Math.abs(guess))}°`]];
    },
  },

  split: {
    name: 'Split',
    how: 'Mark the point that sits the given fraction of the way along the line, starting from the round end.',
    ask: (pz) => `Mark ${pz.label} of the way along`,
    mount(stage, pz, { ready }) {
      const svg = board(stage);
      drawLine(svg, pz);
      const mark = svgEl('g', { class: 's-you', visibility: 'hidden' }, svg);
      const nx = -(pz.b.y - pz.a.y), ny = pz.b.x - pz.a.x, nl = Math.hypot(nx, ny);
      svgEl('line', { x1: (-nx / nl) * 16, y1: (-ny / nl) * 16, x2: (nx / nl) * 16, y2: (ny / nl) * 16 }, mark);
      let t = null;
      const place = (v) => {
        t = Math.min(1, Math.max(0, v));
        const x = pz.a.x + (pz.b.x - pz.a.x) * t, y = pz.a.y + (pz.b.y - pz.a.y) * t;
        mark.setAttribute('transform', `translate(${x} ${y})`);
        mark.setAttribute('visibility', 'visible');
        ready(true);
      };
      const ux = pz.b.x - pz.a.x, uy = pz.b.y - pz.a.y, uu = ux * ux + uy * uy;
      svg.classList.add('aim');
      drag(svg, (p) => place(((p.x - pz.a.x) * ux + (p.y - pz.a.y) * uy) / uu), (step) => place((t ?? 0.5) + step / 200));
      return { guess: () => (t === null ? null : Math.round(t * 1000) / 1000), destroy() {} };
    },
    reveal(stage, pz, guess) {
      const svg = board(stage);
      drawLine(svg, pz);
      const at = (t) => [pz.a.x + (pz.b.x - pz.a.x) * t, pz.a.y + (pz.b.y - pz.a.y) * t];
      const [tx, ty] = at(pz.answer);
      if (guess !== null) {
        const [gx, gy] = at(guess);
        svgEl('circle', { cx: gx, cy: gy, r: 8, class: 's-you-dot' }, svg);
      }
      svgEl('circle', { cx: tx, cy: ty, r: 8, class: 's-true-dot' }, svg);
      return [['Target', `${pz.label}${pz.percent ? '' : ` (${pct(pz.answer)})`}`], ['You marked', guess === null ? '–' : pct(guess)]];
    },
  },
};

function drawLine(svg, pz) {
  svgEl('line', { x1: pz.a.x, y1: pz.a.y, x2: pz.b.x, y2: pz.b.y, class: 's-line' }, svg);
  svgEl('circle', { cx: pz.a.x, cy: pz.a.y, r: 6, class: 's-end start' }, svg);
  svgEl('rect', { x: pz.b.x - 3, y: pz.b.y - 9, width: 6, height: 18, rx: 2, class: 's-end', transform: `rotate(${(Math.atan2(pz.b.y - pz.a.y, pz.b.x - pz.a.x) * 180) / Math.PI} ${pz.b.x} ${pz.b.y})` }, svg);
}
