import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORE_KEY = "typeword.state.v1";

const BASE_WORDS = [
  ["sad", "难过的"],
  ["dad", "爸爸"],
  ["add", "添加"],
  ["lad", "男孩"],
  ["fad", "一时流行"],
  ["fall", "落下"],
  ["all", "全部"],
  ["ask", "问"],
  ["as", "像"],
  ["salad", "沙拉"],
  ["glass", "玻璃杯"],
  ["flash", "闪光"]
].map(([english, chinese], index) => ({
  id: `base-${index}-${english}`,
  unit: "基准键",
  type: "home",
  english,
  chinese,
  source: "home-row"
}));

const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"]
];

const FINGER_MAP = {
  q: "左小指", a: "左小指", z: "左小指",
  w: "左无名指", s: "左无名指", x: "左无名指",
  e: "左中指", d: "左中指", c: "左中指",
  r: "左食指", f: "左食指", v: "左食指", t: "左食指", g: "左食指", b: "左食指",
  y: "右食指", h: "右食指", n: "右食指", u: "右食指", j: "右食指", m: "右食指",
  i: "右中指", k: "右中指", ",": "右中指",
  o: "右无名指", l: "右无名指", ".": "右无名指",
  p: "右小指", ";": "右小指", "/": "右小指"
};

const FINGER_CLASSES = {
  q: "pinky", a: "pinky", z: "pinky",
  w: "ring", s: "ring", x: "ring",
  e: "middle", d: "middle", c: "middle",
  r: "index", f: "index", v: "index", t: "index", g: "index", b: "index",
  y: "index", h: "index", n: "index", u: "index", j: "index", m: "index",
  i: "middle-right", k: "middle-right", ",": "middle-right",
  o: "ring-right", l: "ring-right", ".": "ring-right",
  p: "pinky-right", ";": "pinky-right", "/": "pinky-right"
};

const state = loadState();
let session = {
  startedAt: Date.now(),
  typedChars: 0,
  correct: 0,
  wrong: 0
};

autoLoadBundledWordBank();

