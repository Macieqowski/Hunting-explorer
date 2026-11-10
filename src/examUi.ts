import { drawExam, weightedSample, isCorrect, scoreExam, shuffle, shuffleAnswers, answerText, answerImage, type Answer, type Bank, type DrawnQuestion, type ExamResult, type Question } from './exam';
import { recordAnswer, weightOf, dueQuestions, summarize, mostMissed, parseProgress, mergeProgress, type Progress, type Counts } from './examProgress';
import { seasonQuestions, SEASON_TOPIC } from './seasonQuestions';
import { getLang, tt, fmtNum } from './i18n';
import { speciesIn } from './atlasMatch';
import { speciesBySlug } from './atlas';
import { saveTextFile } from './platform';
import { ic } from './icons';

const BANK_IDS = ['mysliwy', 'selekcjoner'] as const;
type BankId = (typeof BANK_IDS)[number];
type Mode = 'exam' | 'learn' | 'review';
const MODES: Mode[] = ['exam', 'learn', 'review'];

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const L = {
  intro: {
    pl: 'Testy próbne z losowanymi pytaniami – przy każdym podejściu inny zestaw i inna kolejność odpowiedzi.',
    en: 'Practice tests with random questions – a different set and answer order on every attempt.',
  },
  examMode: { pl: 'Egzamin', en: 'Exam' },
  examModeHint: { pl: 'z limitem czasu, wynik na końcu', en: 'timed, score at the end' },
  inAtlas: { pl: 'W atlasie', en: 'In the atlas' },
  speciesDrill: { pl: 'Pytania o gatunek', en: 'Questions about' },
  learnMode: { pl: 'Nauka', en: 'Learning' },
  learnModeHint: { pl: 'odpowiedź od razu, częściej słabe pytania', en: 'answer right away, weak questions more often' },
  reviewMode: { pl: 'Powtórka', en: 'Review' },
  reviewModeHint: { pl: 'tylko pytania do powtórki', en: 'only questions due for review' },
  nothingDue: {
    pl: 'Nie masz teraz pytań do powtórki. Tryb Nauka podsunie Ci pytania, których jeszcze nie widziałeś.',
    en: 'Nothing is due for review right now. Learning mode will give you questions you have not seen yet.',
  },
  learnNew: { pl: 'Ucz się nowych pytań', en: 'Learn new questions' },
  dueCount: { pl: 'do powtórki', en: 'due for review' },
  progress: { pl: 'Twoje postępy', en: 'Your progress' },
  progressHint: {
    pl: 'Pytania z błędną odpowiedzią wracają od razu, a dobrze rozwiązane po 1, 3, 7 i 21 dniach. Postępy są zapisane tylko na tym urządzeniu.',
    en: 'Questions you get wrong come back right away, right ones after 1, 3, 7 and 21 days. Progress is saved on this device only.',
  },
  stMastered: { pl: 'opanowane', en: 'mastered' },
  stLearning: { pl: 'w nauce', en: 'learning' },
  stWrong: { pl: 'błędne', en: 'wrong' },
  stNew: { pl: 'nowe', en: 'not seen' },
  ofBank: { pl: 'z', en: 'of' },
  byTopic: { pl: 'Opanowanie działów', en: 'Mastery by topic' },
  drillHint: { pl: 'Dotknij działu, żeby go poćwiczyć.', en: 'Tap a topic to practise it.' },
  missed: { pl: 'Najczęściej mylone pytania', en: 'Most missed questions' },
  missedTimes: { pl: 'błędów', en: 'wrong' },
  trend: { pl: 'Wyniki egzaminów', en: 'Exam scores' },
  trendHint: { pl: 'ostatnie podejścia, linia = próg zaliczenia', en: 'recent attempts, line = pass mark' },
  exportBtn: { pl: 'Eksportuj postępy', en: 'Export progress' },
  importBtn: { pl: 'Importuj postępy', en: 'Import progress' },
  resetBtn: { pl: 'Wyzeruj postępy', en: 'Reset progress' },
  resetConfirm: { pl: 'Na pewno? Dotknij jeszcze raz', en: 'Sure? Tap again' },
  imported: { pl: 'Zaimportowano postępy', en: 'Progress imported' },
  importError: { pl: 'To nie jest plik z postępami.', en: 'This is not a progress file.' },
  resetDone: { pl: 'Postępy wyzerowane', en: 'Progress reset' },
  questions: { pl: 'pytań', en: 'questions' },
  pass: { pl: 'próg zaliczenia', en: 'pass mark' },
  min: { pl: 'min', en: 'min' },
  start: { pl: 'Rozpocznij', en: 'Start' },
  count: { pl: 'Liczba pytań', en: 'Questions' },
  topics: { pl: 'Działy', en: 'Topics' },
  allTopics: { pl: 'Wszystkie działy', en: 'All topics' },
  noQuestions: {
    pl: 'Baza pytań PZŁ dla tego egzaminu nie została jeszcze dodana.',
    en: 'The PZŁ question bank for this exam has not been added yet.',
  },
  onlySeasons: {
    pl: 'Baza pytań PZŁ nie została jeszcze dodana – na razie dostępne są tylko pytania o okresy polowań, generowane z rozporządzenia.',
    en: 'The PZŁ question bank has not been added yet – for now only hunting-season questions generated from the regulation are available.',
  },
  official: { pl: 'Oficjalny test PZŁ „Sprawdź wiedzę” ↗', en: 'Official PZŁ “Sprawdź wiedzę” quiz ↗' },
  questionOf: { pl: 'Pytanie', en: 'Question' },
  of: { pl: 'z', en: 'of' },
  prev: { pl: 'Poprzednie', en: 'Previous' },
  next: { pl: 'Następne', en: 'Next' },
  finish: { pl: 'Zakończ i sprawdź', en: 'Finish and check' },
  quit: { pl: 'Przerwij', en: 'Quit' },
  confirmFinish: { pl: 'Bez odpowiedzi', en: 'Unanswered' },
  correctAns: { pl: 'Dobrze!', en: 'Correct!' },
  wrongAns: { pl: 'Źle – poprawna odpowiedź:', en: 'Wrong – correct answer:' },
  passed: { pl: 'Zaliczony', en: 'Passed' },
  failed: { pl: 'Niezaliczony', en: 'Not passed' },
  minSection: { pl: 'min.', en: 'min.' },
  timeUp: { pl: 'Koniec czasu', en: 'Time is up' },
  review: { pl: 'Przegląd błędnych odpowiedzi', en: 'Review of wrong answers' },
  allCorrect: { pl: 'Wszystkie odpowiedzi poprawne – gratulacje!', en: 'All answers correct – well done!' },
  yourAnswer: { pl: 'Twoja odpowiedź', en: 'Your answer' },
  none: { pl: 'brak', en: 'none' },
  again: { pl: 'Nowe losowanie', en: 'New attempt' },
  back: { pl: 'Wybór egzaminu', en: 'Choose exam' },
  history: { pl: 'Ostatnie wyniki', en: 'Recent results' },
  source: { pl: 'źródło', en: 'source' },
  loading: { pl: 'Wczytywanie pytań…', en: 'Loading questions…' },
  loadError: { pl: 'Nie udało się wczytać pytań.', en: 'Could not load questions.' },
  inBank: { pl: 'pytań w bazie', en: 'questions in the bank' },
};
const l = (k: keyof typeof L) => tt(L[k]);

