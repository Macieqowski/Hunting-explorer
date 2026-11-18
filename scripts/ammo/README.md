# Ammunition data for the Balistyka section

`src/ammo.json` is built from the makers' own product pages. Each load keeps its source URL.

Refresh it (Python 3, curl and, for Winchester and Browning, Node with Playwright; about
25 minutes, ~3000 page requests):

```sh
export AMMO_CACHE=.ammo-cache && mkdir -p $AMMO_CACHE
python3 scripts/ammo/sb.py              # Sellier & Bellot
python3 scripts/ammo/norma.py           # Norma, by product line (12 per page)
python3 scripts/ammo/norma2.py          # Norma, by calibre, to pick up the rest
python3 scripts/ammo/rws.py             # RWS
python3 scripts/ammo/geco.py            # Geco
python3 scripts/ammo/sako.py            # Sako (muzzle velocity and BC only, no downrange table)
python3 scripts/ammo/lapua.py           # Lapua
python3 scripts/ammo/hornady.py         # Hornady (US pages: yards, fps, ft-lb)
python3 scripts/ammo/shop.py federal    # Federal, Remington and Fiocchi's US site share one
python3 scripts/ammo/shop.py remington  #   shop software (yards, fps, ft-lb)
python3 scripts/ammo/shop.py fiocchi
python3 scripts/ammo/blaser.py          # Blaser CDC / CDB / CDX
python3 scripts/ammo/brenneke.py        # Brenneke
python3 scripts/ammo/ppu.py             # Prvi Partizan
python3 scripts/ammo/sax.py             # Sax
python3 scripts/ammo/nosler.py          # Nosler
node scripts/ammo/winchester.cjs            # Winchester (pages rendered in a browser)
node scripts/ammo/winchester.cjs browning   # Browning
python3 scripts/ammo/norm.py src/ammo.json
npm test                                # every load must match its maker's table within 3%
```

`norm.py` keeps hunting loads only (no FMJ, solids or target bullets), merges calibre
spellings, and drops loads whose published tables contradict themselves. For the first makers
those are listed by hand in `EXCLUDE` (and single misprinted cells in `MISPRINT`); the makers
read in bulk later are checked by `norm.py` itself, which prints each load it leaves out. If
`npm test` flags a load after a refresh, check its page and add it to `EXCLUDE`.
The `checked` date is set to the day you run `norm.py`.

Units: Hornady, Federal, Remington, Fiocchi, Nosler, Winchester and Browning publish tables in
yards, fps and ft-lb. `norm.py` converts them: bullet weight and muzzle values directly, the
100/200/300 m values by interpolating between the two nearest yard rows.

BC: PPU, Sax, Nosler, Winchester and Browning print a velocity table but no ballistic
coefficient (Brenneke prints one for most loads). For those `norm.py` works out the G1 BC that
reproduces the maker's table, with the same drag table as `src/ballistics.ts`, and marks the
load `bf: 1`; the app says so next to the BC. A load whose table no BC reproduces within 2%
is left out.

Left out, and why: Hornady's "International" pages and Barnes (no velocity on the page),
Swift (tables are pictures), Berger (several product pages have empty tables), Weatherby
(figures loaded by scripts), Sig Sauer and Fiocchi's European site (they refuse automated
readers; Fiocchi comes from fiocchiusa.com instead).
