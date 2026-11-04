import { drawSectionedExam, isCorrect, scoreExam, answerText, answerImage, type Answer, type Bank, type DrawnQuestion, type ExamResult } from './exam';
import { seasonQuestions, SEASON_TOPIC } from './seasonQuestions';
import { getLang, tt, fmtNum } from './i18n';

const BANK_IDS = ['mysliwy', 'selekcjoner'] as const;
type BankId = (typeof BANK_IDS)[number];
type Mode = 'exam' | 'learn';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const L = {
  intro: {
    pl: 'Testy próbne z losowanymi pytaniami – przy każdym podejściu inny zestaw i inna kolejność odpowiedzi.',
    en: 'Practice tests with random questions – a different set and answer order on every attempt.',
  },
  examMode: { pl: 'Egzamin', en: 'Exam' },
  examModeHint: { pl: 'z limitem czasu, wynik na końcu', en: 'timed, score at the end' },
  learnMode: { pl: 'Nauka', en: 'Learning' },
  learnModeHint: { pl: 'odpowiedź i wyjaśnienie od razu', en: 'answer and explanation right away' },
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
  prev: { pl: '← Poprzednie', en: '← Previous' },
  next: { pl: 'Następne →', en: 'Next →' },
  finish: { pl: 'Zakończ i sprawdź', en: 'Finish and check' },
  quit: { pl: 'Przerwij', en: 'Quit' },
  confirmFinish: { pl: 'Bez odpowiedzi', en: 'Unanswered' },
  correctAns: { pl: 'Dobrze!', en: 'Correct!' },
  wrongAns: { pl: 'Źle – poprawna odpowiedź:', en: 'Wrong – correct answer:' },
  passed: { pl: 'Zaliczony', en: 'Passed' },
  failed: { pl: 'Niezaliczony', en: 'Not passed' },
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
let setup = { bank: 'mysliwy' as BankId, mode: 'exam' as Mode, count: 0, topic: '' };
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
    localStorage.setItem('examHistory', JSON.stringify([e, ...readHistory()].slice(0, 20)));
  } catch {
    /* storage unavailable */
  }
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
  } catch {
    loadState = 'error';
  }
  rerender();
}

const topicsOf = (b: Bank) => [...new Set(b.questions.map((q) => q.topic))].sort((a, c) => a.localeCompare(c, 'pl'));

