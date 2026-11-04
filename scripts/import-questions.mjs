#!/usr/bin/env node
/**
 * Imports exam questions from a CSV/TSV file into a bank JSON in public/exams/.
 *
 * Usage:
 *   node scripts/import-questions.mjs <input.csv> <public/exams/mysliwy.json> [--replace]
 *
 * Expected columns (header row required, names case-insensitive; separator ; , or TAB):
 *   temat | pytanie | a | b | c | d [| e ...] | poprawna | wyjasnienie | zrodlo
 * Optional image columns: obraz (question image) and obraz_a, obraz_b, ... (answer images).
 * Image values are paths relative to public/exams/ (e.g. img/mysliwy/123.png) or URLs.
 * "poprawna" is a letter (A–F) or a 1-based number; several correct answers: "A,C".
 * Without --replace, questions are added to the bank (same id = overwritten).
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const [input, target, flag] = process.argv.slice(2);
if (!input || !target) {
  console.error('Usage: node scripts/import-questions.mjs <input.csv> <bank.json> [--replace]');
  process.exit(1);
}

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = ['\t', ';', ','].map((s) => [s, firstLine.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const rows = parseCsv(fs.readFileSync(input, 'utf8'));
const header = rows.shift().map((h) => h.trim().toLowerCase());
const col = (...names) => header.findIndex((h) => names.includes(h));
const iTopic = col('temat', 'topic', 'dział', 'dzial', 'kategoria');
const iQ = col('pytanie', 'question', 'treść', 'tresc');
const iCorrect = col('poprawna', 'correct', 'odpowiedź poprawna', 'prawidłowa', 'prawidlowa');
const iExpl = col('wyjasnienie', 'wyjaśnienie', 'explanation', 'komentarz');
const iSrc = col('zrodlo', 'źródło', 'source');
const iImg = col('obraz', 'image', 'img', 'zdjęcie', 'zdjecie');
const answerImgCol = (letter) => col(`obraz_${letter}`, `image_${letter}`, `img_${letter}`);
const answerCols = header.map((h, i) => (/^(odp\.?\s*|odpowiedź\s*|odpowiedz\s*)?[a-f]$/.test(h) ? i : -1)).filter((i) => i >= 0);
if (iQ < 0 || iCorrect < 0 || answerCols.length < 2) {
  console.error('Missing columns. Found header:', header.join(' | '));
  process.exit(1);
}

const questions = [];
const problems = [];
rows.forEach((r, n) => {
  const q = (r[iQ] ?? '').trim();
  const qImage = iImg >= 0 ? (r[iImg] ?? '').trim() : '';
  const answers = answerCols
    .map((i) => {
      const text = (r[i] ?? '').trim();
      const ic = answerImgCol(header[i].slice(-1));
      const image = ic >= 0 ? (r[ic] ?? '').trim() : '';
      return image ? { ...(text ? { text } : {}), image } : text;
    })
    .filter((a) => (typeof a === 'string' ? a : a.image));
  const correct = String(r[iCorrect] ?? '')
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map((t) => (/^\d+$/.test(t) ? Number(t) - 1 : t.toUpperCase().charCodeAt(0) - 65));
  if ((!q && !qImage) || answers.length < 2 || !correct.length || correct.some((c) => c < 0 || c >= answers.length)) {
    problems.push(`row ${n + 2}: skipped (question/answers/correct missing or invalid)`);
    return;
  }
  const id = crypto.createHash('sha1').update(q + '|' + qImage + '|' + JSON.stringify(answers)).digest('hex').slice(0, 10);
  questions.push({
    id,
    topic: (iTopic >= 0 && r[iTopic]?.trim()) || 'Ogólne',
    q,
    ...(qImage ? { image: qImage } : {}),
    answers,
    correct: correct.length === 1 ? correct[0] : correct,
    ...(iExpl >= 0 && r[iExpl]?.trim() ? { explanation: r[iExpl].trim() } : {}),
    ...(iSrc >= 0 && r[iSrc]?.trim() ? { source: r[iSrc].trim() } : {}),
  });
});

const bank = JSON.parse(fs.readFileSync(target, 'utf8'));
const map = new Map((flag === '--replace' ? [] : bank.questions).map((q) => [q.id, q]));
for (const q of questions) map.set(q.id, q);
bank.questions = [...map.values()];
fs.writeFileSync(target, JSON.stringify(bank, null, 2) + '\n');
console.log(`Imported ${questions.length} questions → ${target} (now ${bank.questions.length}).`);
if (problems.length) console.warn(problems.join('\n'));
