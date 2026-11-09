// Guesstimate. Practice mode: screens, round loop and results.
import { KINDS, makeSet, randomSeed, score, verdict } from './rounds.js';
import { TESTS } from './play.js';

const $ = (id) => document.getElementById(id);
const screens = ['home', 'play', 'summary'];
const show = (id) => screens.forEach((s) => { $(s).hidden = s !== id; });

// ---------- Per-viewer memory (optional: private windows may block it) ----------

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(`guesstimate.${key}`)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`guesstimate.${key}`, JSON.stringify(value)); } catch { /* not saved */ }
  },
};

// ---------- Home ----------

const prefs = store.get('prefs', { difficulty: 'normal', kinds: KINDS, laps: 1 });

function renderHome() {
  document.querySelectorAll('#difficulty button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === prefs.difficulty)));
  document.querySelectorAll('#kinds input').forEach((i) => { i.checked = prefs.kinds.includes(i.value); });
  $('laps').value = String(prefs.laps);
  $('start-btn').disabled = prefs.kinds.length === 0;
  const best = store.get('best', {})[prefs.difficulty];
  $('best-line').textContent = best ? `Your best ${prefs.difficulty} average: ${best}` : '';
}

$('kinds').innerHTML = KINDS.map((k) => `
  <label class="chip"><input type="checkbox" value="${k}"><span><b>${TESTS[k].name}</b><small>${TESTS[k].how}</small></span></label>`).join('');

$('difficulty').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  prefs.difficulty = b.dataset.value;
  store.set('prefs', prefs);
  renderHome();
});
$('kinds').addEventListener('change', () => {
  prefs.kinds = KINDS.filter((k) => document.querySelector(`#kinds input[value="${k}"]`).checked);
  store.set('prefs', prefs);
  renderHome();
});
$('laps').addEventListener('change', (e) => {
  prefs.laps = Number(e.target.value);
  store.set('prefs', prefs);
});
$('start-btn').addEventListener('click', () => startGame());

// ---------- Round loop ----------

let game = null;   // { rounds, index, results, difficulty }
let live = null;   // the mounted test's controller

function startGame() {
  game = { rounds: makeSet(randomSeed(), prefs.kinds, prefs.laps, prefs.difficulty), index: 0, results: [], difficulty: prefs.difficulty };
  show('play');
  intro();
}

function stopLive() {
  if (live) live.destroy();
  live = null;
}

function header(pz) {
  $('play-round').textContent = `Round ${game.index + 1} of ${game.rounds.length}`;
  $('play-kind').textContent = TESTS[pz.kind].name;
  $('play-ask').textContent = TESTS[pz.kind].ask(pz);
  $('progress').style.setProperty('--done', game.index / game.rounds.length);
}

function intro() {
  const pz = game.rounds[game.index];
  header(pz);
  $('stage').replaceChildren();
  $('result').hidden = true;
  $('play-hint').textContent = TESTS[pz.kind].how;
  $('lock-btn').hidden = true;
  $('go-btn').hidden = false;
  $('go-btn').focus();
}

function go() {
  const pz = game.rounds[game.index];
  $('go-btn').hidden = true;
  $('lock-btn').hidden = false;
  $('lock-btn').disabled = true;
  $('play-hint').textContent = '';
  live = TESTS[pz.kind].mount($('stage'), pz, {
    ready: (ok) => { $('lock-btn').disabled = !ok; },
    hint: (msg) => { $('play-hint').textContent = msg; },
    submit: lockIn,
  });
}

function lockIn() {
  if (!live || $('lock-btn').disabled) return;
  const pz = game.rounds[game.index];
  const guess = live.guess();
  stopLive();
  const points = score(pz, guess);
  game.results.push({ kind: pz.kind, guess, points });

  $('lock-btn').hidden = true;
  $('play-hint').textContent = '';
  $('stage').replaceChildren();
  const facts = TESTS[pz.kind].reveal($('stage'), pz, guess);
  $('result-score').textContent = points;
  $('result-score').className = `result-score ${band(points)}`;
  $('result-verdict').textContent = verdict(points);
  $('result-legend').hidden = pz.kind === 'count';
  $('result-facts').innerHTML = facts.map(([k, v]) => `<li><span class="muted">${k}</span> <b>${v}</b></li>`).join('');
  const last = game.index === game.rounds.length - 1;
  $('next-btn').textContent = last ? 'See results' : 'Next round';
  $('result').hidden = false;
  $('progress').style.setProperty('--done', (game.index + 1) / game.rounds.length);
  $('next-btn').focus();
}

function next() {
  if (game.index < game.rounds.length - 1) {
    game.index++;
    intro();
  } else {
    summary();
  }
}

const band = (p) => (p >= 80 ? 'good' : p >= 50 ? 'okay' : 'poor');

$('go-btn').addEventListener('click', go);
$('lock-btn').addEventListener('click', lockIn);
$('next-btn').addEventListener('click', next);
$('quit-btn').addEventListener('click', () => { stopLive(); game = null; renderHome(); show('home'); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || $('play').hidden || e.target.tagName === 'INPUT') return;
  if (!$('go-btn').hidden) go();
  else if (!$('lock-btn').hidden) lockIn();
});

// ---------- Summary ----------

function summary() {
  const { results, difficulty } = game;
  const avg = Math.round(results.reduce((n, r) => n + r.points, 0) / results.length);
  const best = store.get('best', {});
  const isBest = !best[difficulty] || avg > best[difficulty];
  if (isBest) store.set('best', { ...best, [difficulty]: avg });

  $('sum-score').textContent = avg;
  $('sum-score').className = `sum-score ${band(avg)}`;
  $('sum-verdict').textContent = verdict(avg);
  $('sum-note').textContent = isBest ? `New personal best on ${difficulty}!` : `Your best on ${difficulty}: ${best[difficulty]}`;
  $('sum-rounds').innerHTML = results.map((r, i) => `
    <li><span class="sum-n muted">${i + 1}</span><span class="sum-k">${TESTS[r.kind].name}</span>
      <span class="bar"><i class="${band(r.points)}" style="--w:${r.points}%"></i></span><b>${r.points}</b></li>`).join('');
  show('summary');
  $('again-btn').focus();
}

$('again-btn').addEventListener('click', () => startGame());
$('home-btn').addEventListener('click', () => { renderHome(); show('home'); });

renderHome();
show('home');