function startAttempt() {
  const b = banks.get(setup.bank)!;
  const count = setup.count || b.count;
  const drawn = drawSectionedExam(b, count, Math.random, setup.topic ? [setup.topic] : undefined);
  attempt = {
    bank: b,
    mode: setup.mode,
    drawn,
    answers: drawn.map(() => undefined),
    index: 0,
    deadline: setup.mode === 'exam' ? Date.now() + Math.round((b.minutes * 60000 * drawn.length) / b.count) : null,
    result: null,
    timedOut: false,
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
  const hist = readHistory().slice(0, 5);
  const counts = [10, 20, 30, 50].filter((n) => n <= b.questions.length);
  const count = setup.count || b.count;
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
    ${(['exam', 'learn'] as Mode[])
      .map(
        (m) => `<button type="button" role="radio" aria-checked="${setup.mode === m}" data-exam="mode" data-mode="${m}">
        <strong>${l(m === 'exam' ? 'examMode' : 'learnMode')}</strong><span>${l(m === 'exam' ? 'examModeHint' : 'learnModeHint')}</span></button>`,
      )
      .join('')}
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
    .map((x) => ` · ${esc(x.name[getLang()])}: ${x.count} ${l('questions')}${x.minPct != null ? `, min. ${x.minPct}%` : ''}`)
    .join('')}</p>
  <button type="button" class="btn" data-exam="start">${l('start')}</button>`
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

function renderQuestion(a: Attempt) {
  const d = a.drawn[a.index];
  const chosen = a.answers[a.index];
  const multi = d.correct.length > 1;
  const reveal = a.mode === 'learn' && !!chosen?.length && (!multi || chosen.length >= d.correct.length);
  const answered = a.answers.filter((x) => x?.length).length;
  const last = a.index === a.drawn.length - 1;
  return `<div class="exam-head">
      <span>${l('questionOf')} ${a.index + 1} ${l('of')} ${a.drawn.length}</span>
      ${a.deadline ? `<span id="exam-timer" class="timer">${fmtTime(a.deadline - Date.now())}</span>` : ''}
    </div>
    <div class="progress"><span style="width:${((a.mode === 'exam' ? answered : a.index + (reveal ? 1 : 0)) / a.drawn.length) * 100}%"></span></div>
    <p class="eyebrow exam-topic">${esc(sectionName(a.bank, d.question.section) ?? d.question.topic)}${sectionName(a.bank, d.question.section) && d.question.topic !== sectionName(a.bank, d.question.section) ? ` · ${esc(d.question.topic)}` : ''}</p>
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
          ${d.question.explanation ? `<p>${esc(d.question.explanation)}</p>` : ''}${sourceLink(d)}</div>`
        : ''
    }
    <div class="actions exam-nav">
      ${a.mode === 'exam' && a.index > 0 ? `<button type="button" class="btn ghost" data-exam="prev">${l('prev')}</button>` : ''}
      ${!last ? `<button type="button" class="btn${a.mode === 'learn' && !reveal ? ' ghost' : ''}" data-exam="next">${l('next')}</button>` : ''}
      ${last || a.mode === 'exam' ? `<button type="button" class="btn${last ? '' : ' ghost'}" data-exam="finish">${l('finish')}${a.mode === 'exam' && answered < a.drawn.length ? ` <span class="muted small">(${l('confirmFinish')}: ${a.drawn.length - answered})</span>` : ''}</button>` : ''}
      <button type="button" class="btn ghost" data-exam="quit">${l('quit')}</button>
    </div>
    ${a.mode === 'exam' ? `<div class="dots">${a.drawn.map((_, i) => `<button type="button" data-exam="goto" data-i="${i}" class="${i === a.index ? 'cur' : ''}${a.answers[i]?.length ? ' done' : ''}" aria-label="${i + 1}">${i + 1}</button>`).join('')}</div>` : ''}`;
}

const sectionName = (b: Bank, id: string | undefined) => (id ? b.sections?.find((x) => x.id === id) : undefined)?.name[getLang()];

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
      ? `<table class="tbl sections"><tbody>${r.bySection
          .map(
            (x) => `<tr class="${x.passed ? '' : 'sec-fail'}"><td><strong>${esc(sectionName(a.bank, x.id) ?? x.id)}</strong>${x.minPct != null ? ` <span class="muted small">(${l('min')}. ${x.minPct}%)</span>` : ''}<span class="bar"><span style="width:${x.pct}%"></span></span></td>
            <td class="num">${x.correct}/${x.total} · ${fmtNum(x.pct)}%${x.minPct != null ? (x.passed ? ' ✓' : ' ✗') : ''}</td></tr>`,
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
      <p class="small ok-text">✓ ${answersInline(d, d.correct)}</p>
      ${d.question.explanation ? `<p class="small">${esc(d.question.explanation)}</p>` : ''}${sourceLink(d)}</article>`,
          )
          .join('')
  }`;
}

// ------------------------------------------------------------------ events

/** Handles clicks inside the exam tab. Returns true if the event was consumed. */
export function handleExamClick(el: HTMLElement): boolean {
  const action = el.dataset.exam;
  if (!action) return false;
  switch (action) {
    case 'pick':
      setup = { ...setup, bank: el.dataset.bank as BankId, count: 0, topic: '' };
      break;
    case 'mode':
      setup.mode = el.dataset.mode as Mode;
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
      clearInterval(timer);
      attempt = null;
      break;
  }
  rerender();
  document.getElementById('content')?.scrollTo({ top: 0 });
  return true;
}

export function handleExamChange(el: HTMLSelectElement): boolean {
  const f = el.dataset.examFilter;
  if (!f) return false;
  if (f === 'count') setup.count = Number(el.value);
  if (f === 'topic') setup.topic = el.value;
  rerender();
  return true;
}
