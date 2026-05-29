# How to add words

This guide covers how to expand `src/words.json` using the Wordnik API and the included fetch script.

---

## Overview

The word dataset lives in `src/words.json`. The fetch script (`fetch-words.mjs`) reads a list of words from `wordlist.txt`, requests data from Wordnik for each one, normalizes the responses into the app's schema, and writes the result to a JSON file. You then review, patch any gaps, and replace `src/words.json`.

---

## Step 1 — Get a Wordnik API key

Wordnik offers a free API key for personal use.

1. Create an account at [wordnik.com](https://www.wordnik.com)
2. Request an API key at [developer.wordnik.com](https://developer.wordnik.com)
3. The key arrives by email, usually within a day or two

The free tier allows approximately 100 requests per day. Since the fetch script makes 4 requests per word (definition, examples, related words, etymology), that works out to roughly 25 words per day before hitting the limit.

---

## Step 2 — Add words to wordlist.txt

Open `data/wordlist.txt` and add words one per line. Each line is:

```
word [difficulty]
```

`difficulty` is optional and defaults to `2` if omitted.

| Value | Label              |
| ----- | ------------------ |
| `1`   | familiar           |
| `2`   | advanced (default) |
| `3`   | rare               |

**Example:**

```
# Lines starting with # are comments and are ignored

# familiar
lucid 1
candor 1

# advanced
ephemeral 2
liminal 2

# rare — difficulty omitted, defaults to 2
petrichor
sonder 3
```

Words are lowercased automatically. Blank lines are ignored.

---

## Step 3 — Run the fetch script

From the project root:

```bash
WORDNIK_API_KEY=yourkey node data/fetch-words.mjs
```

By default the script reads from `data/wordlist.txt` and writes to `words.json` in the current directory. Both paths can be overridden:

```bash
WORDNIK_API_KEY=yourkey node data/fetch-words.mjs --wordlist data/wordlist.txt --out src/words.json
```

**Requirements:** Node 18 or later (uses native `fetch` — no `npm install` needed).

The script prints progress as it runs:

```
Found 7 words in data/wordlist.txt
Fetching from Wordnik...

  ephemeral
  ✓
  sonder
  ✓
  ...

───────────────────────────────────
7 words saved to words.json
```

---

## Step 4 — Review and patch the output

Open the generated `words.json` and check for `null` fields. Two things the API cannot reliably provide:

### etymology.root

Wordnik returns etymology as a prose string, not a structured object. The script extracts the origin language (Greek, Latin, etc.) and the raw note text, but the `root` field — the actual root form of the word, e.g. `ephēmeros` — cannot be parsed automatically and will always come back as the plain word string.

**Fill this in manually.** A quick search for "etymology of [word]" on Wiktionary or Etymonline gives the root form reliably.

```json
"etymology": {
  "root": "ephēmeros",   ← fill this in
  "origin": "Greek",     ← auto-detected
  "note": "From epi (on) + hēmera (day)..."  ← from API, may need trimming
}
```

### idiom

There is no public API that maps words to related idiomatic expressions. The `idiom` field will always be `null` after a fetch. Add it manually, or leave it as `null` — the app handles a missing idiom gracefully by skipping the idiom exercise for that word.

```json
"idiom": {
  "phrase": "here today, gone tomorrow",
  "meaning": "Something that doesn't last or can't be relied upon."
}
```

### Other fields to check

- **`example`** — Wordnik examples are pulled from real text sources and can be long, stylistically odd, or not contain the exact word form. Replace any that feel unnatural with a cleaner hand-written sentence.
- **`synonyms` / `antonyms`** — the API returns up to 4 per type, but quality varies. Remove any that feel too obscure or too similar to each other.
- **`pos`** — usually correct, but occasionally returns a verbose string like `"adjective (predicate)"`. Simplify to the base form if needed.

---

## Step 5 — Merge into src/words.json

Once you're happy with the output, merge it into the existing dataset. The simplest approach is to open both files and append the new entries to the array in `src/words.json`. Keep entries in whatever order feels natural — the app shuffles the word list on every session.

Make sure there are no duplicate `id` values across the combined file.

---

## Wordnik API reference

The four endpoints used by the fetch script:

| Endpoint                             | What it returns                                    |
| ------------------------------------ | -------------------------------------------------- |
| `GET /word.json/{word}/definitions`  | Definition text, part of speech                    |
| `GET /word.json/{word}/examples`     | Example sentences from real sources                |
| `GET /word.json/{word}/relatedWords` | Synonyms, antonyms, and other related types        |
| `GET /word.json/{word}/etymologies`  | Etymology as a prose string (may contain XML tags) |

Full API documentation: [developer.wordnik.com/docs](https://developer.wordnik.com/docs)

---

## Tips

- **Batch in small runs.** Adding 10–15 words at a time keeps the review step manageable and stays within the free tier's daily limit.
- **Keep wordlist.txt as a running list.** Rather than clearing it after each run, comment out words already fetched with `#`. This gives you a history of what's been added.
- **Stage patches before committing.** It's worth doing a pass on the full `src/words.json` after each merge to ensure consistent formatting and tone across entries.
