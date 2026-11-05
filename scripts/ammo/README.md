# Ammunition data for the Balistyka section

`src/ammo.json` is built from the makers' own product pages. Each load keeps its source URL.

Refresh it (Python 3 and curl, about 10 minutes, ~700 page requests):

```sh
export AMMO_CACHE=.ammo-cache && mkdir -p $AMMO_CACHE
python3 scripts/ammo/sb.py       # Sellier & Bellot
python3 scripts/ammo/norma.py    # Norma, by product line (12 per page)
python3 scripts/ammo/norma2.py   # Norma, by calibre, to pick up the rest
python3 scripts/ammo/rws.py      # RWS
python3 scripts/ammo/geco.py     # Geco
python3 scripts/ammo/norm.py src/ammo.json
npm test                         # every load must match its maker's table within 3%
```

`norm.py` keeps hunting loads only (no FMJ, solids or target bullets), merges calibre
spellings, and drops a few loads whose published tables contradict themselves (listed in
`EXCLUDE`). If `npm test` flags a load after a refresh, check its page and add it there.
The `checked` date is set to the day you run `norm.py`.
