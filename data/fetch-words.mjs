/**
 * fetch-words.mjs
 *
 * Reads a wordlist.txt file and fetches data from Wordnik for each word,
 * normalizing into the Lexicon schema and saving to words.json.
 *
 * wordlist.txt format (one word per line):
 *   lucid 1
 *   ephemeral 2
 *   petrichor        ← difficulty omitted, defaults to 2
 *   sonder 3
 *
 * Difficulty: 1 = familiar, 2 = advanced (default), 3 = rare
 *
 * Usage:
 *   node fetch-words.mjs
 *   node fetch-words.mjs --wordlist path/to/other.txt
 *   node fetch-words.mjs --out path/to/output.json
 *   WORDNIK_API_KEY=yourkey node fetch-words.mjs
 *
 * Requirements:
 *   - Node 18+ (native fetch)
 *   - A free Wordnik API key: https://developer.wordnik.com
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync }          from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────

const API_KEY      = process.env.WORDNIK_API_KEY || 'YOUR_API_KEY_HERE';
const BASE         = 'https://api.wordnik.com/v4/word.json';
const DELAY_MS     = 300;   // pause between words to stay within rate limits
const DEFAULT_DIFF = 2;     // fallback difficulty when omitted from wordlist

// CLI flags
const args      = process.argv.slice(2);
const WORDLIST  = args[args.indexOf('--wordlist') + 1]  || 'wordlist.txt';
const OUT_FILE  = args[args.indexOf('--out')      + 1]  || 'words.json';

// ── Parse wordlist.txt ────────────────────────────────────────────────────────

async function parseWordlist(path) {
  if (!existsSync(path)) {
    console.error(`Error: "${path}" not found.`);
    console.error('Create a wordlist.txt with one word per line, e.g.:');
    console.error('  lucid 1');
    console.error('  ephemeral 2');
    console.error('  petrichor      ← difficulty optional, defaults to 2');
    process.exit(1);
  }

  const raw = await readFile(path, 'utf8');

  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))  // skip blanks and # comments
    .map(line => {
      const [word, diffStr] = line.split(/\s+/);
      const difficulty = diffStr ? parseInt(diffStr, 10) : DEFAULT_DIFF;
      if (![1, 2, 3].includes(difficulty)) {
        console.warn(`  ⚠ Unknown difficulty "${diffStr}" for "${word}" — defaulting to ${DEFAULT_DIFF}`);
        return { word: word.toLowerCase(), difficulty: DEFAULT_DIFF };
      }
      return { word: word.toLowerCase(), difficulty };
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(`${url}&api_key=${API_KEY}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Strip XML-style tags Wordnik includes in etymology strings
// e.g. "<xref>Greek</xref> ephēmeros" → "Greek ephēmeros"
function stripTags(str = '') {
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ── Per-word fetchers ─────────────────────────────────────────────────────────

async function fetchDefinition(word) {
  try {
    const data = await get(
      `${BASE}/${word}/definitions?limit=1&includeRelated=false&useCanonical=false&includeTags=false`
    );
    const entry = data?.[0];
    return {
      pos:        entry?.partOfSpeech ?? null,
      definition: entry?.text         ?? null,
    };
  } catch (e) {
    console.warn(`    ⚠ definition: ${e.message}`);
    return { pos: null, definition: null };
  }
}

async function fetchExample(word) {
  try {
    const data = await get(
      `${BASE}/${word}/examples?includeDuplicates=false&useCanonical=false&skip=0&limit=5`
    );
    // Prefer the shortest example that actually contains the word
    const examples = (data?.examples ?? [])
      .filter(e => e.text?.toLowerCase().includes(word.toLowerCase()))
      .sort((a, b) => a.text.length - b.text.length);
    return examples[0]?.text ?? null;
  } catch (e) {
    console.warn(`    ⚠ examples: ${e.message}`);
    return null;
  }
}

async function fetchRelated(word) {
  try {
    const data = await get(
      `${BASE}/${word}/relatedWords?useCanonical=false&limitPerRelationshipType=4`
    );
    const find = type => data?.find(r => r.relationshipType === type)?.words ?? [];
    return {
      synonyms: find('synonym'),
      antonyms: find('antonym'),
    };
  } catch (e) {
    console.warn(`    ⚠ related words: ${e.message}`);
    return { synonyms: [], antonyms: [] };
  }
}

async function fetchEtymology(word) {
  try {
    const data = await get(
      `${BASE}/${word}/etymologies?useCanonical=false`
    );
    const raw = data?.[0] ?? null;
    if (!raw) return null;

    const cleaned = stripTags(raw);

    // Detect origin language from common markers in the string
    const origins = ['Greek', 'Latin', 'French', 'Old English', 'Arabic',
                     'Sanskrit', 'German', 'Italian', 'Spanish', 'Dutch',
                     'Middle English', 'Old French', 'Proto-Germanic'];
    const detected = origins.find(o => cleaned.includes(o)) ?? 'Unknown';

    return {
      root:   word,               // fill in manually — Wordnik doesn't return clean root forms
      origin: detected,
      note:   cleaned.slice(0, 200),
    };
  } catch (e) {
    console.warn(`    ⚠ etymology: ${e.message}`);
    return null;
  }
}

// ── Normalize into Lexicon schema ─────────────────────────────────────────────

async function buildWordEntry({ word, difficulty }) {
  console.log(`\n  ${word}`);

  const [def, example, related, etymology] = await Promise.all([
    fetchDefinition(word),
    fetchExample(word),
    fetchRelated(word),
    fetchEtymology(word),
  ]);

  return {
    id:         word,
    word:       word,
    pos:        def.pos,
    difficulty: difficulty,
    definition: def.definition,
    example:    example,
    etymology:  etymology,
    synonyms:   related.synonyms,
    antonyms:   related.antonyms,
    // No reliable API source for idioms — fill in manually after export
    idiom:      null,
  };
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('Error: set your Wordnik API key via the WORDNIK_API_KEY environment variable');
    console.error('  e.g.  WORDNIK_API_KEY=yourkey node fetch-words.mjs');
    process.exit(1);
  }

  const wordlist = await parseWordlist(WORDLIST);
  console.log(`Found ${wordlist.length} word${wordlist.length !== 1 ? 's' : ''} in ${WORDLIST}`);
  console.log(`Fetching from Wordnik...`);

  const results  = [];
  const failures = [];

  for (const entry of wordlist) {
    try {
      const word = await buildWordEntry(entry);
      results.push(word);
      console.log(`  ✓`);
    } catch (e) {
      console.error(`  ✗ ${entry.word}: ${e.message}`);
      failures.push(entry.word);
    }
    await sleep(DELAY_MS);
  }

  await writeFile(OUT_FILE, JSON.stringify(results, null, 2));

  console.log(`\n───────────────────────────────────`);
  console.log(`${results.length} words saved to ${OUT_FILE}`);
  if (failures.length) {
    console.warn(`Failed (${failures.length}): ${failures.join(', ')}`);
  }
  console.log(`\nReview ${OUT_FILE} and fill in any null fields:`);
  console.log(`  etymology.root  — clean root form, e.g. "ephēmeros"`);
  console.log(`  idiom           — no API source, add manually`);
  console.log(`  Any fields the API didn't return for a given word`);
}

main().catch(console.error);