interface HistoryEntry {
  bank: BankId;
  date: string;
  correct: number;
  total: number;
  passed: boolean;
}

interface Attempt {
  bank: Bank;
  mode: Mode;
  drawn: DrawnQuestion[];
  answers: (number[] | undefined)[];
  index: number;
  deadline: number | null;
  result: ExamResult | null;
  timedOut: boolean;
  /** Indices of questions already recorded in the progress (learning modes record on reveal). */
  recorded: Set<number>;
}

const banks = new Map<BankId, Bank>();

/** Image paths in banks are relative to the exams folder unless they are absolute URLs. */
const imgUrl = (src: string) => (/^(https?:)?\/\//.test(src) || src.startsWith('data:') ? src : `./exams/${src.replace(/^\.?\//, '')}`);
const img = (src: string | undefined, cls: string, alt = '') =>
  src ? `<img class="${cls}" src="${esc(imgUrl(src))}" alt="${esc(alt)}" loading="lazy" />` : '';
/** Answer as HTML: optional image plus text. */
const answerHtml = (a: Answer) => `${img(answerImage(a), 'ans-img', answerText(a))}${answerText(a) ? `<span>${esc(answerText(a))}</span>` : ''}`;
/** Answer list for summaries (text, or "[obraz]" for image-only answers). */
const answersInline = (d: DrawnQuestion, idx: number[]) =>
  idx.map((c) => `<span class="ans-inline">${answerHtml(d.answers[c])}</span>`).join(', ');
let loadState: 'idle' | 'loading' | 'done' | 'error' = 'idle';
let attempt: Attempt | null = null;
let setup = { bank: 'mysliwy' as BankId, mode: 'exam' as Mode, count: 0, topic: '', species: '' };
/** Questions per species drill run. */
const DRILL_COUNT = 20;
let resetArmed = false;
let toolNote = '';
let timer: ReturnType<typeof setInterval> | undefined;
let rerender: () => void = () => {};

function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem('examHistory') ?? '[]');
  } catch {
    return [];
  }
}
function pushHistory(e: HistoryEntry) {
  try {
    localStorage.setItem('examHistory', JSON.stringify([e, ...readHistory()].slice(0, 50)));
  } catch {
    /* storage unavailable */
  }
}

