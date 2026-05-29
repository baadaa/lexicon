const DIFFICULTY = {
  1: { label: "familiar", cls: "d1" },
  2: { label: "advanced", cls: "d2" },
  3: { label: "rare", cls: "d3" },
};

let WORDS = []; // populated by loadWords()

let state = {
  wordsSeenTotal: 0,
  collectedTotal: 0,
  streak: 0,
  currentSession: [],
  currentStep: 0,
  sessionType: "short",
  answered: false,
  sessionLog: [],
  recalledWords: new Set(),
};
let currentSessionType = "short";

function difficultyHTML(d) {
  const info = DIFFICULTY[d] || DIFFICULTY[2];
  return `<span class="difficulty-label ${info.cls}">${info.label}</span>`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSession(type) {
  const words = shuffle(WORDS).slice(0, type === "short" ? 1 : 3);
  const steps = [];
  words.forEach((word) => {
    const types =
      type === "short"
        ? ["definition", "synonym", "fill"]
        : [
            "definition",
            ...shuffle([
              "synonym",
              "antonym",
              "fill",
              "etymology",
              "idiom",
            ]),
          ];
    types.forEach((t) => steps.push({ word, type: t }));
  });
  return steps;
}

function startSession(type) {
  currentSessionType = type;
  state.sessionType = type;
  state.currentSession = buildSession(type);
  state.currentStep = 0;
  state.answered = false;
  state.sessionLog = [];
  // Update home hero to first word of session
  const firstWord = state.currentSession[0].word;
  updateHero(firstWord);
  showScreen("screen-exercise");
  renderStep();
}

function updateHero(word) {
  document.getElementById("hero-word").textContent = word.word;
  document.getElementById("hero-pos").textContent = word.pos;
  const dEl = document.getElementById("hero-difficulty");
  const info = DIFFICULTY[word.difficulty] || DIFFICULTY[2];
  dEl.textContent = info.label;
  dEl.className = "difficulty-label " + info.cls;
  document.getElementById("hero-peek-def").textContent = word.definition;
  document.getElementById("hero-peek-example").textContent = word.example;
  document.getElementById("hero-peek-btn").classList.remove("open");
  document.getElementById("hero-peek-body").classList.remove("open");
}

function toggleHeroPeek() {
  document.getElementById("hero-peek-btn").classList.toggle("open");
  document.getElementById("hero-peek-body").classList.toggle("open");
}

function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function goHome() {
  showScreen("screen-home");
  updateStatsUI();
}

function renderProgress() {
  document.getElementById("progress-track").innerHTML =
    state.currentSession
      .map((_, i) => {
        let cls = "progress-dot";
        if (i < state.currentStep) cls += " done";
        else if (i === state.currentStep) cls += " active";
        return `<div class="${cls}"></div>`;
      })
      .join("");
}

function renderStep() {
  renderProgress();
  const step = state.currentSession[state.currentStep];
  if (!step) {
    showComplete();
    return;
  }
  state.answered = false;
  const body = document.getElementById("exercise-body");
  const { word, type } = step;
  if (type === "definition") renderDefinition(word, body);
  else if (type === "synonym") renderChoice(word, body, "synonym");
  else if (type === "antonym") renderChoice(word, body, "antonym");
  else if (type === "fill") renderFill(word, body);
  else if (type === "etymology") renderEtymology(word, body);
  else if (type === "idiom") renderIdiom(word, body);
}

function logStep(type, word, isCorrect, chosen, correct) {
  state.sessionLog.push({ type, word, isCorrect, chosen, correct });
}

function wordHeader(word) {
  return `
<div class="exercise-word-row">
<span class="exercise-word">${word.word}</span>
${difficultyHTML(word.difficulty)}
</div>
<div class="exercise-pos">${word.pos}</div>
`;
}

function nextBtn(label) {
  return `<button class="primary-btn" id="next-btn">${label || "Continue"}</button>`;
}
function bindNextBtn() {
  const btn = document.getElementById("next-btn");
  if (btn) btn.addEventListener("click", nextStep);
}

function feedbackHTML(isCorrect, correctAns) {
  if (isCorrect)
    return `<div class="feedback-line correct"><span class="fb-icon">✓</span> Correct</div>`;
  return `<div class="feedback-line wrong"><span class="fb-icon">✕</span> The answer is "${correctAns}"</div>`;
}

function renderDefinition(word, body) {
  state.wordsSeenTotal++;
  body.innerHTML = `
<div class="exercise-type-tag">Definition</div>
${wordHeader(word)}
<div class="definition-card">
<div class="definition-text">${word.definition}</div>
<div class="example-text">"${word.example}"</div>
</div>
${nextBtn("Got it")}
`;
  logStep("definition", word, true, null, null);
  bindNextBtn();
}

function renderChoice(word, body, mode) {
  const pool = mode === "synonym" ? word.synonyms : word.antonyms;
  const correct = pool[0];
  const others = WORDS.flatMap((w) =>
    mode === "synonym" ? w.synonyms : w.antonyms,
  ).filter((w) => !pool.includes(w));
  const options = shuffle([correct, ...shuffle(others).slice(0, 3)]);

  body.innerHTML = `
<div class="exercise-type-tag">${mode === "synonym" ? "Synonym" : "Antonym"}</div>
${wordHeader(word)}
<p class="question-text">Which word is ${mode === "synonym" ? "closest in meaning" : "opposite in meaning"}?</p>
<div class="options-grid" id="options-grid"></div>
<div id="feedback"></div>
`;

  const grid = document.getElementById("options-grid");
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () =>
      resolveChoice(opt, correct, word, mode),
    );
    grid.appendChild(btn);
  });
}

