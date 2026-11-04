# PZŁ question import

Questions come from PZŁ's online "Sprawdź wiedzę" quiz (pzlow.pl), used with PZŁ's permission.

The quiz never shows the correct answers. Its summary only lists the questions answered
wrongly, so `collect.py` learns each answer by elimination over many quiz runs: it answers every
question with an option that hasn't been ruled out yet, then reads the summary. Question and
answer ids are stable on pzlow.pl, so runs can be repeated and combined. Several workers can share
one state file (it's merged under a file lock). Be polite: keep `DELAY` (seconds between requests,
default 0.6) and the number of parallel workers low.

```sh
pip install requests pillow
# typ N = hunter test (100 q: 30 safety + 70 general), S = selekcjoner (50 q)
python3 scripts/pzl/collect.py N .pzl-cache/stateN.json 50
python3 scripts/pzl/collect.py S .pzl-cache/stateS.json 50
# write every question with a confirmed answer into the banks, downloading images
python3 scripts/pzl/export.py .pzl-cache/stateN.json public/exams/mysliwy.json mysliwy N
python3 scripts/pzl/export.py .pzl-cache/stateS.json public/exams/selekcjoner.json selekcjoner S
npm test
```

Notes:

- Hunter questions shown in positions 1–30 are safety ("Bezpieczeństwo"), the rest general.
- Questions with several pictures (e.g. photos A–D) get one composite image with A–D labels.
- A run where the same question text appears twice under two ids is ambiguous, so nothing is
  learned from those two; identical duplicates are dropped on export.