const PROGRESS_KEY = 'examProgress.v1';
let progressCache: Progress | null = null;
function readProgress(): Progress {
  if (progressCache) return progressCache;
  try {
    progressCache = parseProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}'));
  } catch {
    progressCache = {};
  }
  return progressCache;
}
function saveProgress(p: Progress) {
  progressCache = p;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}
/** Records the answer to question `i` of the attempt once. */
function record(a: Attempt, i: number) {
  if (a.recorded.has(i)) return;
  a.recorded.add(i);
  const p = readProgress();
  const id = a.drawn[i].question.id;
  saveProgress({ ...p, [id]: recordAnswer(p[id], isCorrect(a.drawn[i], a.answers[i]), Date.now()) });
}

/** The learning-mode answer to the current question is complete, so it is shown and recorded. */
const revealed = (a: Attempt, i: number) => {
  const chosen = a.answers[i];
  return a.mode !== 'exam' && !!chosen?.length && chosen.length >= a.drawn[i].correct.length;
};

function exportProgress() {
  const data = { app: 'hunting-explorer', kind: 'examProgress', version: 1, exported: new Date().toISOString(), progress: readProgress(), history: readHistory() };
  void saveTextFile(`postepy-egzamin-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify(data)).catch(() => {});
}

async function importProgress(file: File) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.kind !== 'examProgress') throw new Error('kind');
    saveProgress(mergeProgress(readProgress(), parseProgress(data.progress)));
    if (Array.isArray(data.history)) {
      const seen = new Set(readHistory().map((h) => h.date));
      const merged = [...readHistory(), ...(data.history as HistoryEntry[]).filter((h) => h?.date && !seen.has(h.date))].sort((x, y) => y.date.localeCompare(x.date));
      try {
        localStorage.setItem('examHistory', JSON.stringify(merged.slice(0, 50)));
      } catch {
        /* storage unavailable */
      }
    }
    toolNote = l('imported');
  } catch {
    toolNote = l('importError');
  }
  rerender();
}

async function loadBanks() {
  loadState = 'loading';
  try {
    for (const id of BANK_IDS) {
      const res = await fetch(`./exams/${id}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      const b = (await res.json()) as Bank;
      if (id === 'mysliwy') b.questions = [...b.questions, ...seasonQuestions()];
      banks.set(id, b);
    }
    loadState = 'done';
    if (setup.species && !attempt) startAttempt();
  } catch {
    loadState = 'error';
  }
  rerender();
}

const topicsOf = (b: Bank) => [...new Set(b.questions.map((q) => q.topic))].sort((a, c) => a.localeCompare(c, 'pl'));

/** Questions of a bank that are about an atlas species (matched on the question text). */
const aboutSpecies = (b: Bank, slug: string) => b.questions.filter((q) => speciesIn(q.q).includes(slug));