function resolveChoice(chosen, correct, word, type) {
  if (state.answered) return;
  state.answered = true;
  const isCorrect = chosen === correct;
  logStep(type, word, isCorrect, chosen, correct);

  document.querySelectorAll(".option-btn").forEach((b) => {
    b.disabled = true;
    const txt = b.textContent;
    if (txt === chosen && isCorrect) b.classList.add("selected-correct");
    else if (txt === chosen) b.classList.add("selected-wrong");
    else if (txt === correct && !isCorrect)
      b.classList.add("reveal-correct");
  });

  const fb = document.getElementById("feedback");
  fb.innerHTML = feedbackHTML(isCorrect, correct) + nextBtn();
  bindNextBtn();
}

function renderFill(word, body) {
  const sentence = word.example.replace(
    new RegExp(word.word, "i"),
    '<span class="blank-span">________</span>',
  );
  body.innerHTML = `
<div class="exercise-type-tag">Fill in the blank</div>
${wordHeader(word)}
<div class="fitb-sentence">${sentence}</div>
<input class="fitb-input" id="fitb" type="text" placeholder="Type the missing word…" autocomplete="off" />
<div id="feedback"></div>
<div class="btn-stack">${nextBtn("Check")}</div>
`;

  const checkBtn = document.getElementById("next-btn");
  const input = document.getElementById("fitb");

  function doCheck() {
    if (state.answered) {
      nextStep();
      return;
    }
    const isCorrect =
      input.value.trim().toLowerCase() === word.word.toLowerCase();
    state.answered = true;
    input.disabled = true;
    logStep("fill", word, isCorrect, input.value.trim(), word.word);
    document.getElementById("feedback").innerHTML = feedbackHTML(
      isCorrect,
      word.word,
    );
    checkBtn.textContent = "Continue";
  }

  checkBtn.addEventListener("click", doCheck);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doCheck();
  });
}

