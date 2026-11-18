# Ammunition data for the Balistyka section

`src/ammo.json` is built from the makers' own product pages. Each load keeps its source URL.

Refresh it (Python 3 and curl, about 15 minutes, ~1500 page requests):

```sh
export AMMO_CACHE=.ammo-cache && mkdir -p $AMMO_CACHE
python3 scripts/ammo/sb.py       # Sellier & Bellot
python3 scripts/ammo/norma.py    # Norma, by product line (12 per page)
python3 scripts/ammo/norma2.py   # Norma, by calibre, to pick up the rest
python3 scripts/ammo/rws.py      # RWS
python3 scripts/ammo/geco.py     # Geco
python3 scripts/ammo/sako.py     # Sako (muzzle velocity and BC only, no downrange table)
python3 scripts/ammo/lapua.py    # Lapua
python3 scripts/ammo/hornady.py  # Hornady (US pages: yards, fps, ft-lb)
python3 scripts/ammo/federal.py  # Federal (yards, fps, ft-lb)
python3 scripts/ammo/norm.py src/ammo.json
npm test                         # every load must match its maker's table within 3%
```

`norm.py` keeps hunting loads only (no FMJ, solids or target bullets), merges calibre
spellings, and drops a few loads whose published tables contradict themselves (listed in
`EXCLUDE`). If `npm test` flags a load after a refresh, check its page and add it there.
The `checked` date is set to the day you run `norm.py`.

Hornady and Federal publish tables in yards, fps and ft-lb. `norm.py` converts them: bullet
weight and muzzle values directly, the 100/200/300 m values by interpolating between the two
nearest yard rows. Hornady's "International" pages carry no table and are left out; the same
goes for Winchester, whose pages load their figures with scripts. A page with one misprinted
cell keeps its load and loses the cell (`MISPRINT`).