function startAttempt() {
  const b = banks.get(setup.bank)!;
  const count = setup.count || b.count;
  const topics = setup.topic ? [setup.topic] : undefined;
  const progress = readProgress();
  const now = Date.now();
  let drawn: DrawnQuestion[];
  if (setup.species) {
    // Both banks: the hunter and selekcjoner questions about one species belong together.
    const pool = BANK_IDS.flatMap((id) => aboutSpecies(banks.get(id)!, setup.species));
    drawn = weightedSample(pool, Math.min(DRILL_COUNT, pool.length), (q) => weightOf(progress[q.id], now)).map((q) => shuffleAnswers(q));
  } else if (setup.mode === 'review') {
    const due = dueQuestions(b.questions, progress, now).filter((q) => !topics || topics.includes(q.topic));
    drawn = shuffle(due.slice(0, count)).map((q) => shuffleAnswers(q));
    if (!drawn.length) {
      attempt = null;
      return;
    }
  } else if (setup.mode === 'learn') {
    drawn = drawExam(b.questions, count, Math.random, topics, b.sections, (q) => weightOf(progress[q.id], now));
  } else drawn = drawExam(b.questions, count, Math.random, topics, b.sections);
  attempt = {
    bank: b,
    mode: setup.mode,
    drawn,
    answers: drawn.map(() => undefined),
    index: 0,
    deadline: setup.mode === 'exam' ? Date.now() + Math.round((b.minutes * 60000 * drawn.length) / b.count) : null,
    result: null,
    timedOut: false,
    recorded: new Set(),
  };
  startTimer();
}

function startTimer() {
  clearInterval(timer);
  if (!attempt?.deadline) return;
  timer = setInterval(() => {
    if (!attempt || attempt.result || !attempt.deadline) return clearInterval(timer);
    const left = attempt.deadline - Date.now();
    const el = document.getElementById('exam-timer');
    if (left <= 0) {
      attempt.timedOut = true;
      finish();
      rerender();
    } else if (el) {
      el.textContent = fmtTime(left);
      el.classList.toggle('low', left < 60000);
    }
  }, 500);
}

const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function finish() {
  if (!attempt || attempt.result) return;
  clearInterval(timer);
  attempt.result = scoreExam(attempt.drawn, attempt.answers, attempt.bank.passPct, attempt.bank.sections);
  // Exam mode records every question (unanswered = wrong); learning modes only the ones answered.
  attempt.drawn.forEach((_, i) => {
    if (attempt!.mode === 'exam' || attempt!.answers[i]?.length) record(attempt!, i);
  });
  if (attempt.mode === 'exam')
    pushHistory({
      bank: attempt.bank.id as BankId,
      date: new Date().toISOString(),
      correct: attempt.result.correct,
      total: attempt.result.total,
      passed: attempt.result.passed,
    });
}

// ------------------------------------------------------------------ rendering

export function renderExams(onChange: () => void): string {
  rerender = onChange;
  if (loadState === 'idle') loadBanks();
  if (loadState !== 'done') return `<p class="muted">${loadState === 'error' ? l('loadError') : l('loading')}</p>`;
  if (attempt?.result) return renderResult(attempt);
  if (attempt) return renderQuestion(attempt);
  return renderSetup();
}

