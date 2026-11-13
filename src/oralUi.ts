// Oral exam screens: three drawn questions answered by voice or typing, then graded 0-5 each
// (by the AI grading service when it is available, always adjustable by the user), plus a
// learning mode over the whole bank. Logic lives in oral.ts, speech in speech.ts, the grading
// client in oralGrade.ts. Rendered inside the Exams tab by examUi.ts.
import { answerBlocks, clampScore, drawOral, oralResult, suggestScore, wordCount, MAX_ANSWER, OK_SCORE, type Coverage, type OralBank, type OralQuestion } from './oral';
import { recordAnswer, weightOf, dueQuestions, summarize, type Counts } from './examProgress';
import { readProgress, saveProgress, pushHistory, readHistory } from './examStore';
import { shuffle } from './exam';
import { getLang, tt, fmtNum } from './i18n';
import { ic } from './icons';
import { speechSupport, startSpeech, appendSpeech, SpeechFailure, type SpeechError, type SpeechSession } from './speech';
import { gradeConfigured, gradeAnswer, GradeError, type AiGrade, type GradeFail } from './oralGrade';

export const ORAL_ID = 'ustny';
type Mode = 'exam' | 'learn' | 'review';
const MODES: Mode[] = ['exam', 'learn', 'review'];
/** Answers shorter than this are not sent for grading (nothing to grade). */
const MIN_WORDS = 3;
const LEARN_COUNTS = [5, 10, 20];

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const L = {
  cardTitle: { pl: 'Egzamin ustny', en: 'Oral exam' },
  cardDesc: { pl: '3 pytania otwarte, odpowiadasz głosem lub pisząc', en: '3 open questions, answered by voice or typing' },
  inBank: { pl: 'pytań w bazie', en: 'questions in the bank' },
  loading: { pl: 'Wczytywanie pytań…', en: 'Loading questions…' },
  loadError: { pl: 'Nie udało się wczytać pytań egzaminu ustnego.', en: 'Could not load the oral exam questions.' },
  retry: { pl: 'Spróbuj ponownie', en: 'Try again' },
  plOnly: { pl: '', en: 'Questions and reference answers are in Polish, as on the real exam.' },
  examMode: { pl: 'Egzamin', en: 'Exam' },
  examModeHint: { pl: '3 losowe pytania, ocena na końcu', en: '3 random questions, graded at the end' },
  learnMode: { pl: 'Nauka', en: 'Learning' },
  learnModeHint: { pl: 'odpowiedź wzorcowa po każdym pytaniu', en: 'reference answer after each question' },
  reviewMode: { pl: 'Powtórka', en: 'Review' },
  reviewModeHint: { pl: 'tylko pytania do powtórki', en: 'only questions due for review' },
  rules: {
    pl: 'Jak na egzaminie: 3 pytania, za każde 0-5 punktów, zalicza 8 z 15. Na odpowiedź masz około 3 minut.',
    en: 'As on the real exam: 3 questions, 0-5 points each, 8 of 15 passes. About 3 minutes per answer.',
  },
  gradeAi: {
    pl: 'Odpowiedź porówna z wzorcem model AI i zaproponuje ocenę, którą możesz poprawić.',
    en: 'An AI model compares your answer with the reference one and suggests a score you can change.',
  },
  gradeSelf: {
    pl: 'Po odpowiedzi zobaczysz odpowiedź wzorcową i sam ocenisz, ile z niej powiedziałeś.',
    en: 'After answering you see the reference answer and rate how much of it you covered.',
  },
  allTopics: { pl: 'Wszystkie działy', en: 'All topics' },
  topics: { pl: 'Działy', en: 'Topics' },
  count: { pl: 'Liczba pytań', en: 'Questions' },
  questions: { pl: 'pytań', en: 'questions' },
  start: { pl: 'Rozpocznij', en: 'Start' },
  nothingDue: {
    pl: 'Nie masz teraz pytań do powtórki. Tryb Nauka podsunie Ci pytania, których jeszcze nie widziałeś.',
    en: 'Nothing is due for review right now. Learning mode will give you questions you have not seen yet.',
  },
  learnNew: { pl: 'Ucz się nowych pytań', en: 'Learn new questions' },
  progress: { pl: 'Twoje postępy', en: 'Your progress' },
  progressHint: {
    pl: 'Pytanie ocenione na 3 punkty lub więcej wraca po 1, 3, 7 i 21 dniach, słabsze od razu. Postępy są zapisane tylko na tym urządzeniu.',
    en: 'A question scored 3 or more comes back after 1, 3, 7 and 21 days, a weaker one right away. Progress is saved on this device only.',
  },
  stMastered: { pl: 'opanowane', en: 'mastered' },
  stLearning: { pl: 'w nauce', en: 'learning' },
  stWrong: { pl: 'słabe', en: 'weak' },
  stNew: { pl: 'nowe', en: 'not seen' },
  ofBank: { pl: 'z', en: 'of' },
  dueCount: { pl: 'do powtórki', en: 'due for review' },
  byTopic: { pl: 'Opanowanie działów', en: 'Mastery by topic' },
  drillHint: { pl: 'Dotknij działu, żeby go poćwiczyć.', en: 'Tap a topic to practise it.' },
  history: { pl: 'Ostatnie wyniki', en: 'Recent results' },
  checked: {
    pl: 'Pytania pochodzą z opracowań kandydatów, a odpowiedzi sprawdziliśmy z przepisami według stanu na',
    en: 'The questions come from candidates’ notes; the answers were checked against the law as of',
  },
  checkedTail: {
    pl: 'To pomoc do nauki, a nie oficjalne materiały PZŁ. Komisja może oczekiwać innego ujęcia tematu.',
    en: 'This is a study aid, not official PZŁ material. An examiner may expect a different take.',
  },
  questionOf: { pl: 'Pytanie', en: 'Question' },
  of: { pl: 'z', en: 'of' },
  nr: { pl: 'pytanie nr', en: 'question no.' },
  answerLabel: { pl: 'Twoja odpowiedź', en: 'Your answer' },
  answerHintMic: {
    pl: 'Dotknij mikrofonu i odpowiedz na głos, tak jak przed komisją. Tekst możesz potem poprawić.',
    en: 'Tap the microphone and answer aloud, as you would before the board. You can correct the text afterwards.',
  },
  answerHintType: {
    pl: 'Na tym urządzeniu nie ma zamiany mowy na tekst, więc odpowiedź wpisz. Możesz też odpowiedzieć na głos i od razu przejść do odpowiedzi wzorcowej.',
    en: 'This device has no speech to text, so type your answer. You can also answer aloud and go straight to the reference answer.',
  },
  placeholder: { pl: 'Tu pojawi się Twoja odpowiedź…', en: 'Your answer appears here…' },
  micStart: { pl: 'Odpowiedz głosem', en: 'Answer by voice' },
  micStop: { pl: 'Zatrzymaj nagrywanie', en: 'Stop listening' },
  micStarting: { pl: 'Włączam mikrofon…', en: 'Starting the microphone…' },
  listening: { pl: 'Słucham…', en: 'Listening…' },
  clear: { pl: 'Wyczyść', en: 'Clear' },
  timeUp: { pl: 'Czas minął. Dokończ myśl i przejdź dalej.', en: 'Time is up. Finish your thought and move on.' },
  next: { pl: 'Następne pytanie', en: 'Next question' },
  toGrade: { pl: 'Zakończ i oceń', en: 'Finish and grade' },
  check: { pl: 'Sprawdź odpowiedź', en: 'Check the answer' },
  quit: { pl: 'Przerwij', en: 'Quit' },
  consentMicTitle: { pl: 'Zanim włączysz mikrofon', en: 'Before you turn the microphone on' },
  consentMic: {
    pl: 'Mowę na tekst zamienia usługa rozpoznawania mowy Twojej przeglądarki albo telefonu (zwykle Google), więc dźwięk trafia na jej serwery. Aplikacja niczego nie nagrywa i nie przechowuje dźwięku.',
    en: 'Speech is turned into text by the speech service of your browser or phone (usually Google), so the audio goes to its servers. The app records nothing and stores no audio.',
  },
  consentAiTitle: { pl: 'Zanim wyślesz odpowiedź do oceny', en: 'Before you send an answer for grading' },
  consentAi: {
    pl: 'Tekst odpowiedzi wyślemy przez nasz serwer do modelu AI (Anthropic albo OpenAI), który porówna go z odpowiedzią wzorcową. Nie zapisujemy odpowiedzi i nie łączymy jej z Tobą, a do pilnowania dziennego limitu używamy anonimowego identyfikatora. Nie podawaj w odpowiedzi danych osobowych. Ocena AI to pomoc w nauce i może się mylić.',
    en: 'The text of your answer goes through our server to an AI model (Anthropic or OpenAI), which compares it with the reference answer. We do not store the answer or link it to you; an anonymous identifier is used only for the daily limit. Do not put personal data in the answer. The AI score is a study aid and can be wrong.',
  },
  consentOk: { pl: 'Rozumiem, dalej', en: 'I understand, continue' },
  consentNo: { pl: 'Nie teraz', en: 'Not now' },
  micDenied: {
    pl: 'Brak zgody na mikrofon. Włącz ją w ustawieniach przeglądarki lub telefonu albo wpisz odpowiedź.',
    en: 'Microphone access was refused. Allow it in the browser or phone settings, or type the answer.',
  },
  micNetwork: { pl: 'Rozpoznawanie mowy wymaga internetu. Wpisz odpowiedź albo spróbuj, gdy wróci zasięg.', en: 'Speech recognition needs the internet. Type the answer or try again with signal.' },
  micAudio: { pl: 'Mikrofon nie działa albo używa go inna aplikacja.', en: 'The microphone is not working or is used by another app.' },
  micLanguage: {
    pl: 'Usługa rozpoznawania mowy w tym telefonie nie obsługuje języka polskiego. Dodaj polski w ustawieniach wprowadzania głosowego albo wpisz odpowiedź.',
    en: 'The speech service on this phone does not support Polish. Add Polish in the voice input settings or type the answer.',
  },
  micUnavailable: { pl: 'Na tym urządzeniu nie ma usługi rozpoznawania mowy. Wpisz odpowiedź.', en: 'This device has no speech recognition service. Type the answer.' },
  micUnknown: { pl: 'Rozpoznawanie mowy przerwało pracę. Spróbuj jeszcze raz albo wpisz odpowiedź.', en: 'Speech recognition stopped. Try again or type the answer.' },
  gradeTitle: { pl: 'Ocena odpowiedzi', en: 'Grading' },
  gradeIntro: {
    pl: 'Porównaj swoje odpowiedzi z wzorcowymi. Zaznacz, co powiedziałeś, a podpowiemy ocenę. Możesz ją zmienić.',
    en: 'Compare your answers with the reference ones. Tick what you said and we suggest a score. You can change it.',
  },
  noAnswer: { pl: 'Brak zapisanej odpowiedzi.', en: 'No answer recorded.' },
  reference: { pl: 'Odpowiedź wzorcowa', en: 'Reference answer' },
  note: { pl: 'Uwaga', en: 'Note' },
  source: { pl: 'Źródło', en: 'Source' },
  points: { pl: 'Co powinno paść w odpowiedzi', en: 'What the answer should contain' },
  pointsHint: { pl: 'Zaznacz to, co powiedziałeś.', en: 'Tick what you said.' },
  ptYes: { pl: 'powiedziane', en: 'covered' },
  ptPartial: { pl: 'częściowo', en: 'partly' },
  ptNo: { pl: 'pominięte', en: 'missing' },
  score: { pl: 'Ocena', en: 'Score' },
  scoreHint: { pl: 'z punktów kluczowych wychodzi', en: 'the key points suggest' },
  pts: { pl: 'pkt', en: 'pts' },
  aiBtn: { pl: 'Oceń z AI', en: 'Grade with AI' },
  aiAllBtn: { pl: 'Oceń odpowiedzi z AI', en: 'Grade the answers with AI' },
  aiLoading: { pl: 'AI porównuje odpowiedź z wzorcem…', en: 'The AI is comparing your answer with the reference…' },
  aiScore: { pl: 'Ocena AI', en: 'AI score' },
  aiErrors: { pl: 'Błędy w odpowiedzi', en: 'Mistakes in the answer' },
  aiLeft: { pl: 'Pozostało dziś ocen AI', en: 'AI gradings left today' },
  aiAdjust: { pl: 'Ocenę możesz zmienić poniżej.', en: 'You can change the score below.' },
  aiTooShort: { pl: 'Odpowiedź jest za krótka, żeby ją ocenić z AI.', en: 'The answer is too short for AI grading.' },
  aiOffline: { pl: 'Brak internetu, więc AI nie oceni odpowiedzi. Oceń ją samodzielnie poniżej.', en: 'No internet, so the AI cannot grade the answer. Rate it yourself below.' },
  aiQuota: {
    pl: 'Dzienny limit ocen AI został wykorzystany. Oceń odpowiedź samodzielnie poniżej, a jutro limit się odnowi.',
    en: 'The daily limit of AI gradings is used up. Rate the answer yourself below; the limit renews tomorrow.',
  },
  aiUnavailable: { pl: 'Ocena AI jest chwilowo niedostępna. Oceń odpowiedź samodzielnie poniżej.', en: 'AI grading is unavailable right now. Rate the answer yourself below.' },
  showResult: { pl: 'Pokaż wynik', en: 'Show the result' },
  needScores: { pl: 'Oceń wszystkie odpowiedzi, żeby zobaczyć wynik.', en: 'Grade every answer to see the result.' },
  finish: { pl: 'Zakończ', en: 'Finish' },
  skip: { pl: 'Pomiń', en: 'Skip' },
  passed: { pl: 'Zaliczony', en: 'Passed' },
  failed: { pl: 'Niezaliczony', en: 'Not passed' },
  pass: { pl: 'próg zaliczenia', en: 'pass mark' },
  again: { pl: 'Nowe losowanie', en: 'New attempt' },
  back: { pl: 'Wybór egzaminu', en: 'Choose exam' },
  learnDone: { pl: 'Przerobione pytania', en: 'Questions done' },
  average: { pl: 'średnia ocena', en: 'average score' },
  noneGraded: { pl: 'Żadne pytanie nie zostało ocenione.', en: 'No question was graded.' },
};
const l = (k: keyof typeof L) => tt(L[k]);

