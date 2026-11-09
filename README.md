# Guesstimate

A perception game for the office, in the browser. No rulers, no counting on your fingers: you eyeball it, and the closer you get the more points you score.

Play at `https://pakdragoon.github.io/guesstimate/`.

## The tests

Each round is one test, scored from 0 to 100.

| Test | What you do |
| --- | --- |
| **Count** | Dots flash for a moment. Guess how many there were. |
| **Track** | A ball flies right, bouncing off the top and bottom, and vanishes into the fog. Mark where it hits the right wall. |
| **Angle** | Drag the blue line until the angle between it and the dark line matches the target. Either side of the dark line works. |
| **Split** | Mark the point that sits the given fraction (1/3, 37%, 5/7...) of the way along the line, starting from the round end. |

After each guess the reveal shows the real answer in green next to yours in blue.

**Difficulty:**

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Count | 8 to 30 dots, 2.5 s | 20 to 80 dots, 1.6 s | 50 to 160 dots of mixed sizes, 1.1 s |
| Track | Slow, gentle angle, more of the flight visible | About 2 bounces | Fast, steep, about 4 bounces, little visible |
| Angle | Multiples of 15°, dark line flat | Any angle, tilted | Any angle, tilted, short dark line |
| Split | Halves, thirds, quarters, fifths | Percentages | Percentages or fractions like 5/7, on a tilted line |

## Scoring

Every test has an error that scores 50; each time you halve your error, you halve your distance to 100.

| Test | Scores 50 when you're off by |
| --- | --- |
| Count | 20% (double or half the dots are equally wrong) |
| Track | 8% of the wall's height |
| Angle | 6° |
| Split | 3% of the line |

Verdicts: 95+ Spot on!, 80+ Sharp, 60+ Close, 35+ Ballpark, under 35 Way off.

## How it works

Every puzzle is built from a number (a seed) by `js/rounds.js`, which has no network or page code. The same seed draws exactly the same puzzle in every browser, so when multiplayer arrives the host only has to send the seed, not the puzzle. Puzzles are drawn in a fixed 400 × 300 box and scaled to the screen, so a phone and a monitor see the same geometry.

| File | What it does |
| --- | --- |
| `index.html` | Screens |
| `style.css` | All styling (tokens and font shared with Thulla and Wordle Party) |
| `js/rounds.js` | Seeded puzzle generators and scoring, no network or DOM |
| `js/play.js` | Drawing, input and reveal for each test |
| `js/app.js` | Practice mode: home, round loop, results |
| `test/rounds.test.mjs` | Engine tests: `node test/rounds.test.mjs` |

Your practice settings and best average per difficulty are kept in your browser only.

## Testing

- Engine: `node test/rounds.test.mjs` (or `npm test`). It checks that puzzles are deterministic, stay inside the box and that dots never overlap; simulates the Track ball step by step against the formula; and checks that scores stay within 0 to 100, exact is 100, closer is never worse, and either side counts on Angle.
- Locally: `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Roadmap

- [x] Practice mode with Count, Track, Angle and Split
- [ ] Rooms with friends over PeerJS (same setup as Thulla): everyone gets the same puzzle at once, then a reveal with everyone's guesses on one board
- [ ] Google sign-in, crew scores and personal stats through the shared Firebase project
- [ ] Daily puzzle: seed from the date, no host needed, shareable result