function renderSetup() {
  const lang = getLang();
  const b = banks.get(setup.bank)!;
  const topics = topicsOf(b);
  const pzlCount = b.questions.filter((q) => q.topic !== SEASON_TOPIC).length;
  const hist = readHistory()
    .filter((h) => h.bank === setup.bank)
    .slice(0, 5);
  const counts = [10, 20, 30, 50].filter((n) => n <= b.questions.length);
  const count = setup.count || b.count;
  const progress = readProgress();
  const now = Date.now();
  const sum = summarize(b.questions, progress, now);
  const dueHere = setup.topic ? (sum.byTopic.find((t) => t.topic === setup.topic)?.due ?? 0) : sum.due;
  const noReview = setup.mode === 'review' && !dueHere;
  return `<p class="small">${l('intro')}</p>
  <div class="exam-cards">${BANK_IDS.map((id) => {
    const bk = banks.get(id)!;
    return `<button type="button" class="exam-card${id === setup.bank ? ' active' : ''}" data-exam="pick" data-bank="${id}">
      <strong>${esc(tt(bk.title))}</strong><span class="muted small">${esc(bk.description ? tt(bk.description) : '')}</span>
      <span class="muted small">${fmtNum(bk.questions.length)} ${l('inBank')}</span></button>`;
  }).join('')}</div>
  ${
    !b.questions.length
      ? `<div class="notice">${l('noQuestions')}</div>`
      : `${pzlCount === 0 ? `<div class="notice small">${l('onlySeasons')}</div>` : ''}
  <div class="seg-toggle" role="radiogroup">
    ${MODES.map(
      (m) => `<button type="button" role="radio" aria-checked="${setup.mode === m}" data-exam="mode" data-mode="${m}">
        <strong>${l(`${m}Mode`)}${m === 'review' && sum.due ? ` <span class="due-badge">${fmtNum(sum.due)}</span>` : ''}</strong><span>${l(`${m}ModeHint`)}</span></button>`,
    ).join('')}
  </div>
  <div class="filters">
    <select data-exam-filter="count" aria-label="${l('count')}">${[...new Set([...counts, Math.min(b.count, b.questions.length)])]
      .sort((x, y) => x - y)
      .map((n) => `<option value="${n}"${n === Math.min(count, b.questions.length) ? ' selected' : ''}>${n} ${l('questions')}</option>`)
      .join('')}</select>
    <select data-exam-filter="topic" aria-label="${l('topics')}"><option value="">${l('allTopics')}</option>${topics
      .map((t) => `<option${t === setup.topic ? ' selected' : ''}>${esc(t)}</option>`)
      .join('')}</select>
  </div>
  <p class="muted small">${setup.mode === 'exam' ? `${b.minutes} ${l('min')} / ${b.count} ${l('questions')} · ` : ''}${l('pass')}: ${b.passPct}%${(b.sections ?? [])
    .filter((s) => s.minPct != null)
    .map((s) => ` · ${esc(tt(s.name))}: ${l('minSection')} ${s.minPct}%`)
    .join('')}</p>
  ${
    noReview
      ? `<div class="notice small">${l('nothingDue')}</div><button type="button" class="btn" data-exam="learnNew">${l('learnNew')}</button>`
      : `<button type="button" class="btn" data-exam="start">${l('start')}${setup.mode === 'review' ? ` <span class="small">(${fmtNum(Math.min(dueHere, count))})</span>` : ''}</button>`
  }
  ${renderProgress(b, progress, sum)}`
  }
  ${b.origin?.url ? `<p><a href="${esc(b.origin.url)}" target="_blank" rel="noopener">${l('official')}</a></p>` : ''}
  ${
    hist.length
      ? `<h3>${l('history')}</h3><ul class="history">${hist
          .map(
            (h) => `<li><span>${new Date(h.date).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')} · ${esc(tt(banks.get(h.bank)?.title ?? { pl: h.bank, en: h.bank }))}</span>
          <span class="${h.passed ? 'ok' : 'bad'}">${h.correct}/${h.total}</span></li>`,
          )
          .join('')}</ul>`
      : ''
  }`;
}

/** Stacked bar: mastered / learning / wrong / not seen. */
function stackBar(c: Counts, cls = '') {
  const seg = (k: keyof Counts, name: string) => (c[k] ? `<span class="st-${name}" style="flex-grow:${c[k]}"></span>` : '');
  return `<span class="stack${cls}">${seg('mastered', 'mastered')}${seg('learning', 'learning')}${seg('wrong', 'wrong')}${seg('new', 'new')}</span>`;
}