type AiState = { state: 'idle' } | { state: 'loading' } | { state: 'done'; grade: AiGrade } | { state: 'error'; code: GradeFail };

interface Item {
  q: OralQuestion;
  answer: string;
  /** When the question was first shown (exam mode timer). */
  startedAt: number | null;
  coverage: Coverage[];
  score: number | null;
  ai: AiState;
  recorded: boolean;
}

interface Attempt {
  mode: Mode;
  items: Item[];
  index: number;
  phase: 'answer' | 'grade' | 'result';
}

interface Consent {
  mic: boolean;
  ai: boolean;
}

let bank: OralBank | null = null;
let loadState: 'idle' | 'loading' | 'done' | 'error' = 'idle';
let attempt: Attempt | null = null;
let setup = { mode: 'exam' as Mode, topic: '', count: 10 };
let rerender: () => void = () => {};
let ticker: ReturnType<typeof setInterval> | undefined;
/** Consent notice on screen, and what to do once it is accepted. */
let ask: { kind: keyof Consent; then: () => void } | null = null;
const mic = { session: null as SpeechSession | null, run: null as object | null, on: false, starting: false, error: null as SpeechError | null, interim: '' };

// ------------------------------------------------------------------ data

/** Loads the oral bank once; `onChange` is called when it arrives (or fails). */
export function loadOral(onChange: () => void): void {
  rerender = onChange;
  if (loadState === 'loading' || loadState === 'done') return;
  loadState = 'loading';
  fetch(`./exams/${ORAL_ID}.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((b: OralBank) => {
      bank = b;
      loadState = 'done';
    })
    .catch(() => {
      loadState = 'error';
    })
    .finally(() => rerender());
}

/** What the exam picker shows about the oral exam. */
export function oralCard(): { title: string; description: string; count: number | null } {
  return { title: bank ? tt(bank.title) : l('cardTitle'), description: bank ? tt(bank.description) : l('cardDesc'), count: bank?.questions.length ?? null };
}

/** An oral exam or learning run is under way (the picker is hidden then). */
export const oralBusy = (): boolean => !!attempt;

function readConsent(): Consent {
  try {
    const v = JSON.parse(localStorage.getItem('oralConsent.v1') ?? '{}');
    return { mic: v?.mic === true, ai: v?.ai === true };
  } catch {
    return { mic: false, ai: false };
  }
}
function giveConsent(kind: keyof Consent) {
  try {
    localStorage.setItem('oralConsent.v1', JSON.stringify({ ...readConsent(), [kind]: true }));
  } catch {
    /* storage unavailable: asked again next time */
  }
  sessionConsent[kind] = true;
}
/** Consent given on this page, in case storage is unavailable. */
const sessionConsent: Consent = { mic: false, ai: false };
const consented = (kind: keyof Consent) => sessionConsent[kind] || readConsent()[kind];

const topicName = (id: string) => {
  const t = bank?.topics.find((x) => x.id === id);
  return t ? tt(t.name) : id;
};

const newItem = (q: OralQuestion): Item => ({ q, answer: '', startedAt: null, coverage: q.points.map(() => 'no'), score: null, ai: { state: 'idle' }, recorded: false });

function startAttempt() {
  if (!bank) return;
  stopMic();
  ask = null;
  const progress = readProgress();
  const now = Date.now();
  const pool = setup.topic ? bank.questions.filter((q) => q.topic === setup.topic) : bank.questions;
  let qs: OralQuestion[];
  if (setup.mode === 'exam') qs = drawOral(bank.questions, bank.count);
  else if (setup.mode === 'review') qs = shuffle(dueQuestions(pool, progress, now).slice(0, setup.count));
  else qs = drawOral(pool, Math.min(setup.count, pool.length), Math.random, (q) => weightOf(progress[q.id], now));
  if (!qs.length) {
    attempt = null;
    return;
  }
  attempt = { mode: setup.mode, items: qs.map(newItem), index: 0, phase: 'answer' };
  startTicker();
}

/** Saves how the question went (once), for the repetition schedule. */
function record(it: Item) {
  if (it.recorded || it.score == null) return;
  it.recorded = true;
  const p = readProgress();
  saveProgress({ ...p, [it.q.id]: recordAnswer(p[it.q.id], it.score >= OK_SCORE, Date.now()) });
}

const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const timeLeft = (it: Item) => (bank?.minutesPerQuestion ?? 3) * 60_000 - (Date.now() - (it.startedAt ?? Date.now()));

/** Keeps the exam clock running and lets go of the microphone when the answer screen is left. */
function startTicker() {
  clearInterval(ticker);
  ticker = setInterval(() => {
    if (!attempt || attempt.phase !== 'answer') {
      stopMic();
      return clearInterval(ticker);
    }
    const box = document.getElementById('oral-answer');
    if (!box) {
      // Another tab of the app is on screen.
      stopMic();
      return;
    }
    const el = document.getElementById('oral-timer');
    if (!el) return;
    const left = timeLeft(attempt.items[attempt.index]);
    el.textContent = fmtTime(left);
    el.classList.toggle('low', left < 30_000);
    document.getElementById('oral-timeup')?.toggleAttribute('hidden', left > 0);
  }, 500);
}

// ------------------------------------------------------------------ speech

function stopMic() {
  mic.session?.stop();
  mic.session = null;
  mic.run = null;
  mic.on = false;
  mic.starting = false;
  mic.interim = '';
}

function setAnswerBox(it: Item) {
  const box = document.getElementById('oral-answer') as HTMLTextAreaElement | null;
  if (box && attempt?.phase === 'answer' && attempt.items[attempt.index] === it) {
    box.value = it.answer;
    box.scrollTop = box.scrollHeight;
  }
  showInterim();
}

function showInterim() {
  const el = document.getElementById('oral-interim');
  if (el) el.textContent = mic.on ? mic.interim || l('listening') : '';
}

async function startMic(it: Item) {
  if (mic.on || mic.starting) return;
  // Identifies this dictation: a late event of an earlier one must not touch the current state.
  const run = {};
  mic.run = run;
  mic.starting = true;
  mic.error = null;
  rerender();
  let over = false;
  try {
    const session = await startSpeech('pl-PL', {
      partial(text) {
        if (mic.run !== run) return;
        mic.interim = text;
        showInterim();
      },
      final(text) {
        it.answer = appendSpeech(it.answer, text).slice(0, MAX_ANSWER);
        if (mic.run !== run) return;
        mic.interim = '';
        setAnswerBox(it);
      },
      error(code) {
        if (mic.run === run) mic.error = code;
      },
      end() {
        over = true;
        if (mic.run !== run) return;
        mic.run = null;
        mic.session = null;
        mic.on = false;
        mic.starting = false;
        mic.interim = '';
        rerender();
      },
    });
    if (over) return;
    if (mic.run !== run) return session.stop(); // the question was left while the microphone was starting
    mic.session = session;
    mic.on = true;
  } catch (e) {
    if (mic.run !== run) return;
    mic.run = null;
    mic.error = e instanceof SpeechFailure ? e.code : 'unknown';
  }
  mic.starting = false;
  rerender();
}

// ------------------------------------------------------------------ AI grading

const canAi = (it: Item) => gradeConfigured() && wordCount(it.answer) >= MIN_WORDS;

async function runAi(it: Item) {
  if (it.ai.state === 'loading' || !canAi(it)) return;
  it.ai = { state: 'loading' };
  rerender();
  try {
    const grade = await gradeAnswer(it.q.nr, it.answer, it.q.points.length);
    it.ai = { state: 'done', grade };
    if (grade.points.length === it.q.points.length) it.coverage = [...grade.points];
    it.score = grade.score;
  } catch (e) {
    it.ai = { state: 'error', code: e instanceof GradeError ? e.code : 'unavailable' };
  }
  rerender();
}

/** Grades every answer of the attempt that can be graded and has not been yet. */
function runAiAll(a: Attempt) {
  for (const it of a.items) if (it.ai.state === 'idle' || it.ai.state === 'error') void runAi(it);
}

/** Runs `then` right away when the user has agreed to `kind` before, otherwise shows the notice first. */
function withConsent(kind: keyof Consent, then: () => void) {
  if (consented(kind)) return then();
  ask = { kind, then };
  rerender();
}

/** Entering the grading screen: answers nobody gave score 0; AI starts by itself once agreed to. */
function enterGrade(a: Attempt, items: Item[]) {
  stopMic();
  a.phase = 'grade';
  for (const it of items) if (a.mode === 'exam' && !wordCount(it.answer) && it.score == null) it.score = 0;
  if (a.mode === 'exam' && consented('ai')) for (const it of items) if (it.ai.state === 'idle') void runAi(it);
}

// ------------------------------------------------------------------ rendering

/** The oral exam inside the Exams tab. `cards` is the exam picker, shown above the setup screen. */
export function renderOral(onChange: () => void, cards: string): string {
  rerender = onChange;
  if (loadState === 'idle') loadOral(onChange);
  if (loadState === 'error')
    return `${cards}<div class="notice error">${l('loadError')}</div><div class="actions"><button type="button" class="btn" data-oral="reload">${l('retry')}</button></div>`;
  if (!bank) return `${cards}<p class="muted">${l('loading')}</p>`;
  if (!attempt) return cards + renderSetup(bank);
  if (attempt.phase === 'result') return renderResult(bank, attempt);
  if (attempt.phase === 'grade') return renderGrade(bank, attempt);
  return renderAnswer(attempt);
}

function stackBar(c: Counts, cls = '') {
  const seg = (k: 'mastered' | 'learning' | 'wrong' | 'new') => (c[k] ? `<span class="st-${k}" style="flex-grow:${c[k]}"></span>` : '');
  return `<span class="stack${cls}">${seg('mastered')}${seg('learning')}${seg('wrong')}${seg('new')}</span>`;
}

function renderSetup(b: OralBank) {
  const lang = getLang();
  const progress = readProgress();
  const now = Date.now();
  const sum = summarize(b.questions, progress, now);
  const dueHere = setup.topic ? (sum.byTopic.find((t) => t.topic === setup.topic)?.due ?? 0) : sum.due;
  const noReview = setup.mode === 'review' && !dueHere;
  const hist = readHistory()
    .filter((h) => h.bank === ORAL_ID)
    .slice(0, 5);
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB');
  const legend = (['mastered', 'learning', 'wrong', 'new'] as const)
    .map((k) => `<span><i class="st-${k}"></i>${l(`st${k[0].toUpperCase()}${k.slice(1)}` as keyof typeof L)} <b>${fmtNum(sum[k])}</b></span>`)
    .join('');
  return `${l('plOnly') ? `<p class="muted small">${l('plOnly')}</p>` : ''}
  <div class="seg-toggle" role="radiogroup">
    ${MODES.map(
      (m) => `<button type="button" role="radio" aria-checked="${setup.mode === m}" data-oral="mode" data-mode="${m}">
        <strong>${l(`${m}Mode`)}${m === 'review' && sum.due ? ` <span class="due-badge">${fmtNum(sum.due)}</span>` : ''}</strong><span>${l(`${m}ModeHint`)}</span></button>`,
    ).join('')}
  </div>
  ${
    setup.mode === 'exam'
      ? `<p class="small">${l('rules')}</p>`
      : `<div class="filters">
    <select data-oral-filter="count" aria-label="${l('count')}">${LEARN_COUNTS.map((n) => `<option value="${n}"${n === setup.count ? ' selected' : ''}>${n} ${l('questions')}</option>`).join('')}</select>
    <select data-oral-filter="topic" aria-label="${l('topics')}"><option value="">${l('allTopics')}</option>${b.topics
      .map((t) => `<option value="${esc(t.id)}"${t.id === setup.topic ? ' selected' : ''}>${esc(tt(t.name))}</option>`)
      .join('')}</select>
  </div>`
  }
  <p class="muted small">${gradeConfigured() ? l('gradeAi') : l('gradeSelf')}</p>
  ${
    noReview
      ? `<div class="notice small">${l('nothingDue')}</div><div class="actions"><button type="button" class="btn" data-oral="learnNew">${l('learnNew')}</button></div>`
      : `<button type="button" class="btn" data-oral="start">${l('start')}${setup.mode === 'review' ? ` <span class="small">(${fmtNum(Math.min(dueHere, setup.count))})</span>` : ''}</button>`
  }
  <h3>${l('progress')}</h3>
  <p class="progress-head"><b>${fmtNum(sum.mastered)}</b> ${l('ofBank')} ${fmtNum(sum.total)} ${l('stMastered')}${sum.due ? ` · <b>${fmtNum(sum.due)}</b> ${l('dueCount')}` : ''}</p>
  ${stackBar(sum, ' big')}
  <p class="prog-legend small">${legend}</p>
  <p class="muted small">${l('progressHint')}</p>
  <details class="prog-topics"><summary>${l('byTopic')}</summary><p class="muted small">${l('drillHint')}</p>
  ${b.topics
    .map((t) => ({ t, s: sum.byTopic.find((x) => x.topic === t.id) }))
    .filter((x) => x.s)
    .map(
      ({ t, s }) => `<button type="button" class="topic-row" data-oral="drill" data-topic="${esc(t.id)}"><span class="topic-name">${esc(tt(t.name))}</span>
      <span class="num small">${fmtNum(s!.mastered)}/${fmtNum(s!.total)}${s!.due ? ` · ${fmtNum(s!.due)} ${l('dueCount')}` : ''}</span>${stackBar(s!)}</button>`,
    )
    .join('')}</details>
  ${
    hist.length
      ? `<h3>${l('history')}</h3><ul class="history">${hist
          .map((h) => `<li><span>${date(h.date)}</span><span class="${h.passed ? 'ok' : 'bad'}">${h.correct}/${h.total} ${l('pts')}</span></li>`)
          .join('')}</ul>`
      : ''
  }
  <p class="muted small">${l('checked')} ${date(b.checked)}. ${l('checkedTail')}</p>`;
}

function consentBox() {
  if (!ask) return '';
  const mk = ask.kind === 'mic';
  return `<div class="notice oral-consent" role="alertdialog" aria-labelledby="oral-consent-t">
    <p id="oral-consent-t"><strong>${l(mk ? 'consentMicTitle' : 'consentAiTitle')}</strong></p>
    <p class="small">${l(mk ? 'consentMic' : 'consentAi')}</p>
    <div class="actions"><button type="button" class="btn" data-oral="consent">${l('consentOk')}</button>
    <button type="button" class="btn ghost" data-oral="consentNo">${l('consentNo')}</button></div></div>`;
}

const MIC_ERR: Record<SpeechError, keyof typeof L> = {
  denied: 'micDenied',
  network: 'micNetwork',
  audio: 'micAudio',
  language: 'micLanguage',
  unavailable: 'micUnavailable',
  unknown: 'micUnknown',
};

function renderAnswer(a: Attempt) {
  const it = a.items[a.index];
  if (a.mode === 'exam') it.startedAt ??= Date.now();
  const last = a.index === a.items.length - 1;
  const speech = speechSupport();
  const left = timeLeft(it);
  return `<div class="exam-head">
      <span>${l('questionOf')} ${a.index + 1} ${l('of')} ${a.items.length}</span>
      ${a.mode === 'exam' ? `<span id="oral-timer" class="timer${left < 30_000 ? ' low' : ''}">${fmtTime(left)}</span>` : ''}
    </div>
    <div class="progress"><span style="width:${(a.index / a.items.length) * 100}%"></span></div>
    <p class="eyebrow exam-topic">${esc(topicName(it.q.topic))} · ${l('nr')} ${it.q.nr}</p>
    <h2 class="exam-q">${esc(it.q.q)}</h2>
    <p class="muted small">${speech ? l('answerHintMic') : l('answerHintType')}</p>
    ${a.mode === 'exam' ? `<p id="oral-timeup" class="notice small"${left > 0 ? ' hidden' : ''}>${l('timeUp')}</p>` : ''}
    ${
      speech
        ? `<div class="oral-mic"><button type="button" class="btn oral-mic-btn${mic.on ? ' on' : ''}" data-oral="mic" aria-pressed="${mic.on}"${mic.starting ? ' disabled' : ''}>${ic('mic', 20)} ${
            mic.starting ? l('micStarting') : mic.on ? l('micStop') : l('micStart')
          }</button><span id="oral-interim" class="oral-interim small" aria-live="polite">${mic.on ? esc(mic.interim || l('listening')) : ''}</span></div>`
        : ''
    }
    ${ask?.kind === 'mic' ? consentBox() : ''}
    ${mic.error ? `<p class="notice error small">${l(MIC_ERR[mic.error])}</p>` : ''}
    <label class="oral-answer"><span class="small">${l('answerLabel')}</span>
      <textarea id="oral-answer" data-oral-input="answer" rows="7" maxlength="${MAX_ANSWER}" placeholder="${l('placeholder')}" lang="pl">${esc(it.answer)}</textarea></label>
    <div class="actions exam-nav">
      ${
        a.mode === 'exam'
          ? `<button type="button" class="btn" data-oral="${last ? 'toGrade' : 'next'}">${last ? l('toGrade') : `${l('next')} ${ic('chevron', 18)}`}</button>`
          : `<button type="button" class="btn" data-oral="check">${l('check')}</button>`
      }
      <button type="button" class="btn ghost" data-oral="clear">${l('clear')}</button>
      <button type="button" class="btn ghost" data-oral="quit">${l('quit')}</button>
    </div>`;
}

function refHtml(text: string) {
  return answerBlocks(text)
    .map((bl) => (bl.type === 'p' ? `<p>${esc(bl.text)}</p>` : `<${bl.type}>${bl.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${bl.type}>`))
    .join('');
}

const AI_ERR: Record<GradeFail, keyof typeof L> = { offline: 'aiOffline', quota: 'aiQuota', unconfigured: 'aiUnavailable', unavailable: 'aiUnavailable' };

function aiBlock(b: OralBank, it: Item, i: number, single: boolean) {
  if (!gradeConfigured()) return '';
  if (it.ai.state === 'loading') return `<p class="notice small oral-ai-wait" aria-live="polite">${l('aiLoading')}</p>`;
  if (it.ai.state === 'done') {
    const g = it.ai.grade;
    return `<div class="feedback ${g.score >= OK_SCORE ? 'ok' : 'bad'}" aria-live="polite"><strong>${l('aiScore')}: ${g.score}/${b.maxPerQuestion}</strong>
      ${g.feedback ? `<p>${esc(g.feedback)}</p>` : ''}
      ${g.errors.length ? `<p><b>${l('aiErrors')}:</b></p><ul class="small">${g.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      <p class="muted small">${l('aiAdjust')}${g.left != null ? ` ${l('aiLeft')}: ${fmtNum(g.left)}.` : ''}</p></div>`;
  }
  if (wordCount(it.answer) < MIN_WORDS) return it.answer.trim() ? `<p class="muted small">${l('aiTooShort')}</p>` : '';
  const retry = it.ai.state === 'error' && it.ai.code !== 'quota';
  return `${it.ai.state === 'error' ? `<p class="notice error small">${l(AI_ERR[it.ai.code])}</p>` : ''}
    ${single && (it.ai.state === 'idle' || retry) ? `<div class="actions"><button type="button" class="btn${it.ai.state === 'error' ? ' ghost' : ''}" data-oral="ai" data-i="${i}">${it.ai.state === 'error' ? l('retry') : l('aiBtn')}</button></div>` : ''}`;
}

function gradeCard(b: OralBank, a: Attempt, i: number, single: boolean) {
  const it = a.items[i];
  const suggested = suggestScore(it.coverage, b.maxPerQuestion);
  const ticked = it.coverage.some((c) => c !== 'no');
  return `<article class="card oral-grade">
    <p class="eyebrow">${a.items.length > 1 ? `${i + 1}. ` : ''}${esc(topicName(it.q.topic))} · ${l('nr')} ${it.q.nr}</p>
    <p><strong>${esc(it.q.q)}</strong></p>
    <h4>${l('answerLabel')}</h4>
    ${it.answer.trim() ? `<p class="oral-yours">${esc(it.answer)}</p>` : `<p class="muted small">${l('noAnswer')}</p>`}
    ${aiBlock(b, it, i, single)}
    <h4>${l('reference')}</h4>
    <div class="oral-ref">${refHtml(it.q.answer)}</div>
    ${it.q.note ? `<p class="notice small"><b>${l('note')}:</b> ${esc(it.q.note)}</p>` : ''}
    <p class="muted small">${l('source')}: ${esc(it.q.source)}</p>
    <h4>${l('points')}</h4>
    <p class="muted small">${l('pointsHint')}</p>
    <div class="oral-points">${it.q.points
      .map((p, k) => {
        const c = it.coverage[k];
        return `<button type="button" class="oral-point ${c}" data-oral="point" data-i="${i}" data-p="${k}" aria-pressed="${c === 'yes' ? 'true' : c === 'partial' ? 'mixed' : 'false'}">
          <span class="oral-box" aria-hidden="true">${c === 'yes' ? ic('check', 14) : ''}</span><span>${esc(p)}${c === 'partial' ? ` <em class="muted small">(${l('ptPartial')})</em>` : ''}</span></button>`;
      })
      .join('')}</div>
    <div class="oral-score-row"><span class="small"><b>${l('score')}</b>${ticked ? ` <span class="muted">(${l('scoreHint')} ${suggested})</span>` : ''}</span>
    <div class="oral-score" role="radiogroup" aria-label="${l('score')}">${Array.from({ length: b.maxPerQuestion + 1 }, (_, s) => `<button type="button" role="radio" aria-checked="${it.score === s}" data-oral="score" data-i="${i}" data-s="${s}">${s}</button>`).join('')}</div></div>
  </article>`;
}

function renderGrade(b: OralBank, a: Attempt) {
  if (a.mode !== 'exam') {
    const last = a.index === a.items.length - 1;
    const it = a.items[a.index];
    return `<div class="exam-head"><span>${l('questionOf')} ${a.index + 1} ${l('of')} ${a.items.length}</span></div>
    <div class="progress"><span style="width:${((a.index + 1) / a.items.length) * 100}%"></span></div>
    ${ask?.kind === 'ai' ? consentBox() : ''}
    ${gradeCard(b, a, a.index, true)}
    <div class="actions exam-nav">
      <button type="button" class="btn" data-oral="${last ? 'finish' : 'nextLearn'}">${last ? l('finish') : `${it.score == null ? l('skip') : l('next')} ${ic('chevron', 18)}`}</button>
      <button type="button" class="btn ghost" data-oral="${last ? 'quit' : 'finish'}">${last ? l('back') : l('finish')}</button>
    </div>`;
  }
  const missing = a.items.filter((it) => it.score == null).length;
  const idle = a.items.filter((it) => canAi(it) && (it.ai.state === 'idle' || (it.ai.state === 'error' && it.ai.code !== 'quota')));
  return `<h2>${l('gradeTitle')}</h2>
  <p class="small">${l('gradeIntro')}</p>
  ${ask?.kind === 'ai' ? consentBox() : idle.length ? `<div class="actions"><button type="button" class="btn" data-oral="aiAll">${ic('message', 18)} ${l('aiAllBtn')}</button></div>` : ''}
  ${a.items.map((_, i) => gradeCard(b, a, i, false)).join('')}
  ${missing ? `<p class="muted small">${l('needScores')}</p>` : ''}
  <div class="actions exam-nav">
    <button type="button" class="btn" data-oral="result"${missing ? ' disabled' : ''}>${l('showResult')}</button>
    <button type="button" class="btn ghost" data-oral="quit">${l('quit')}</button>
  </div>`;
}

function renderResult(b: OralBank, a: Attempt) {
  const rows = a.items
    .filter((it) => it.score != null)
    .map(
      (it) => `<tr><td>${esc(it.q.q)}<span class="bar"><span style="width:${((it.score ?? 0) / b.maxPerQuestion) * 100}%"></span></span></td>
      <td class="num ${(it.score ?? 0) >= OK_SCORE ? 'ok' : 'bad'}">${it.score}/${b.maxPerQuestion}</td></tr>`,
    )
    .join('');
  const actions = `<div class="actions"><button type="button" class="btn" data-oral="again">${l('again')}</button>
    <button type="button" class="btn ghost" data-oral="quit">${l('back')}</button></div>`;
  if (a.mode === 'exam') {
    const r = oralResult(
      a.items.map((it) => it.score),
      b,
    );
    return `<div class="result ${r.passed ? 'ok' : 'bad'}"><b>${r.points}/${r.max}</b>
      <span>${r.passed ? l('passed') : l('failed')} (${l('pass')} ${b.passPoints} ${l('pts')})</span></div>
      <table class="tbl"><tbody>${rows}</tbody></table>${actions}`;
  }
  const graded = a.items.filter((it) => it.score != null);
  const avg = graded.length ? graded.reduce((s, it) => s + (it.score ?? 0), 0) / graded.length : 0;
  return `<div class="result ${avg >= OK_SCORE ? 'ok' : 'bad'}"><b>${graded.length ? fmtNum(Math.round(avg * 10) / 10) : '–'}</b>
    <span>${graded.length ? `${l('average')} · ${l('learnDone')}: ${graded.length}` : l('noneGraded')}</span></div>
    ${rows ? `<table class="tbl"><tbody>${rows}</tbody></table>` : ''}${actions}`;
}

// ------------------------------------------------------------------ events

const toTop = () => document.getElementById('content')?.scrollTo({ top: 0 });

function finishExam(a: Attempt) {
  if (!bank || a.items.some((it) => it.score == null)) return;
  a.items.forEach(record);
  const r = oralResult(
    a.items.map((it) => it.score),
    bank,
  );
  pushHistory({ bank: ORAL_ID, date: new Date().toISOString(), correct: r.points, total: r.max, passed: r.passed });
  a.phase = 'result';
}

/** Handles clicks inside the oral exam. Returns true if the event was consumed. */
export function handleOralClick(el: HTMLElement): boolean {
  const action = el.dataset.oral;
  if (!action) return false;
  const a = attempt;
  const item = (): Item | undefined => a?.items[Number(el.dataset.i ?? a.index)];
  let top = true;
  switch (action) {
    case 'reload':
      loadState = 'idle';
      break;
    case 'mode':
      setup.mode = el.dataset.mode as Mode;
      break;
    case 'drill':
      setup = { ...setup, mode: 'learn', topic: el.dataset.topic ?? '' };
      startAttempt();
      break;
    case 'learnNew':
      setup.mode = 'learn';
      startAttempt();
      break;
    case 'start':
    case 'again':
      startAttempt();
      break;
    case 'mic': {
      top = false;
      if (!a || a.phase !== 'answer') break;
      if (mic.on) {
        // The last words still arrive; the button changes back when the service says it has ended.
        mic.session?.stop();
        return true;
      }
      const it = a.items[a.index];
      withConsent('mic', () => void startMic(it));
      return true;
    }
    case 'consent': {
      top = false;
      const pending = ask;
      ask = null;
      if (pending) {
        giveConsent(pending.kind);
        pending.then();
      }
      break;
    }
    case 'consentNo':
      top = false;
      ask = null;
      break;
    case 'clear':
      top = false;
      if (a?.phase === 'answer') a.items[a.index].answer = '';
      break;
    case 'next':
      if (a && a.index < a.items.length - 1) {
        stopMic();
        ask = null;
        a.index++;
      }
      break;
    case 'toGrade':
      if (a) {
        ask = null;
        enterGrade(a, a.items);
      }
      break;
    case 'check':
      if (a) {
        ask = null;
        enterGrade(a, [a.items[a.index]]);
      }
      break;
    case 'ai': {
      top = false;
      const it = item();
      if (it) withConsent('ai', () => void runAi(it));
      return true;
    }
    case 'aiAll':
      top = false;
      if (a) withConsent('ai', () => runAiAll(a));
      return true;
    case 'point': {
      top = false;
      const it = item();
      if (!it || !bank) break;
      const k = Number(el.dataset.p);
      it.coverage[k] = it.coverage[k] === 'yes' ? 'no' : 'yes';
      it.score = suggestScore(it.coverage, bank.maxPerQuestion);
      break;
    }
    case 'score': {
      top = false;
      const it = item();
      if (it && bank) it.score = clampScore(Number(el.dataset.s), bank.maxPerQuestion);
      break;
    }
    case 'nextLearn':
      if (a) {
        record(a.items[a.index]);
        ask = null;
        a.index = Math.min(a.items.length - 1, a.index + 1);
        a.phase = 'answer';
        startTicker();
      }
      break;
    case 'finish':
      if (a) {
        a.items.forEach(record);
        ask = null;
        a.phase = 'result';
      }
      break;
    case 'result':
      if (a) finishExam(a);
      break;
    case 'quit':
      stopMic();
      clearInterval(ticker);
      ask = null;
      attempt = null;
      break;
  }
  rerender();
  if (top) toTop();
  return true;
}

/** Typing in the answer box. Returns true if the event was consumed. */
export function handleOralInput(el: HTMLElement): boolean {
  if (el.dataset.oralInput !== 'answer') return false;
  if (attempt?.phase === 'answer') attempt.items[attempt.index].answer = (el as HTMLTextAreaElement).value.slice(0, MAX_ANSWER);
  return true;
}

export function handleOralChange(el: HTMLSelectElement | HTMLInputElement): boolean {
  const f = el.dataset.oralFilter;
  if (!f) return false;
  if (f === 'count') setup.count = Number(el.value) || 10;
  if (f === 'topic') setup.topic = el.value;
  rerender();
  return true;
}

/** Leaves a running oral exam (another exam was picked). */
export function leaveOral() {
  stopMic();
  clearInterval(ticker);
  ask = null;
  attempt = null;
}