function freshState() {
  return {
    imported: [],
    progress: {},
    activeMode: "lesson",
    showTranslation: false,
    sound: true,
    caseSensitive: false,
    wordsPerRound: 12,
    feedback: null,
    currentIndex: { home: 0, lesson: 0, review: 0, dictation: 0 },
    lastImportName: "",
    lastImportAt: ""
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return { ...freshState(), ...saved, feedback: null, showTranslation: saved.showTranslation ?? saved.revealAnswer ?? false };
  } catch {
    return freshState();
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

async function autoLoadBundledWordBank() {
  try {
    const wordBankUrl = new URL("wordbank.json", window.location.origin + import.meta.env.BASE_URL);
    const response = await fetch(wordBankUrl, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const sourceName = payload.sourcePdf || payload.name || "内置词库";
    if (state.imported.length && state.lastImportName !== sourceName) return;
    const items = Array.isArray(payload) ? payload : payload.items || [];
    const normalized = normalizeImportedItems(items, "bundled");
    if (!normalized.length) return;
    const hadSameWordBank = state.imported.length > 0 && state.lastImportName === sourceName;
    state.imported = mergeImported(dedupeEntries(normalized));
    state.activeMode = "lesson";
    if (!hadSameWordBank) state.currentIndex.lesson = 0;
    state.feedback = null;
    state.lastImportName = sourceName;
    state.lastImportAt = new Date().toLocaleString("zh-CN");
    saveState();
    render();
  } catch {
    // No bundled wordbank is fine; users can still import PDF or JSON manually.
  }
}

function entryProgress(id) {
  if (!state.progress[id]) {
    state.progress[id] = {
      attempts: 0,
      correct: 0,
      wrong: 0,
      wpmTotal: 0,
      lastWpm: 0,
      dictationAttempts: 0,
      dictationCorrect: 0,
      dictationWrong: 0,
      dictationWpmTotal: 0,
      dictationLastWpm: 0,
      lastPracticedAt: "",
      mastered: false
    };
  }
  return state.progress[id];
}

function activePool() {
  if (state.activeMode === "home") return BASE_WORDS;
  if (state.activeMode === "review") return allEntries().filter((item) => isWrongItem(item));
  return state.imported.length ? state.imported : BASE_WORDS;
}

function practiceList() {
  return activePool().slice(0, Math.max(1, state.wordsPerRound));
}

function allEntries() {
  return [...BASE_WORDS, ...state.imported];
}

function isWrongItem(item) {
  const progress = state.progress[item.id];
  return !!progress && (
    (progress.wrong || 0) > (progress.correct || 0) ||
    (progress.dictationWrong || 0) > (progress.dictationCorrect || 0)
  );
}

function currentEntry() {
  const list = practiceList();
  if (!list.length) return null;
  const index = Math.min(state.currentIndex[state.activeMode] || 0, list.length - 1);
  state.currentIndex[state.activeMode] = index;
  return list[index];
}

function normalizeAnswer(value) {
  const normalized = String(value).replace(/[’']/g, "");
  const cased = state.caseSensitive ? normalized : normalized.toLowerCase();
  return cased.replace(/[^a-zA-Z0-9]/g, "");
}

function render() {
  const list = practiceList();
  const entry = currentEntry();
  const totals = calculateTotals(list);
  const progress = entry ? entryProgress(entry.id) : null;
  const nextKey = getNextExpectedKey(entry);

  document.querySelector("#app").innerHTML = `
    <main class="app-shell">
      <aside class="side-panel">
        <section class="brand-block">
          <div class="brand-icon">T</div>
          <div>
            <h1>课文打字</h1>
            <p>从 PDF 课文里抽单词，按指法慢慢练。</p>
          </div>
        </section>

        <label class="pdf-drop">
          <input id="pdfInput" type="file" accept="application/pdf" multiple />
          <span>+</span>
          <strong>导入课文 PDF</strong>
          <em>可一次选择多个文件</em>
        </label>

        <label class="json-import">
          <input id="jsonInput" type="file" accept="application/json" />
          导入处理好的词库 JSON
        </label>

        <section class="control-group">
          <span class="control-title">练习范围</span>
          <div class="mode-tabs" role="tablist">
            ${modeButton("lesson", "课文词")}
            ${modeButton("home", "基准键")}
            ${modeButton("review", "易错词")}
            ${modeButton("dictation", "默写")}
          </div>
        </section>

        <section class="control-group">
          <div class="range-label">
            <span>每组词数</span>
            <strong>${state.wordsPerRound}</strong>
          </div>
          <input id="wordsPerRound" class="range" type="range" min="4" max="48" step="1" value="${state.wordsPerRound}" />
        </section>

        <section class="checks">
          ${checkRow("sound", "按键提示音", state.sound)}
          ${checkRow("caseSensitive", "区分大小写", state.caseSensitive)}
          ${checkRow("showTranslation", "显示翻译", state.showTranslation)}
        </section>

        <button id="startPractice" class="primary-action" type="button">开始练习</button>

        <section class="record-card">
          <div class="record-head">
            <span>已提取单词</span>
            <button id="clearRecord" type="button">清空记录</button>
            <strong>${state.imported.length || BASE_WORDS.length}</strong>
          </div>
          <div class="mini-progress"><i style="width:${totals.total ? (totals.overallDone / totals.total) * 100 : 0}%"></i></div>
          <p>英文掌握 ${totals.overallDone}/${totals.total}，练习 ${totals.englishCorrectAttempts} 次；默写掌握 ${totals.dictationDone}/${totals.total}，练习 ${totals.dictationCorrectAttempts} 次；错过 ${totals.review}</p>
          <div class="legend-row">
            <span><i class="todo"></i>未练</span>
            <span><i class="done"></i>已练</span>
            <span><i class="wrong"></i>错过</span>
          </div>
          <div class="edit-title">编辑中文释义</div>
          <div class="word-bank">${wordBankPreview()}</div>
        </section>
      </aside>

      <section class="main-panel">
        <section class="stats-grid" aria-label="练习统计">
          ${statCard("正确率", `${totals.accuracy}%`)}
          ${statCard("速度", `${totals.wpm} WPM`)}
          ${statCard("进度", `${totals.currentDone} / ${list.length || 0}`)}
          ${statCard("词库", `${state.imported.length} / ${state.imported.length || 48}`)}
          ${statCard("默写", `${totals.dictationDone} / ${totals.total}`)}
        </section>

        <section class="practice-card">
          ${entry ? practiceCard(entry, progress, list) : emptyCard()}
        </section>

        <section class="keyboard-card">
          <div class="finger-legend">
            <span><i class="pinky"></i>小指</span>
            <span><i class="ring"></i>无名指</span>
            <span><i class="middle"></i>中指</span>
            <span><i class="index"></i>食指</span>
            <span><i class="thumb"></i>拇指</span>
          </div>
          <div id="keyboard" class="keyboard" aria-label="屏幕键盘"></div>
        </section>
      </section>
    </main>
  `;

  bindEvents();
  renderKeyboard(nextKey);
  const answer = document.querySelector("#answerInput");
  if (answer) answer.focus();
}

function modeButton(mode, label) {
  return `<button data-mode="${mode}" class="${state.activeMode === mode ? "active" : ""}" type="button">${label}</button>`;
}

function checkRow(id, label, checked) {
  return `
    <label class="check-row">
      <input id="${id}" data-setting="${id}" type="checkbox" ${checked ? "checked" : ""} />
      <span>${label}</span>
    </label>
  `;
}

function statCard(label, value) {
  return `<article><span>${label}</span><strong>${value}</strong></article>`;
}

function practiceCard(entry, progress, list) {
  const index = state.currentIndex[state.activeMode] || 0;
  const answerVisible = state.showTranslation;
  const feedback = state.feedback?.entryId === entry.id ? state.feedback : null;
  const counts = progressCounts(progress);
  return `
    <div class="prompt-area">
      <span class="translation-label">${escapeHtml(entry.chinese)}</span>
      <div class="answer-word ${answerVisible ? "visible" : ""}">${escapeHtml(entry.english)}</div>
      <button id="revealAnswer" class="translate-button" type="button">${answerVisible ? "隐藏翻译" : "翻译"}</button>
    </div>
    <form id="answerForm" class="answer-form" autocomplete="off">
      <input id="answerInput" type="text" inputmode="latin" spellcheck="false" aria-label="根据中文输入英文" />
    </form>
    <div id="feedback" class="feedback ${feedback?.kind || ""}">${feedback?.text || ""}</div>
    <div class="finger-hint" id="fingerHint">下一键：看提示</div>
    <div class="progress-line">
      <span>${index + 1}/${list.length}</span>
      <div><i style="width:${((index + 1) / list.length) * 100}%"></i></div>
      <span>本词 ${counts.correct}/${counts.attempts}</span>
    </div>
  `;
}

function emptyCard() {
  const message = state.activeMode === "review"
    ? "当前没有易错词。输错的词会自动进入这里复练。"
    : "请先导入 PDF，系统会自动提取每个 Unit 的重点单词和常考短语。";
  return `<div class="empty-card"><h2>${message}</h2></div>`;
}

function wordBankPreview() {
  const items = (state.imported.length ? state.imported : BASE_WORDS).slice(0, 24);
  return items.map((item) => {
    const status = wordBankStatus(item);
    return `
    <button class="word-chip status-${status}" data-word-id="${escapeHtml(item.id)}" type="button" title="${wordBankStatusLabel(status)}">
      <i aria-hidden="true"></i>
      <strong>${escapeHtml(item.english)}</strong>
      <span>${escapeHtml(item.chinese)}</span>
    </button>
  `;
  }).join("");
}

function wordBankStatus(item) {
  const progress = state.progress[item.id];
  if (!progress) return "todo";
  if (isWrongItem(item)) return "wrong";
  if ((progress.correct || 0) > 0 || (progress.dictationCorrect || 0) > 0) return "done";
  return "todo";
}

function wordBankStatusLabel(status) {
  if (status === "wrong") return "错过";
  if (status === "done") return "已练";
  return "未练";
}

function bindEvents() {
  document.querySelector("#pdfInput")?.addEventListener("change", handlePdfImport);
  document.querySelector("#jsonInput")?.addEventListener("change", handleJsonImport);
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMode = button.dataset.mode;
      state.feedback = null;
      saveState();
      render();
    });
  });
  document.querySelector("#wordsPerRound")?.addEventListener("input", (event) => {
    state.wordsPerRound = Number(event.target.value);
    Object.keys(state.currentIndex).forEach((key) => {
      state.currentIndex[key] = Math.min(state.currentIndex[key] || 0, state.wordsPerRound - 1);
    });
    saveState();
    render();
  });
  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.addEventListener("change", () => {
      state[input.dataset.setting] = input.checked;
      saveState();
      render();
    });
  });
  document.querySelector("#startPractice")?.addEventListener("click", () => {
    state.currentIndex[state.activeMode] = 0;
    state.feedback = null;
    session = { startedAt: Date.now(), typedChars: 0, correct: 0, wrong: 0 };
    saveState();
    render();
  });
  document.querySelector("#clearRecord")?.addEventListener("click", () => {
    state.progress = {};
    state.feedback = null;
    state.currentIndex = { home: 0, lesson: 0, review: 0, dictation: 0 };
    session = { startedAt: Date.now(), typedChars: 0, correct: 0, wrong: 0 };
    saveState();
    render();
  });
  document.querySelector("#revealAnswer")?.addEventListener("click", () => {
    state.showTranslation = !state.showTranslation;
    saveState();
    render();
  });
  document.querySelectorAll("[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => editChinese(button.dataset.wordId));
  });
  document.querySelector("#answerInput")?.addEventListener("input", (event) => {
    session.typedChars += 1;
    const entry = currentEntry();
    renderKeyboard(getNextExpectedKey(entry, event.target.value));
    if (entry && normalizeAnswer(event.target.value) === normalizeAnswer(entry.english)) {
      gradeCurrentAnswer(event.target.value);
    }
  });
  document.querySelector("#answerInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      gradeCurrentAnswer(event.currentTarget.value);
    }
  });
  document.querySelector("#answerForm")?.addEventListener("submit", gradeAnswer);
}