function renderProgress(b: Bank, progress: Progress, sum: ReturnType<typeof summarize>) {
  const lang = getLang();
  const missed = mostMissed(b.questions, progress, 10);
  const scores = readHistory()
    .filter((h) => h.bank === b.id && h.total > 0)
    .slice(0, 20)
    .reverse();
  const legend = (['mastered', 'learning', 'wrong', 'new'] as const)
    .map((k) => `<span><i class="st-${k}"></i>${l(`st${k[0].toUpperCase()}${k.slice(1)}` as keyof typeof L)} <b>${fmtNum(sum[k])}</b></span>`)
    .join('');
  const correctOf = (q: Question) => (Array.isArray(q.correct) ? q.correct : [q.correct]);
  const W = 300;
  const H = 70;
  const bw = W / Math.max(scores.length, 10);
  const yOf = (pct: number) => H - (pct / 100) * H;
  const trend = scores.length
    ? `<h3>${l('trend')}</h3><p class="muted small">${l('trendHint')}</p>
    <svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${l('trend')}">
      ${scores
        .map((h, i) => {
          const pct = (h.correct / h.total) * 100;
          return `<rect class="${h.passed ? 'ok' : 'bad'}" x="${i * bw + 1}" y="${yOf(pct)}" width="${Math.max(1, bw - 2)}" height="${H - yOf(pct)}"><title>${new Date(h.date).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')}: ${fmtNum(pct)}%</title></rect>`;
        })
        .join('')}
      <line x1="0" x2="${W}" y1="${yOf(b.passPct)}" y2="${yOf(b.passPct)}" />
    </svg>`
    : '';
  return `<h3>${l('progress')}</h3>
  <p class="progress-head"><b>${fmtNum(sum.mastered)}</b> ${l('ofBank')} ${fmtNum(sum.total)} ${l('stMastered')}${sum.due ? ` · <b>${fmtNum(sum.due)}</b> ${l('dueCount')}` : ''}</p>
  ${stackBar(sum, ' big')}
  <p class="prog-legend small">${legend}</p>
  <p class="muted small">${l('progressHint')}</p>
  <details class="prog-topics"><summary>${l('byTopic')}</summary><p class="muted small">${l('drillHint')}</p>
  ${sum.byTopic
    .map(
      (t) => `<button type="button" class="topic-row" data-exam="drill" data-topic="${esc(t.topic)}"><span class="topic-name">${esc(t.topic)}</span>
      <span class="num small">${fmtNum(t.mastered)}/${fmtNum(t.total)}${t.due ? ` · ${fmtNum(t.due)} ${l('dueCount')}` : ''}</span>${stackBar(t)}</button>`,
    )
    .join('')}</details>
  ${
    missed.length
      ? `<details class="prog-missed"><summary>${l('missed')}</summary>${missed
          .map(
            (q) => `<article class="card review"><p class="eyebrow">${esc(q.topic)} · ${progress[q.id].wrong} ${l('missedTimes')}</p><p><strong>${esc(q.q)}</strong></p>${img(q.image, 'q-img small-img')}
            <p class="small ok-text">${ic('check', 16)} ${correctOf(q)
              .map((c) => `<span class="ans-inline">${answerHtml(q.answers[c])}</span>`)
              .join(', ')}</p></article>`,
          )
          .join('')}</details>`
      : ''
  }
  ${trend}
  <div class="actions prog-tools">
    <button type="button" class="btn ghost small" data-exam="export">${l('exportBtn')}</button>
    <label class="btn ghost small">${l('importBtn')}<input type="file" accept="application/json,.json" data-exam-filter="import" hidden /></label>
    <button type="button" class="btn ghost small${resetArmed ? ' danger' : ''}" data-exam="reset">${l(resetArmed ? 'resetConfirm' : 'resetBtn')}</button>
  </div>
  ${toolNote ? `<p class="small muted">${esc(toolNote)}</p>` : ''}`;
}

function renderQuestion(a: Attempt) {
  const d = a.drawn[a.index];
  const chosen = a.answers[a.index];
  const multi = d.correct.length > 1;
  const reveal = a.mode !== 'exam' && !!chosen?.length && (!multi || chosen.length >= d.correct.length);
  const answered = a.answers.filter((x) => x?.length).length;
  const last = a.index === a.drawn.length - 1;
  return `<div class="exam-head">
      <span>${l('questionOf')} ${a.index + 1} ${l('of')} ${a.drawn.length}</span>
      ${a.deadline ? `<span id="exam-timer" class="timer">${fmtTime(a.deadline - Date.now())}</span>` : ''}
    </div>
    <div class="progress"><span style="width:${((a.mode === 'exam' ? answered : a.index + (reveal ? 1 : 0)) / a.drawn.length) * 100}%"></span></div>
    <p class="eyebrow exam-topic">${esc(d.question.topic)}${setup.species ? ` · ${l('speciesDrill')}: ${esc(tt(speciesBySlug(setup.species)?.name ?? { pl: '', en: '' }))}` : ''}</p>
    <h2 class="exam-q">${esc(d.question.q)}</h2>
    ${img(d.question.image, 'q-img')}
    <div class="answers" role="${multi ? 'group' : 'radiogroup'}">${d.answers
      .map((ans, i) => {
        const sel = chosen?.includes(i);
        const cls = reveal ? (d.correct.includes(i) ? ' right' : sel ? ' wrong' : '') : sel ? ' selected' : '';
        return `<button type="button" class="answer${cls}" data-exam="answer" data-i="${i}" ${reveal ? 'disabled' : ''} aria-pressed="${!!sel}">
          <span class="letter">${String.fromCharCode(65 + i)}</span><span class="ans-body">${answerHtml(ans)}</span></button>`;
      })
      .join('')}</div>
    ${
      reveal
        ? `<div class="feedback ${isCorrect(d, chosen) ? 'ok' : 'bad'}"><strong>${isCorrect(d, chosen) ? l('correctAns') : `${l('wrongAns')} ${answersInline(d, d.correct)}`}</strong>
          ${d.question.explanation ? `<p>${esc(d.question.explanation)}</p>` : ''}${sourceLink(d)}${atlasChips(d)}</div>`
        : ''
    }
    <div class="actions exam-nav">
      ${a.mode === 'exam' && a.index > 0 ? `<button type="button" class="btn ghost" data-exam="prev">${ic('back', 18)} ${l('prev')}</button>` : ''}
      ${!last ? `<button type="button" class="btn${a.mode !== 'exam' && !reveal ? ' ghost' : ''}" data-exam="next">${l('next')} ${ic('chevron', 18)}</button>` : ''}
      ${last || a.mode === 'exam' ? `<button type="button" class="btn${last ? '' : ' ghost'}" data-exam="finish">${l('finish')}${a.mode === 'exam' && answered < a.drawn.length ? ` <span class="muted small">(${l('confirmFinish')}: ${a.drawn.length - answered})</span>` : ''}</button>` : ''}
      <button type="button" class="btn ghost" data-exam="quit">${l('quit')}</button>
    </div>
    ${a.mode === 'exam' ? `<div class="dots">${a.drawn.map((_, i) => `<button type="button" data-exam="goto" data-i="${i}" class="${i === a.index ? 'cur' : ''}${a.answers[i]?.length ? ' done' : ''}" aria-label="${i + 1}">${i + 1}</button>`).join('')}</div>` : ''}`;
}

/** Links to the atlas pages of the species a question is about. */
function atlasChips(d: DrawnQuestion) {
  const sps = speciesIn(d.question.q)
    .map((slug) => speciesBySlug(slug))
    .filter((sp) => !!sp);
  if (!sps.length) return '';
  return `<p class="small atlas-chips">${l('inAtlas')}: ${sps
    .map((sp) => `<a href="#/atlas/${sp.slug}" data-atlas="go" data-slug="${sp.slug}">${esc(tt(sp.name))}</a>`)
    .join(', ')}</p>`;
}

function sourceLink(d: DrawnQuestion) {
  const s = d.question.source;
  if (!s) return '';
  return /^https?:\/\//.test(s)
    ? `<p class="small"><a href="${esc(s)}" target="_blank" rel="noopener">${l('source')} ↗</a></p>`
    : `<p class="small muted">${l('source')}: ${esc(s)}</p>`;
}

function renderResult(a: Attempt) {
  const r = a.result!;
  const wrong = a.drawn.map((d, i) => ({ d, i })).filter(({ d, i }) => !isCorrect(d, a.answers[i]));
  return `${a.timedOut ? `<div class="notice small">${l('timeUp')}</div>` : ''}
  <div class="result ${r.passed ? 'ok' : 'bad'}">
    <b>${fmtNum(r.pct)}%</b>
    <span>${r.correct} / ${r.total} · ${r.passed ? l('passed') : l('failed')} (${l('pass')} ${a.bank.passPct}%)</span>
  </div>
  ${
    r.bySection.length
      ? `<table class="tbl"><tbody>${r.bySection
          .map(
            (s) => `<tr><td><b>${esc(tt(s.name))}</b>${s.minPct != null ? ` <span class="muted small">(${l('minSection')} ${s.minPct}%)</span>` : ''}<span class="bar"><span style="width:${s.pct}%"></span></span></td><td class="num ${s.passed ? 'ok' : 'bad'}">${s.correct}/${s.total}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : ''
  }
  <table class="tbl"><tbody>${r.byTopic
    .map(
      (t) => `<tr><td>${esc(t.topic)}<span class="bar"><span style="width:${(t.correct / t.total) * 100}%"></span></span></td><td class="num">${t.correct}/${t.total}</td></tr>`,
    )
    .join('')}</tbody></table>
  <div class="actions"><button type="button" class="btn" data-exam="again">${l('again')}</button>
    <button type="button" class="btn ghost" data-exam="quit">${l('back')}</button></div>
  <h3>${l('review')}</h3>
  ${
    !wrong.length
      ? `<p>${l('allCorrect')}</p>`
      : wrong
          .map(
            ({ d, i }) => `<article class="card review">
      <p class="eyebrow">${i + 1}. ${esc(d.question.topic)}</p><p><strong>${esc(d.question.q)}</strong></p>${img(d.question.image, 'q-img small-img')}
      <p class="small bad-text">${l('yourAnswer')}: ${a.answers[i]?.length ? answersInline(d, a.answers[i]!) : l('none')}</p>
      <p class="small ok-text">${ic('check', 16)} ${answersInline(d, d.correct)}</p>
      ${d.question.explanation ? `<p class="small">${esc(d.question.explanation)}</p>` : ''}${sourceLink(d)}${atlasChips(d)}</article>`,
          )
          .join('')
  }`;
}

// ------------------------------------------------------------------ events

/** Handles clicks inside the exam tab. Returns true if the event was consumed. */
export function handleExamClick(el: HTMLElement): boolean {
  const action = el.dataset.exam;
  if (!action) return false;
  if (action !== 'reset') resetArmed = false;
  toolNote = '';
  switch (action) {
    case 'drill':
      setup = { ...setup, mode: 'learn', topic: el.dataset.topic ?? '', species: '' };
      startAttempt();
      break;
    case 'learnNew':
      setup.mode = 'learn';
      setup.species = '';
      startAttempt();
      break;
    case 'export':
      exportProgress();
      return true;
    case 'reset':
      if (resetArmed) {
        saveProgress({});
        try {
          localStorage.removeItem('examHistory');
        } catch {
          /* storage unavailable */
        }
        resetArmed = false;
        toolNote = l('resetDone');
      } else resetArmed = true;
      rerender();
      return true;
    case 'pick':
      setup = { ...setup, bank: el.dataset.bank as BankId, count: 0, topic: '', species: '' };
      break;
    case 'mode':
      setup.mode = el.dataset.mode as Mode;
      setup.species = '';
      break;
    case 'start':
    case 'again':
      startAttempt();
      break;
    case 'answer': {
      if (!attempt) break;
      const d = attempt.drawn[attempt.index];
      const i = Number(el.dataset.i);
      if (d.correct.length > 1) {
        const cur = new Set(attempt.answers[attempt.index] ?? []);
        if (cur.has(i)) cur.delete(i);
        else cur.add(i);
        attempt.answers[attempt.index] = [...cur];
      } else attempt.answers[attempt.index] = [i];
      if (revealed(attempt, attempt.index)) record(attempt, attempt.index);
      break;
    }
    case 'prev':
      if (attempt) attempt.index = Math.max(0, attempt.index - 1);
      break;
    case 'next':
      if (attempt) attempt.index = Math.min(attempt.drawn.length - 1, attempt.index + 1);
      break;
    case 'goto':
      if (attempt) attempt.index = Number(el.dataset.i);
      break;
    case 'finish':
      finish();
      break;
    case 'quit':
      setup.species = '';
      clearInterval(timer);
      attempt = null;
      break;
  }
  rerender();
  document.getElementById('content')?.scrollTo({ top: 0 });
  return true;
}

export function handleExamChange(el: HTMLSelectElement | HTMLInputElement): boolean {
  const f = el.dataset.examFilter;
  if (!f) return false;
  if (f === 'import') {
    const file = (el as HTMLInputElement).files?.[0];
    if (file) importProgress(file);
    (el as HTMLInputElement).value = '';
    return true;
  }
  if (f === 'count') setup.count = Number(el.value);
  if (f === 'topic') setup.topic = el.value;
  rerender();
  return true;
}

// ------------------------------------------------------------------ atlas links

/** Starts a learning run with the questions about one atlas species (loads the banks if needed). */
export function drillSpecies(slug: string, onChange: () => void) {
  rerender = onChange;
  clearInterval(timer);
  attempt = null;
  setup = { ...setup, mode: 'learn', topic: '', species: slug };
  if (loadState === 'done') startAttempt();
  else if (loadState === 'idle') loadBanks();
}

/** Number of exam questions about a species in both banks, or null while the banks load. */
export function speciesQuestionCount(slug: string, onChange: () => void): number | null {
  if (loadState === 'idle') {
    rerender = onChange;
    loadBanks();
  }
  if (loadState !== 'done') return null;
  return BANK_IDS.reduce((n, id) => n + aboutSpecies(banks.get(id)!, slug).length, 0);
}