function renderEtymology(word, body) {
  const allOrigins = [
    "Greek",
    "Latin",
    "French",
    "Old English",
    "Arabic",
    "Sanskrit",
    "Coined English",
  ];
  const correct = word.etymology.origin;
  const options = shuffle([
    correct,
    ...shuffle(allOrigins.filter((o) => o !== correct)).slice(0, 3),
  ]);

  body.innerHTML = `
<div class="exercise-type-tag">Etymology</div>
${wordHeader(word)}
<div class="etymology-box">
<div class="etymology-label">Word root</div>
<div class="etymology-root">${word.etymology.root}</div>
<div class="etymology-note">${word.etymology.note}</div>
</div>
<p class="question-text">Which language does this word originate from?</p>
<div class="options-grid" id="options-grid"></div>
<div id="feedback"></div>
`;

  const grid = document.getElementById("options-grid");
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () =>
      resolveChoice(opt, correct, word, "etymology"),
    );
    grid.appendChild(btn);
  });
}

function renderIdiom(word, body) {
  const allMeanings = [
    "To act with great speed and urgency",
    "To avoid the real issue at hand",
    "Something that costs more than its worth",
    "To wait patiently for the right moment",
    "To take a significant and sudden risk",
    word.idiom.meaning,
  ];
  const correct = word.idiom.meaning;
  const options = shuffle([
    correct,
    ...shuffle(allMeanings.filter((m) => m !== correct)).slice(0, 3),
  ]);

  body.innerHTML = `
<div class="exercise-type-tag">Idiom</div>
${wordHeader(word)}
<div class="idiom-card">
<div class="idiom-phrase">"${word.idiom.phrase}"</div>
<p class="question-text" style="margin-bottom:0">What does this expression mean?</p>
</div>
<div class="options-grid options-single" id="options-grid"></div>
<div id="feedback"></div>
`;

  const grid = document.getElementById("options-grid");
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.style.textAlign = "left";
    btn.style.fontSize = "13px";
    btn.textContent = opt;
    btn.addEventListener("click", () =>
      resolveChoice(opt, correct, word, "idiom"),
    );
    grid.appendChild(btn);
  });
}

function nextStep() {
  state.currentStep++;
  if (state.currentStep >= state.currentSession.length) showComplete();
  else renderStep();
}

function toggleReview() {
  document.getElementById("review-toggle").classList.toggle("open");
  document.getElementById("review-list").classList.toggle("open");
}

function buildReview() {
  const typeLabel = {
    definition: "Definition",
    synonym: "Synonym",
    antonym: "Antonym",
    fill: "Fill in the blank",
    etymology: "Etymology",
    idiom: "Idiom",
  };
  const byWord = {};
  state.sessionLog.forEach((entry) => {
    const key = entry.word.id;
    if (!byWord[key]) byWord[key] = { word: entry.word, exercises: [] };
    byWord[key].exercises.push(entry);
  });

  return Object.values(byWord)
    .map(({ word, exercises }) => {
      const rows = exercises
        .map((ex) => {
          let iconCls, iconChar, answerHTML;
          if (ex.type === "definition") {
            iconCls = "neutral";
            iconChar = "—";
            answerHTML = `<span style="color:var(--cg500);font-style:italic;font-size:12px">${word.definition.slice(0, 65)}…</span>`;
          } else if (ex.isCorrect) {
            iconCls = "correct";
            iconChar = "✓";
            answerHTML = `<span class="correct-ans">${ex.correct}</span>`;
          } else {
            iconCls = "wrong";
            iconChar = "✕";
            answerHTML =
              ex.type === "fill"
                ? `<span class="wrong-ans">${ex.chosen || "(blank)"}</span> <span class="correct-ans">${ex.correct}</span>`
                : `<span class="wrong-ans">${ex.chosen}</span> <span class="correct-ans">${ex.correct}</span>`;
          }
          return `
  <div class="review-exercise-row">
    <div class="review-result-icon ${iconCls}">${iconChar}</div>
    <div class="review-exercise-detail">
      <div class="review-exercise-type">${typeLabel[ex.type] || ex.type}</div>
      <div class="review-exercise-answer">${answerHTML}</div>
    </div>
  </div>`;
        })
        .join("");

      return `
<div class="review-word-block">
  <div class="review-word-header">
    <span class="review-word-name">${word.word}</span>
    <span class="review-word-pos">${word.pos}</span>
    ${difficultyHTML(word.difficulty)}
  </div>
  <div class="review-exercises">${rows}</div>
</div>`;
    })
    .join("");
}

