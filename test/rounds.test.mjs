import * as R from '../js/rounds.js';
import assert from 'node:assert/strict';

let checked = 0;

// 1. Same seed, same puzzle; different seeds, different puzzles
for (const d of R.DIFFICULTIES) {
  for (const kind of R.KINDS) {
    const seen = new Set();
    for (let s = 1; s <= 300; s++) {
      const seed = R.roundSeed(12345, s, kind);
      const a = R.makeRound(kind, seed, d);
      assert.deepEqual(a, R.makeRound(kind, seed, d), `${kind}/${d} not deterministic`);
      seen.add(JSON.stringify({ ...a, seed: 0 }));
      checked++;
    }
    assert.ok(seen.size > 200, `${kind}/${d} repeats too often (${seen.size} unique of 300)`);
  }
}
const setA = R.makeSet(99, R.KINDS, 2, 'normal');
assert.deepEqual(setA, R.makeSet(99, R.KINDS, 2, 'normal'));
assert.deepEqual(setA.map((p) => p.kind), [...R.KINDS, ...R.KINDS]);
assert.notDeepEqual(setA, R.makeSet(100, R.KINDS, 2, 'normal'));

// 2. Puzzles are valid and stay inside the box
let rnd = R.mulberry32(7);
for (let i = 0; i < 3000; i++) {
  const d = R.DIFFICULTIES[i % 3];
  const seed = Math.floor(rnd() * 4294967296);

  const c = R.makeRound('count', seed, d);
  assert.equal(c.answer, c.dots.length);
  assert.ok(c.answer >= { easy: 8, normal: 20, hard: 50 }[d], `count too low: ${c.answer} (${d})`);
  for (const [j, p] of c.dots.entries()) {
    assert.ok(p.x - p.r >= 0 && p.x + p.r <= R.BOX.w && p.y - p.r >= 0 && p.y + p.r <= R.BOX.h);
    for (const q of c.dots.slice(j + 1)) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= p.r + q.r, 'dots overlap');
  }

  const t = R.makeRound('track', seed, d);
  assert.ok(t.answer >= t.ballR && t.answer <= R.BOX.h - t.ballR);
  assert.ok(t.visibleX > t.x0 && t.visibleX < t.wallX);
  // Step the ball like an animation would and check it lands where the formula says
  let y = t.y0, v = t.slope;
  const dx = 0.01;
  for (let x = t.x0; x < t.wallX - dx / 2; x += dx) {
    y += v * dx;
    if (y < t.ballR) { y = 2 * t.ballR - y; v = -v; }
    if (y > R.BOX.h - t.ballR) { y = 2 * (R.BOX.h - t.ballR) - y; v = -v; }
  }
  assert.ok(Math.abs(y - t.answer) < 0.5, `track answer ${t.answer} vs simulated ${y.toFixed(2)}`);
  const path = R.trackPath(t);
  assert.deepEqual(path[0], [t.x0, t.y0]);
  assert.ok(Math.abs(path.at(-1)[1] - t.answer) < 0.2);

  const a = R.makeRound('angle', seed, d);
  assert.ok(a.answer >= 3 && a.answer <= 177);
  if (d !== 'hard') assert.ok(a.answer >= 8 && a.answer <= 172);
  if (d === 'easy') assert.equal(a.answer % 15, 0);
  assert.ok(Math.abs(a.start - a.answer) >= 30, 'angle starts too close to the answer');

  const s = R.makeRound('split', seed, d);
  assert.ok(s.answer > 0 && s.answer < 1);
  for (const p of [s.a, s.b]) assert.ok(p.x >= 0 && p.x <= R.BOX.w && p.y >= 0 && p.y <= R.BOX.h);
  assert.ok(s.a.x < s.b.x, 'split line runs right to left');
  if (s.percent) assert.equal(Math.round(s.answer * 100), Number(s.label.slice(0, -1)));
  checked += 4;
}

