# Guesstimate

A perception game for the office, in the browser. No rulers, no counting on your fingers: everyone gets the same puzzle at the same moment, then the reveal measures whose eye was sharpest.

Play at `https://pakdragoon.github.io/guesstimate/`.

## The tests

| Test | What you do |
| --- | --- |
| **Count** | Dots flash for a moment. Guess how many there were. |
| **Track** | A ball flies right, bouncing off the top and bottom, and vanishes into the hatched zone. Mark where it hits the right wall. |
| **Angle** | Drag the coloured line until the angle between it and the dark line matches the target. Either side of the dark line works. |
| **Split** | Mark the point that sits the given fraction (1/3, 37%, 5/7...) of the way along the line, starting from the round end. |

During a round the board is plain paper. The reveal turns it into a measured drawing: a grid fades in, the ball's flight draws itself, and rulers, a protractor and dimension lines show the real answer in green next to every player's guess in their own colour.

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Count | 8 to 30 dots, 2.5 s | 20 to 80 dots, 1.6 s | 50 to 160 dots of mixed sizes, 1.1 s |
| Track | Slow, gentle angle, more of the flight visible | About 2 bounces | Fast, steep, about 4 bounces, little visible |
| Angle | Multiples of 15°, dark line flat | Any angle, tilted | Any angle, tilted, short dark line |
| Split | Halves, thirds, quarters, fifths | Percentages | Percentages or fractions like 5/7, on a tilted line |

## Three ways to play

**Rooms (2 to 8 players).**

1. One person types their name and clicks **Host a room**. They get a 4-letter room code.
2. They click **Copy invite link** and send it round (or just say the code).
3. Friends open the link, type their name and click **Join room**.
4. The host picks the difficulty, tests, rounds of each test, time to answer and an optional crew name, then clicks **Start game**.
5. Each round starts with a 3-second countdown for everyone. Players lock in a guess; the scoreboard shows who has locked in, but nobody sees a guess until the reveal. The round ends when everyone has answered or the time runs out (the host can also click **End round now**).
6. The host clicks **Next round** after each reveal. At the end everyone sees the standings; the host can **Rematch** or **Change settings**.

Someone whose page refreshes rejoins with the same code and name and keeps their points. Someone new can join mid-game and plays from the current round.

**Daily puzzle.** Four puzzles (one of each test, normal), the same for everyone, new at midnight. One go per day; **Share result** copies a spoiler-free summary for your chat:

```
Guesstimate #12: 74/100
🟩🟨🟩🟨
Count 88 · Track 61 · Angle 93 · Split 54
```

**Practice.** Pick a difficulty and any tests, one of each. Your best average per difficulty is kept in your browser.

## Scoring

Every round is scored from 0 to 100. Every test has an error that scores 50; each time you halve your error, you halve your distance to 100.

| Test | Scores 50 when you're off by |
| --- | --- |
| Count | 20% (double or half the dots are equally wrong) |
| Track | 8% of the wall's height |
| Angle | 6° |
| Split | 3% of the line |

Verdicts: 95+ Spot on!, 80+ Sharp, 60+ Close, 35+ Ballpark, under 35 Way off. In a room, the highest total wins; a tie on total is broken by the best single round.

## How it works

Neither the game nor the rooms need a server of our own. Every puzzle is built from a number (a seed) by `js/rounds.js`, and the same seed draws exactly the same puzzle in every browser. In a room, the host's browser picks the seed and runs the game; other players connect straight to it with PeerJS (WebRTC). Only the seed, the guesses and the scores travel. The host checks each guess before scoring it, since it comes from another browser.

Puzzles are drawn in a fixed 400 × 300 box and scaled to the screen, so a phone and a monitor see the same geometry.

| File | What it does |
| --- | --- |
| `index.html` | Screens and sheets |
| `style.css` | All styling (tokens and font shared with Thulla and Wordle Party) |
| `js/rounds.js` | Seeded puzzle generators, scoring, guess checks and the daily seed. No network or DOM |
| `js/play.js` | Drawing, input and the measured reveal for each test |
| `js/app.js` | Practice, daily, PeerJS rooms (host and players), screens |
| `js/cloud.js` | Firebase sign-in, crew scores, personal stats, analytics |
| `firestore.rules` | Rules for all three games (see below) |
| `test/rounds.test.mjs` | Engine tests: `node test/rounds.test.mjs` |

## Firebase: sign-in, crews and stats

Guesstimate uses the same Firebase project as Wordle Party and Thulla (`wordle-party-81870`), with its own collections. Sign-in is Google only and optional; guests never download Firebase.

| Collection | Written by | Holds |
| --- | --- | --- |
| `guessCrews/{id}` + `/games` | Signed-in host | Crew totals (games, wins, points per player), one record per game |
| `guessUsers/{uid}` | That player | Room games, wins, points per test, daily count, streak and best daily |

- **Crews:** the host types a crew name in the lobby. When a game ends, a signed-in host saves it to the crew.
- **Personal stats:** each signed-in player saves their own stats when a room game ends or they finish the daily. Practice isn't saved.

The domain `pakdragoon.github.io` and the API key's website restriction already cover this game, so sign-in works without console changes.

**Security rules: one step needed.** Firestore has one rules file per database. This repo's `firestore.rules` contains Wordle Party's and Thulla's rules unchanged plus the Guesstimate rules. Until it is published, saving crews and stats fails with a "refused" message (the games still work).

1. Firebase console → Firestore Database → Rules → paste this repo's `firestore.rules` → Publish.
2. Copy the Guesstimate section into Thulla's `firestore.rules` too, so publishing either file later keeps all three games working. If any game's rules change, copy the change into every repo's file.

## Analytics

Built into `js/cloud.js` like the other games, and off until a `measurementId` is pasted into `firebaseConfig`. Players can opt out in Settings. Events: `room_created`, `room_joined`, `game_started`, `round_finished`, `game_finished`, `daily_finished`, `practice_finished`, `share_result`, `login`. No names, room codes or guesses are sent.

## Testing

- Engine: `node test/rounds.test.mjs` (or `npm test`). It checks that puzzles are deterministic, stay inside the box and that dots never overlap; simulates the Track ball step by step against the formula; checks scoring (exact is 100, closer is never worse, either side counts on Angle); rejects bad guesses from the network; and checks the daily seed and day numbers.
- Locally: `python3 -m http.server 8000`, then open `http://localhost:8000` in several windows with different names. Sign-in on localhost needs `http://localhost:8000/*` on the API key and `localhost` in authorized domains.
- Real check after each deploy: one short room on two phones.

## Known limitations

- **The host's browser runs the room.** Closing or refreshing the host's tab ends it; other players can refresh and rejoin.
- **The host's browser knows the answers** (they're built from the seed), and anyone could work them out in developer tools. It's a game among colleagues.
- **Strict networks** (some offices, universities, mobile carriers) can block the direct PeerJS connection.
- **Crew scores are keyed by player name;** use the same name each time.
- **Daily results** live in this browser; play on the same device to keep your "played today" status. Signed-in players also get a streak in their stats.
