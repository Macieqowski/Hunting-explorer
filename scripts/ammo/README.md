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
python3 scripts/ammo/norm.py src/ammo.json scripts/ammo/ISSUES.md
npm test                                # every load must match its maker's table within 3%, or say where it doesn't
```

`norm.py` merges calibre spellings, gives every load a bullet type, and checks every load's
numbers against each other. A load whose published numbers disagree by more than 3% (energy
against weight and velocity, or the velocity table against the BC) still goes in, as printed,
with the disagreeing cells in `x` (`e0`-`e3`, `v1`-`v3`); the calculator shows each one with
both numbers. Those loads, and the few left out because the page gives too little to calculate
with, are listed in [ISSUES.md](ISSUES.md). The `checked` date is set to the day you run `norm.py`.

Drag model: where a maker prints both G1 and G7, its tables follow one of them. `norm.py` picks,
per maker, the one that reproduces more of its tables (G7 for Sellier & Bellot, Lapua and the
Fiocchi catalogues, G1 for Norma) and keeps `g7` only where it is used; a load whose table only
the other BC reproduces uses that one.

Bullet type (`t`), which the calculator lets people choose by: `sp` soft point, `tip` polymer
tip over a lead core, `mono` expanding copper or brass, `hp` hollow point, `match` target
bullets, `fmj` full metal jacket, `solid`, `lead`. It comes from the maker's own bullet name or
description (`btype()` and the per-maker tables in `norm.py`); where a page doesn't say
(most of Winchester Super-X), the load has no `t`. Full metal jacket, target, solid and
subsonic loads are included; handgun, rimfire, shotgun and armour-piercing loads are not.
Load ids must not change once released (people's saved rifles point at them), so ids are
given to hunting loads first and, for the later makers, in page-address order. Loads added
after a maker's first build (those once left out, the Fiocchi catalogues) take ids after all
others (`late` in `norm.py`).

Swift publishes its tables as pictures. They were read by eye into `swift.json`, which is kept
here with each picture's address: there is no script, so re-read the pictures when Swift
changes them. The BC is fitted without a velocity cell Swift itself misprinted; the cell is
kept as printed and shows up as a note.

Fiocchi's European lines (Excellence, Performance, Classic, Perfecta, Exacta, Top Target) come
from the printed catalogues Caccia 02/2025 and Sport 02/2025, copied by hand into
`fiocchi_eu.json` with the page of each row (`s` in `ammo.json`), because fiocchi.com refuses
automated readers. Re-copy them when a new catalogue comes out.

Units: Hornady, Federal, Remington, Fiocchi, Nosler, Swift, Winchester and Browning publish tables in
yards, fps and ft-lb. `norm.py` converts them: bullet weight and muzzle values directly, the
100/200/300 m values by interpolating between the two nearest yard rows.

BC: PPU, Sax, Nosler, Swift, Winchester and Browning print a velocity table but no ballistic
coefficient (Brenneke prints one for most loads). For those `norm.py` works out the G1 BC that
reproduces the maker's table, with the same drag table as `src/ballistics.ts`, and marks the
load `bf: 1`; the app says so next to the BC. Where no BC reproduces the whole table, the
best fit is used and the cells it misses are noted. Hornady pages without a BC are fitted the
same way.

Makers left out, and why: Hornady's "International" pages and Barnes (no velocity on the page),
Berger (several product pages have empty tables), Weatherby
(figures loaded by scripts), Sig Sauer and Fiocchi's European site (they refuse automated
readers; Fiocchi comes from fiocchiusa.com and the European catalogues instead).