function showComplete() {
  // Count unique words where at least one answer was correct
  const recalledWords = new Set(
    state.sessionLog
      .filter((e) => e.isCorrect && e.type !== "definition")
      .map((e) => e.word.id),
  );
  recalledWords.forEach((id) => state.recalledWords.add(id));

  const wordsInSession = [
    ...new Set(state.sessionLog.map((e) => e.word.id)),
  ].length;
  document.getElementById("complete-subtitle").textContent =
    `You've worked through ${wordsInSession} word${wordsInSession > 1 ? "s" : ""} this session.`;
  document.getElementById("review-list").innerHTML = buildReview();
  showScreen("screen-complete");
  saveStats();
  updateStatsUI();
}

function openHTP() {
  document.getElementById("htp-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeHTP(e) {
  if (e && e.target !== document.getElementById("htp-overlay")) return;
  document.getElementById("htp-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

// ── localStorage persistence ─────────────────────────────────────────────────

const STORAGE_KEY = "b_lexicon";

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    state.wordsSeenTotal = saved.wordsSeenTotal || 0;
    state.recalledWords = new Set(saved.recalledWords || []);

    // Streak logic
    const today = todayStr();
    const lastVisit = saved.lastVisit || null;

    if (!lastVisit) {
      state.streak = 1;
    } else if (lastVisit === today) {
      state.streak = saved.streak || 1;
    } else {
      // Check if lastVisit was yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      if (lastVisit === yesterdayStr) {
        state.streak = (saved.streak || 0) + 1;
      } else {
        state.streak = 1; // gap — reset
      }
    }
  } catch (e) {
    console.warn("Could not load stats from localStorage:", e);
  }
}

function saveStats() {
  try {
    const data = {
      wordsSeenTotal: state.wordsSeenTotal,
      recalledWords: [...state.recalledWords],
      streak: state.streak,
      lastVisit: todayStr(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not save stats to localStorage:", e);
  }
}

function updateStatsUI() {
  const s = state.streak;
  document.getElementById("stat-words").textContent =
    state.wordsSeenTotal;
  document.getElementById("stat-collected").textContent =
    state.recalledWords.size;
  document.getElementById("stat-streak").textContent = s;
  document.getElementById("streak-count").textContent =
    `${s} day${s !== 1 ? "s" : ""}`;
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function loadWords() {
  const app = document.getElementById("app");

  // Show loading state
  app.style.opacity = "0.4";

  try {
    const res = await fetch("/src/words.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    WORDS = await res.json();
    if (!WORDS.length) throw new Error("words.json is empty");
  } catch (e) {
    app.style.opacity = "1";
    app.innerHTML = `
<div style="padding:3rem 1.5rem;text-align:center;font-family:'Work Sans',sans-serif">
  <div style="font-size:32px;margin-bottom:1rem">⚠</div>
  <div style="font-size:16px;font-weight:500;color:#1a1a1a;margin-bottom:.5rem">Could not load words.json</div>
  <div style="font-size:13px;color:#628c9d;line-height:1.6">${e.message}<br><br>Make sure words.json is in the same folder as lexicon.html<br>and you're opening it via a local server, not file://</div>
</div>`;
    return;
  }

  app.style.opacity = "1";

  loadStats(); // restore persisted state
  saveStats(); // record today as a visit (updates streak if needed)
  updateStatsUI();

  const heroWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  updateHero(heroWord);

  const d = new Date();
  document.getElementById("today-label").textContent =
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
}