async function handlePdfImport(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  setImporting(true);
  try {
    const imported = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str).join(" "));
      }
      imported.push(...extractLessonItems(pages.join("\n")));
    }
    const extracted = dedupeEntries(imported);
    if (!extracted.length) throw new Error("没有识别到重点单词或常考短语");
    state.imported = mergeImported(extracted);
    state.activeMode = "lesson";
    state.currentIndex.lesson = 0;
    state.lastImportName = files.map((file) => file.name).join("，");
    state.lastImportAt = new Date().toLocaleString("zh-CN");
    saveState();
    render();
  } catch (error) {
    alert(`导入失败：${error.message}`);
  } finally {
    setImporting(false);
    event.target.value = "";
  }
}

async function handleJsonImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const items = Array.isArray(payload) ? payload : payload.items || payload.imported || [];
    const normalized = normalizeImportedItems(items, "json");
    if (!normalized.length) throw new Error("JSON 里没有 english/chinese 词条");
    state.imported = mergeImported(dedupeEntries(normalized));
    state.activeMode = "lesson";
    state.lastImportName = file.name;
    state.lastImportAt = new Date().toLocaleString("zh-CN");
    saveState();
    render();
  } catch (error) {
    alert(`JSON 导入失败：${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function normalizeImportedItems(items, source) {
  return items
    .filter((item) => item.english && item.chinese)
    .map((item, index) => ({
      id: item.id || `${source}-${index}-${normalizeAnswer(item.english)}`,
      unit: item.unit || "导入词库",
      type: item.type || "word",
      english: String(item.english).trim(),
      chinese: String(item.chinese).trim(),
      source
    }));
}

function setImporting(isImporting) {
  const button = document.querySelector(".pdf-drop");
  if (button) button.classList.toggle("loading", isImporting);
}

function extractLessonItems(text) {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/重\s*点\s*单\s*词/g, "重点单词")
    .replace(/常\s*考\s*短\s*语/g, "常考短语")
    .replace(/经\s*典\s*句\s*型/g, "经典句型");
  const unitBlocks = normalized.split(/(?=Unit\s+\d+\s+)/i).filter((block) => /^Unit\s+\d+/i.test(block.trim()));
  const entries = [];

  unitBlocks.forEach((block) => {
    const unitMatch = block.match(/^(Unit\s+\d+)(.*?)(?=重点单词|重\s)/i);
    const unit = unitMatch ? `${unitMatch[1]} ${unitMatch[2].trim()}`.trim() : `Unit ${entries.length + 1}`;
    const wordText = sectionBetween(block, /(?:重点单词|重\s*点\s*单\s*词)/, /(?:常考短语|常\s*考\s*短\s*语|经典句型|经\s*典\s*句\s*型)/);
    const phraseText = sectionBetween(block, /(?:常考短语|常\s*考\s*短\s*语)/, /(?:经典句型|经\s*典\s*句\s*型|核心|核\s*心|语音)/);
    entries.push(...parsePairs(wordText, unit, "word"));
    entries.push(...parsePairs(phraseText, unit, "phrase"));
  });

  return dedupeEntries(entries);
}

function sectionBetween(block, startPattern, endPattern) {
  const start = block.search(startPattern);
  if (start < 0) return "";
  const rest = block.slice(start).replace(startPattern, " ");
  const end = rest.search(endPattern);
  return end >= 0 ? rest.slice(0, end) : rest;
}

function parsePairs(text, unit, type) {
  const cleaned = text
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const englishToken = "[A-Za-z][A-Za-z0-9’'().,!?-]*";
  const pattern = new RegExp(`((?:${englishToken}\\s*){1,6})([^A-Za-z]*[\\u4e00-\\u9fa5][^A-Za-z]*?)(?=\\s+${englishToken}|$)`, "g");
  const items = [];
  let match;
  while ((match = pattern.exec(cleaned))) {
    let english = match[1].replace(/[，。；：、]/g, "").replace(/\s+/g, " ").trim();
    const chinese = match[2].replace(/^[\s,，.。;；:：]+|[\s,，.。;；:：]+$/g, "").trim();
    if (english === "clock" && chinese.includes("表示整点")) english = "o'clock";
    if (normalizeAnswer(english).length < 2 || !/[\u4e00-\u9fa5]/.test(chinese)) continue;
    items.push({
      id: `${unit}-${type}-${normalizeAnswer(english)}`,
      unit,
      type,
      english,
      chinese,
      source: "pdf"
    });
  }
  return items;
}

function mergeImported(items) {
  const existingProgress = { ...state.progress };
  const merged = dedupeEntries(items);
  merged.forEach((item) => {
    if (existingProgress[item.id]) state.progress[item.id] = existingProgress[item.id];
  });
  return merged;
}

function dedupeEntries(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.unit}-${item.type}-${normalizeAnswer(item.english)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function editChinese(id) {
  const item = allEntries().find((entry) => entry.id === id);
  if (!item || item.source === "home-row") return;
  const next = prompt(`编辑 ${item.english} 的中文释义`, item.chinese);
  if (next == null) return;
  item.chinese = next.trim() || item.chinese;
  saveState();
  render();
}

function gradeAnswer(event) {
  event.preventDefault();
  const input = document.querySelector("#answerInput");
  if (!input) return;
  gradeCurrentAnswer(input.value);
}

function gradeCurrentAnswer(value) {
  const entry = currentEntry();
  if (!entry) return;
  const elapsedMinutes = Math.max((Date.now() - session.startedAt) / 60000, 0.1);
  const wpm = Math.round(session.typedChars / 5 / elapsedMinutes);
  const ok = normalizeAnswer(value) === normalizeAnswer(entry.english);
  const progress = entryProgress(entry.id);
  progress.lastPracticedAt = new Date().toISOString();

  if (state.activeMode === "dictation") {
    progress.dictationAttempts = (progress.dictationAttempts || 0) + 1;
    progress.dictationLastWpm = wpm;
    progress.dictationWpmTotal = (progress.dictationWpmTotal || 0) + wpm;
    progress.dictationDone = true;
    if (ok) {
      progress.dictationCorrect = (progress.dictationCorrect || 0) + 1;
      session.correct += 1;
      state.feedback = { entryId: entry.id, kind: "good", text: "答对了，继续下一题。" };
      advance();
    } else {
      progress.dictationWrong = (progress.dictationWrong || 0) + 1;
      session.wrong += 1;
      state.feedback = wrongFeedback(entry.id);
    }
  } else {
    progress.attempts += 1;
    progress.lastWpm = wpm;
    progress.wpmTotal += wpm;
    if (ok) {
      progress.correct += 1;
      progress.mastered = progress.correct >= 2 && progress.correct >= progress.wrong;
      session.correct += 1;
      state.feedback = { entryId: entry.id, kind: "good", text: "答对了，继续下一题。" };
      advance();
    } else {
      progress.wrong += 1;
      progress.mastered = false;
      session.wrong += 1;
      state.feedback = wrongFeedback(entry.id);
    }
  }
  saveState();
  if (ok) setTimeout(render, 360);
  else render();
}

function wrongFeedback(entryId) {
  return {
    entryId,
    kind: "bad",
    text: state.showTranslation ? "再试一次。英文已显示，对照后再打一遍。" : "再试一次。点“翻译”可以查看英文。"
  };
}

function advance() {
  const list = practiceList();
  if (!list.length) return;
  state.currentIndex[state.activeMode] = ((state.currentIndex[state.activeMode] || 0) + 1) % list.length;
  state.feedback = null;
}

function getNextExpectedKey(entry, typed = "") {
  if (!entry) return "";
  const answer = entry.english.toLowerCase().replace(/[^a-z,.;/]/g, "");
  const current = typed.toLowerCase().replace(/[^a-z,.;/]/g, "");
  return answer[current.length] || "";
}

function renderKeyboard(activeKey) {
  const keyboard = document.querySelector("#keyboard");
  const hint = document.querySelector("#fingerHint");
  if (!keyboard) return;
  keyboard.innerHTML = `
    ${KEYBOARD_ROWS.map((row) => `
      <div class="key-row">
        ${row.map((key) => `<button type="button" class="key ${FINGER_CLASSES[key] || ""} ${activeKey === key ? "active" : ""}">${key}</button>`).join("")}
      </div>
    `).join("")}
    <div class="key-row">
      <button type="button" class="key space thumb ${activeKey === " " ? "active" : ""}">Space</button>
    </div>
  `;
  if (hint) {
    hint.textContent = activeKey ? `下一个字母 ${activeKey.toUpperCase()}，用${FINGER_MAP[activeKey] || "对应手指"}。手腕放松，先准再快。` : "本题已输入完，按回车确认。";
  }
}

function calculateTotals(list = practiceList()) {
  const total = state.imported.length || BASE_WORDS.length;
  const progressValues = list.map((item) => state.progress[item.id]).filter(Boolean);
  const attempts = progressValues.reduce((sum, item) => sum + progressCounts(item).attempts, 0);
  const correct = progressValues.reduce((sum, item) => sum + progressCounts(item).correct, 0);
  const corpus = state.imported.length ? state.imported : BASE_WORDS;
  const overallDone = corpus.filter((item) => (state.progress[item.id]?.correct || 0) > 0).length;
  const currentDone = list.filter((item) => progressCounts(state.progress[item.id]).correct > 0).length;
  const dictationDone = corpus.filter((item) => (state.progress[item.id]?.dictationCorrect || 0) > 0).length;
  const englishCorrectAttempts = corpus.reduce((sum, item) => sum + (state.progress[item.id]?.correct || 0), 0);
  const dictationCorrectAttempts = corpus.reduce((sum, item) => sum + (state.progress[item.id]?.dictationCorrect || 0), 0);
  const review = allEntries().filter((item) => isWrongItem(item)).length;
  const wpmSamples = progressValues.map((item) => progressCounts(item).lastWpm).filter(Boolean);
  return {
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 100,
    wpm: wpmSamples.length ? Math.round(wpmSamples.reduce((sum, value) => sum + value, 0) / wpmSamples.length) : 0,
    overallDone,
    currentDone,
    total,
    dictationDone,
    englishCorrectAttempts,
    dictationCorrectAttempts,
    review,
    position: Math.min((state.currentIndex[state.activeMode] || 0) + 1, practiceList().length || 0)
  };
}

function progressCounts(progress = {}) {
  if (state.activeMode === "dictation") {
    return {
      attempts: progress.dictationAttempts || 0,
      correct: progress.dictationCorrect || 0,
      wrong: progress.dictationWrong || 0,
      lastWpm: progress.dictationLastWpm || 0
    };
  }
  return {
    attempts: progress.attempts || 0,
    correct: progress.correct || 0,
    wrong: progress.wrong || 0,
    lastWpm: progress.lastWpm || 0
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

render();