// 3. Scoring: exact is 100, the "half" error is 50, further off scores less, always 0..100
const sample = Object.fromEntries(R.KINDS.map((k) => [k, R.makeRound(k, 42, 'normal')]));
for (const kind of R.KINDS) assert.equal(R.score(sample[kind], sample[kind].answer), 100, kind);
assert.equal(R.score(sample.angle, sample.angle.answer + R.HALF.angle), 50);
assert.equal(R.score(sample.angle, sample.angle.answer + 360), 100, 'angles wrap');
assert.equal(R.score(sample.angle, -sample.angle.answer), 100, 'clockwise counts too');
assert.equal(R.score(sample.angle, 360 - sample.angle.answer), 100, 'clockwise, written as a big turn');
assert.equal(R.score(sample.split, sample.split.answer + R.HALF.split), 50);
assert.equal(R.score(sample.track, sample.track.answer - R.HALF.track * R.BOX.h), 50);
assert.equal(R.score(sample.count, (sample.count.answer + 1) * Math.exp(R.HALF.count) - 1), 50);
for (const kind of R.KINDS) {
  assert.equal(R.score(sample[kind], null), 0);
  assert.equal(R.score(sample[kind], NaN), 0);
}
rnd = R.mulberry32(3);
for (let i = 0; i < 20000; i++) {
  const kind = R.KINDS[i % 4];
  const pz = sample[kind];
  const spread = { count: 200, track: R.BOX.h, angle: 360, split: 1 }[kind];
  const g1 = rnd() * spread, g2 = rnd() * spread;
  const s1 = R.score(pz, g1), s2 = R.score(pz, g2);
  assert.ok(Number.isInteger(s1) && s1 >= 0 && s1 <= 100);
  if (R.error(pz, g1) < R.error(pz, g2)) assert.ok(s1 >= s2, `${kind}: closer guess scored lower`);
}
// Count is fair both ways: guessing double and half are equally wrong
const c40 = { kind: 'count', answer: 39 };
assert.equal(R.score(c40, 79), R.score(c40, 19));

assert.equal(R.verdict(100), 'Spot on!');
assert.equal(R.verdict(0), 'Way off');
assert.throws(() => R.makeRound('tempo', 1));
assert.throws(() => R.makeRound('count', 1, 'insane'));

console.log(`rounds: all checks passed (${checked} puzzles)`);

// 4. Network guesses, labels and the daily set
const g = Object.fromEntries(R.KINDS.map((k) => [k, R.makeRound(k, 7, 'hard')]));
assert.ok(R.validGuess(g.count, 40) && !R.validGuess(g.count, 40.5) && !R.validGuess(g.count, -1) && !R.validGuess(g.count, 1000));
assert.ok(R.validGuess(g.track, 0) && R.validGuess(g.track, R.BOX.h) && !R.validGuess(g.track, R.BOX.h + 1));
assert.ok(R.validGuess(g.angle, -180) && R.validGuess(g.angle, 45.5) && !R.validGuess(g.angle, 181));
assert.ok(R.validGuess(g.split, 0.5) && !R.validGuess(g.split, 1.01));
for (const bad of ['40', null, undefined, NaN, Infinity, {}, [1]]) {
  for (const kind of R.KINDS) assert.equal(R.validGuess(g[kind], bad), false, `${kind} accepted ${String(bad)}`);
}
for (const kind of R.KINDS) assert.equal(R.validGuess(g[kind], g[kind].answer), true, `${kind} rejects its own answer`);
assert.equal(R.describe(g.angle, -40), '40°');
assert.equal(R.describe(g.split, 0.371), '37%');
assert.equal(R.describe(g.count, null), '–');

assert.equal(R.dayNumber('2026-11-10'), 1);
assert.equal(R.dayNumber('2026-11-11'), 2);
assert.equal(R.dayNumber('2027-03-29'), 140, 'day numbers ignore daylight saving');
assert.equal(R.dayKey(new Date(2026, 0, 5)), '2026-01-05');
assert.deepEqual(R.dailySet('2026-12-01'), R.dailySet('2026-12-01'));
assert.notDeepEqual(R.dailySet('2026-12-01'), R.dailySet('2026-12-02'));
assert.deepEqual(R.dailySet('2026-12-01').map((p) => p.kind), R.DAILY.kinds);

console.log('rounds: network, labels and daily checks passed');
