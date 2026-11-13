# Oral exam

The Exams tab has a third exam next to the two written tests: the oral part of the hunter exam. The candidate gets 3 open questions, answers each aloud (or by typing), and every answer is graded 0-5; 8 of 15 points pass. Learning and review modes go through the whole bank one question at a time and share the repetition schedule of the written tests.

## Questions and answers

`public/exams/ustny.json` holds 209 questions (numbers 1-210 of the list candidates circulate; there is no 191) in 14 topics. Each question has:

- `answer`: the reference answer (lines starting with `- ` are bullets, `1.` a numbered list),
- `points`: 3-8 key points a full answer contains; grading counts how many were covered,
- `source`: the legal basis or other source,
- `note` (optional): a caveat shown under the answer, used where sources disagree.

The answers were checked against the current law on the date in `checked`. When the law changes, fix the answer, its key points and the date. `src/oral.test.ts` fails when a question lacks an answer, key points, a source or a known topic.

## In the app

- `src/oral.ts`: drawing three questions from different topics, scoring, the bank check. Pure and unit-tested.
- `src/oralUi.ts`: the screens. Progress and results are stored with those of the written tests (`src/examStore.ts`), question ids are `u<number>`. A score of 3 or more counts as "knew it" for the schedule.
- `src/speech.ts`: speech to text. On the website it is the browser's Web Speech API (Chrome, Edge, Safari; Firefox has none, so the answer is typed). In the Android app it is `SpeechPlugin.java`, which uses the phone's speech recognition service. The transcript is editable. The first use shows what happens with the audio: it goes to the browser's or phone's speech service; the app records and stores nothing.
- `src/oralGrade.ts`: the client of the grading service. Without the service, offline or over the daily limit, the user rates the answer themselves by ticking the key points.

## Grading service (`worker/`)

A Cloudflare Worker. The app sends `POST /grade` with `{ nr, answer }` and the ID token of the app's anonymous Firebase sign-in; the Worker adds the reference answer and the key points, asks the model and returns `{ score, points, errors, feedback, left }`.

- **Model**: `MODEL_PROVIDER` in `worker/wrangler.jsonc` is `anthropic` (Claude Haiku 5.5, through the official SDK with structured output) or `openai` (GPT-6 Luna). The other one is the fallback when its key is set.
- **Prompt and checks** (`worker/src/prompt.ts`): the candidate's text is wrapped in its own tag with angle brackets removed and the model is told to treat it as material to grade, not instructions. The model first decides the coverage of every key point, then the score. The returned score may differ from what the covered points give by at most +1/-2, so an answer that talks the model into a top score still cannot get it.
- **Who may call it**: a valid Firebase ID token for the project in `FIREBASE_PROJECT_ID` is required (`worker/src/auth.ts` checks the signature against Google's keys). Browser calls are accepted only from the pages in `ALLOWED_ORIGINS`.
- **Limits** per day in Polish time: `LIMIT_USER` (9 = three exams) per sign-in, `LIMIT_IP` (60) per network address, `LIMIT_GLOBAL` (2000) in total. Counters live in a Durable Object (`worker/src/counters.ts`) as one-way fingerprints that change daily and are deleted the next day. A failed grading is not counted.
- **Privacy**: answers are not stored or logged; logs hold only the question number, model, time and score.
- **Cost**: about 1,500 input and 400 output tokens per answer, roughly $0.35 per 1,000 graded answers at $0.10 / $0.50 per million tokens. The global limit caps a day at under $1.

### Deployment

`.github/workflows/worker.yml` tests the Worker on pull requests and deploys it on pushes to `main` (or "Run workflow"). It needs the repository secrets `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers"), `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY` and optionally `OPENAI_API_KEY`, and the repository variable `FIREBASE_PROJECT_ID` (already used by the site).

The site and app builds ask Cloudflare for the account's `workers.dev` subdomain (`scripts/oral-api-url.mjs`) and build the address `https://polowanie-oral.<subdomain>.workers.dev` into the app as `VITE_ORAL_API_URL`, but only when the service answers. Set the repository variable `ORAL_API_URL` to use another address (for example a custom domain). After the first deployment, run the site workflow once more if the oral exam still shows self-rating only.

Locally: `cd worker && npm ci && npm test`, `npx wrangler dev` (put the keys in `worker/.dev.vars`, which is not committed).

### Choosing the model

`worker/eval/control.json` has 42 answers written like speech-to-text output and scored by hand: full, partial, wrong, off-topic, empty and two that try to talk the grader into a top score. `npm run eval` (in `worker/`, with the API keys in the environment) grades them with every model that has a key and reports the mean error, agreement with the hand scores, speed and cost. The workflow "Oral exam model comparison" does the same on GitHub when the prompt, a provider or the control set changes in a pull request, and on demand; the table is in the run summary. Keep the model with the smaller error, and add an answer to the control set whenever a user reports a grade that was clearly off.
