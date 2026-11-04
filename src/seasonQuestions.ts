import type { Question, Rng } from './exam';
import { shuffle } from './exam';
import { SEASONS, effective, formatRanges } from './seasons';

export const SEASON_TOPIC = 'Okresy polowań';
const SOURCE = 'https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html';

/**
 * Generates single-choice questions about hunting seasons straight from the regulation data
 * in seasons.ts, so they can never drift from the seasons table. Polish only (exam language).
 */
export function seasonQuestions(rng: Rng = Math.random): Question[] {
  const label = (s: (typeof SEASONS)[number]) => {
    const e = effective(s);
    return formatRanges(e.ranges, e.allYear, 'pl');
  };
  const all = SEASONS.map((s) => ({ s, text: label(s) }));
  const distinct = [...new Set(all.map((x) => x.text))];
  const out: Question[] = [];
  for (const { s, text } of all) {
    const others = shuffle(
      distinct.filter((d) => d !== text),
      rng,
    ).slice(0, 3);
    if (others.length < 3) continue;
    const answers = [text, ...others];
    const hasRegional = s.variants?.some((v) => v.voivodeships);
    out.push({
      id: `season-${s.name.pl}`,
      topic: SEASON_TOPIC,
      q: `Okres polowań: ${s.name.pl}${hasRegional ? ' (zasada ogólna, bez wyjątków regionalnych)' : ''}`,
      answers,
      correct: 0,
      explanation: [
        `Zgodnie z rozporządzeniem w sprawie okresów polowań: ${text}.`,
        ...(s.variants ?? []).map((v) => `Wyjątek – ${v.voivodeships ? 'woj. ' + v.voivodeships.join(', ') : v.condition!.pl}: ${formatRanges(v.ranges, !!v.allYear, 'pl')}.`),
        ...(s.note ? [s.note.pl] : []),
      ].join(' '),
      source: SOURCE,
    });
  }
  // Which animals may be hunted all year / are fully protected.
  const allYear = SEASONS.filter((s) => s.allYear).map((s) => s.name.pl);
  const notAllYear = SEASONS.filter((s) => !s.allYear && s.ranges.length).map((s) => s.name.pl);
  for (const name of allYear) {
    out.push({
      id: `season-allyear-${name}`,
      topic: SEASON_TOPIC,
      q: 'Na który z wymienionych gatunków można polować przez cały rok?',
      answers: [name, ...shuffle(notAllYear, rng).slice(0, 3)],
      correct: 0,
      explanation: `${name} – polowanie dozwolone przez cały rok (§ 1 ust. 1 rozporządzenia).`,
      source: SOURCE,
    });
  }
  out.push({
    id: 'season-elk',
    topic: SEASON_TOPIC,
    q: 'Który gatunek zwierzyny łownej jest objęty całoroczną ochroną (moratorium)?',
    answers: ['Łoś', 'Daniel', 'Muflon', 'Jeleń szlachetny'],
    correct: 0,
    explanation: 'Łosie (byki, klempy i łoszaki) obejmuje się całoroczną ochroną (§ 1 ust. 5 rozporządzenia).',
    source: SOURCE,
  });
  return out;
}
