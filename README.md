# Lexicon

A personal daily vocabulary practice app. Short, calm sessions that introduce words through varied exercises — no scores to chase, no streaks to protect. Just a low-pressure break with something to show for it. Built with Claude which helped draft this README as well.

![Difficulty labels: familiar · advanced · rare](https://img.shields.io/badge/words-30-1F637A?style=flat-square) ![No dependencies](https://img.shields.io/badge/dependencies-none-609834?style=flat-square)

---

## What it is

Lexicon serves a small set of curated words through six exercise types: definition, synonym, antonym, fill-in-the-blank, etymology, and idiom. Sessions come in two lengths — a two-minute quick practice (one word, three exercises) or a ten-minute full session (three words, all exercise types). Wrong answers reveal the correct one and move on. Nothing is graded.

The word dataset lives in a plain JSON file, separate from the app, so it can grow independently over time.

---

## Key features

- **Two session modes** — quick practice or full session, depending on how much time you have
- **Six exercise types** — definition, synonym, antonym, fill-in-the-blank, etymology, idiom
- **Difficulty labels** — each word is tagged as familiar, advanced, or rare
- **End-of-session review** — collapsible summary of every word and answer from the session
- **Persistent stats** — streak, words seen, and words recalled stored in `localStorage`
- **Definition peek** — tap to preview a word's definition on the home screen before starting
- **No backend, no accounts** — runs entirely in the browser from two files

---

## How it's built

A single-page app with no framework and no build step.

| Layer         | Detail                                                                |
| ------------- | --------------------------------------------------------------------- |
| Structure     | Vanilla HTML/CSS/JS in `index.html`                                   |
| Fonts         | Work Sans (UI), Libre Baskerville (display) via Google Fonts          |
| Colors        | Custom token system based on a cyan/coolGray palette                  |
| Data          | External `src/words.json`, fetched at load time                       |
| Persistence   | `localStorage` for streak, words seen, and words recalled             |
| Word fetching | Node.js utility script (`data/fetch-words.mjs`) using the Wordnik API |

---

## Project structure

```
/
├── index.html          # shell/markup
├── README.md
├── src/
│   ├── app.js          # the app
│   ├── styles.css      # styling
│   └── words.json      # word dataset
└── data/
    ├── wordlist.txt         # source list of words to fetch
    ├── fetch-words.mjs      # Wordnik fetch + normalize script
    └── how-to-add-data.md   # guide for expanding the dataset
```

---

## Running locally

Because the app fetches `src/words.json` at load time, it needs to be served over HTTP rather than opened as a `file://` URL. Any local server works:

```bash
# Node
npx serve .

# Python
python3 -m http.server 8080
```

Then open `http://localhost:3000` (or whichever port the server reports).

---

## Adding words

See [`data/how-to-add-data.md`](data/how-to-add-data.md) for the full guide. The short version:

1. Add words to `data/wordlist.txt`, one per line
2. Run `WORDNIK_API_KEY=yourkey node data/fetch-words.mjs`
3. Review and patch the output, then move it to `src/words.json`

---

## Word schema

Each entry in `words.json` follows this structure:

```json
{
  "id": "ephemeral",
  "word": "ephemeral",
  "pos": "adjective",
  "difficulty": 2,
  "definition": "Lasting for a very short time; transitory.",
  "example": "The ephemeral beauty of cherry blossoms makes them all the more precious.",
  "etymology": {
    "root": "ephēmeros",
    "origin": "Greek",
    "note": "From epi (on) + hēmera (day)."
  },
  "synonyms": ["fleeting", "transient", "momentary", "brief"],
  "antonyms": ["permanent", "enduring", "eternal", "lasting"],
  "idiom": {
    "phrase": "here today, gone tomorrow",
    "meaning": "Something that doesn't last or can't be relied upon."
  }
}
```

`difficulty`: `1` = familiar, `2` = advanced, `3` = rare  
`idiom`: optional — can be `null` if no strong idiomatic connection exists
