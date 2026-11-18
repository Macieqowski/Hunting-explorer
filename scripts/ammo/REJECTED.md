# Loads left out

Written by `norm.py`. These loads are on the makers' pages but are not in `src/ammo.json`, because the
page's own numbers contradict each other or are incomplete. 61 loads.

| Maker | Calibre | Load | Bullet | Why |
|---|---|---|---|---|
| Blaser | .308 Win. | [CDB](https://www.blaser.de/en/CDB-Controlled-Deformation-Bonded/CDB-H) | 10.7 g | velocity table and BC 0.385 disagree: 774 m/s printed at 100 m, BC gives 742 m/s |
| Blaser | 6,5x55 SE | [CDC](https://www.blaser.de/en/CDC-Controlled-Deformation-Copper/80416212) | 7.8 g | muzzle energy printed as 2906 J, but 7.8 g at 836 m/s is 2725 J |
| Brenneke | 8x64 S | [TAG](https://www.brenneke-ammunition.de/en/details/091097?cHash=d3d63b77a5005f56b8a6ce9b0bde1d4a) | 11.3 g | muzzle energy printed as 4062 J, but 11.3 g at 864 m/s is 4217 J |
| Brenneke | 8x64 S | [TIG](https://www.brenneke-ammunition.de/en/details/050635?cHash=21b60be023810680275f1dc3468b0639) | 12.8 g | no BC reproduces the velocity table (best fit 0.369 is still 4.7% off) |
| Browning | .223 Rem. | [BXV](https://browningammo.com/Products/Ammunition/Rifle/BXV/B192302231) | 3.24 g | no BC reproduces the velocity table (best fit 0.25 is still 3.1% off) |
| Browning | .243 Win. | [BXV](https://browningammo.com/Products/Ammunition/Rifle/BXV/B192302431) | 4.21 g | muzzle energy printed as 4610 J, but 4.21 g at 1036 m/s is 2259 J |
| Browning | .30-06 Springfield | [Long Range Pro](https://browningammo.com/Products/Ammunition/Rifle/Long-Range-Pro/B192530061) | 12.64 g | no BC reproduces the velocity table (best fit 0.703 is still 4.4% off) |
| Browning | 6,8 Western | [Max Point](https://browningammo.com/Products/Ammunition/Rifle/Max-Point/B192100682) | 11.02 g | no BC reproduces the velocity table (too few rows) |
| Browning | 7mm-08 Rem. | [Max Point](https://browningammo.com/Products/Ammunition/Rifle/Max-Point/B192107082) | 9.07 g | no BC reproduces the velocity table (best fit 0.477 is still 3.9% off) |
| Hornady | .22-250 Rem. | [NTX Superformance](https://www.hornady.com/ammunition/rifle/22-250-rem-35-gr-ntx-superformance) | 2.27 g | velocity table and BC 0.17 disagree: 748 m/s printed at 300 m, BC gives 720 m/s |
| Hornady | .222 Rem. | [NTX Superformance](https://www.hornady.com/ammunition/rifle/222-rem-35-gr-ntx-superformance) | 2.27 g | velocity table and BC 0.17 disagree: 613 m/s printed at 300 m, BC gives 588 m/s |
| Hornady | .223 Rem. | [HP American Gunner](https://www.hornady.com/ammunition/rifle/223-rem-55-gr-hp-american-gunner) | 3.56 g | velocity table and BC 0.254 disagree: 592 m/s printed at 300 m, BC gives 629 m/s |
| Hornady | .223 Rem. | [HP Match Frontier](https://www.hornady.com/ammunition/rifle/223-remington-55-gr-hp-match-frontier) | 3.56 g | velocity table and BC 0.254 disagree: 910 m/s printed at 100 m, BC gives 857 m/s |
| Hornady | .270 Win. | [InterLock SP American Whitetail](https://www.hornady.com/ammunition/rifle/270-win-130-gr-interlock-sp-american-whitetail) | 8.42 g | velocity table and BC 0.409 disagree: 735 m/s printed at 300 m, BC gives 707 m/s |
| Hornady | .30-06 Springfield | [RN Custom International](https://www.hornady.com/ammunition/rifle/30-06-springfield-220-gr-rn-custom-international) | 14.26 g | velocity table and BC 0.22 disagree: 468 m/s printed at 300 m, BC gives 398 m/s |
| Hornady | .300 AAC Blackout | [FMJ Frontier](https://www.hornady.com/ammunition/rifle/300-blackout-208-gr-fmj-frontier) | 13.48 g | the page gives no ballistic coefficient |
| Hornady | .300 AAC Blackout | [NTX Hornady Black](https://www.hornady.com/ammunition/rifle/300-blackout-110-gr-ntx-hornady-black) | 7.13 g | the page gives no ballistic coefficient |
| Hornady | .308 Win. | [SST American Whitetail TIPPED](https://www.hornady.com/ammunition/rifle/308-win-150-gr-sst-american-whitetail-tipped) | 9.72 g | the page gives no ballistic coefficient |
| Hornady | .308 Win. | [SST Superformance](https://www.hornady.com/ammunition/rifle/308-win-180-gr-sst-superformance) | 11.66 g | the page gives no ballistic coefficient |
| Hornady | .338 ARC | [FMJ Frontier](https://www.hornady.com/ammunition/rifle/338-arc-285-gr-fmj-frontier) | 18.47 g | the page gives no ballistic coefficient |
| Hornady | 5,56x45 NATO | [BTHP Match T2 Frontier](https://www.hornady.com/ammunition/rifle/5.56-nato-75-gr-bthp-match-t2-frontier) | 4.86 g | velocity table and BC 0.355 disagree: 665 m/s printed at 300 m, BC gives 638 m/s |
| Hornady | 5,56x45 NATO | [CX Superformance](https://www.hornady.com/ammunition/rifle/5.56-nato-55-gr.-cx-superformance) | 3.56 g | velocity table and BC 0.27 disagree: 608 m/s printed at 300 m, BC gives 632 m/s |
| Hornady | 5,56x45 NATO | [HP Match Frontier](https://www.hornady.com/ammunition/rifle/5.56-nato-55-gr-hp-match-frontier-50box) | 3.56 g | velocity table and BC 0.254 disagree: 910 m/s printed at 100 m, BC gives 857 m/s |
| Hornady | 6 mm ARC | [FMJ Frontier](https://www.hornady.com/ammunition/rifle/6mm-arc-105-gr-fmj-frontier) | 6.8 g | the page gives no ballistic coefficient |
| Hornady | 6,8 mm Rem. SPC | [FMJ Frontier](https://www.hornady.com/ammunition/rifle/6.8mm-rem-spc-110-gr-fmj-frontier) | 7.13 g | the page gives no ballistic coefficient |
| Hornady | 7 mm Rem. Mag. | [InterLock SP American Whitetail](https://www.hornady.com/ammunition/rifle/7mm-rem-mag-139-gr-interlock-sp-american-whitetail) | 9.01 g | velocity table and BC 0.392 disagree: 755 m/s printed at 300 m, BC gives 721 m/s |
| Hornady | 7,62x39 | [FMJ Frontier (50 - Oriented)](https://www.hornady.com/ammunition/rifle/7.62x39-123-gr-fmj-frontier-(50-oriented)) | 7.97 g | muzzle energy printed as 2327 J, but 7.97 g at 716 m/s is 2042 J |
| Hornady | 7,62x39 | [SST Hornady BLACK](https://www.hornady.com/ammunition/rifle/7.62x39-123-gr-sst-black) | 7.97 g | velocity table and BC 0.295 disagree: 439 m/s printed at 300 m, BC gives 461 m/s |
| Hornady | 7mm PRC | [SST American Whitetail TIPPED](https://www.hornady.com/ammunition/rifle/7mm-prc-154-gr-sst-american-whitetail-tipped) | 9.98 g | velocity table and BC 0.525 disagree: 783 m/s printed at 300 m, BC gives 746 m/s |
| Lapua | .243 Win. | [FMJ](https://www.lapua.com/product/243-win-hunting-target-cartridge-fmj-58g-90gr-4316052/) | 5.8 g | the page gives no ballistic coefficient |
| Lapua | .30-06 Springfield | [TRX](https://www.lapua.com/product/30-06-spring-10-7-g-165-grains-n317107trx/) | 10.7 g | velocity table and BC 0.49 disagree: 629 m/s printed at 300 m, BC gives 650 m/s |
| Lapua | .308 Win. | [TRX](https://www.lapua.com/product/308-win-9-7-g-150-gr-trx-hunting-ammo-n317108/) | 9.7 g | velocity table and BC 0.384 disagree: 599 m/s printed at 300 m, BC gives 619 m/s |
| Norma | .243 Win. | [Jaktmatch](https://www.norma-ammunition.com/products/hunting/norma-jaktmatch/norma-jaktmatch-243-winchester-95gr---20160370) | 6.2 g | velocity table and BC 0.351 disagree: 580 m/s printed at 300 m, BC gives 646 m/s |
| Norma | .270 WSM | [Tipstrike](https://www.norma-ammunition.com/products/hunting/norma-tipstrike/norma-tipstrike-270-wsm-140gr---20169532) | 9.1 g | velocity table and BC 0.48 disagree: 719 m/s printed at 300 m, BC gives 753 m/s |
| Norma | .270 Win. | [Tipstrike](https://www.norma-ammunition.com/products/hunting/norma-tipstrike/norma-tipstrike-270-winchester-140gr---20169292) | 9.1 g | velocity table and BC 0.48 disagree: 748 m/s printed at 300 m, BC gives 718 m/s |
| Norma | .280 Rem. | [Tipstrike](https://www.norma-ammunition.com/products/hunting/norma-tipstrike/norma-tipstrike-280-remington-160gr---20171222) | 10.4 g | velocity table and BC 0.51 disagree: 759 m/s printed at 100 m, BC gives 789 m/s |
| Norma | 6,5 Creedmoor | [Tipstrike](https://www.norma-ammunition.com/products/hunting/norma-tipstrike/norma-tipstrike-6-5-creedmoor-140gr---20166512) | 9.1 g | velocity table and BC 428 disagree: 603 m/s printed at 300 m, BC gives 799 m/s |
| Norma | 7x57 | [Whitetail](https://www.norma-ammunition.com/products/hunting/norma-whitetail/norma-whitetail-7x57-150gr---20171592) | 9.7 g | muzzle energy printed as 4528 J, but 9.7 g at 920 m/s is 4105 J |
| Norma | 8,5x55 Blaser | [Oryx](https://www.norma-ammunition.com/products/hunting/norma-oryx/norma-oryx-8-5-x-55-blaser-230-gr---20185362) | 14.9 g | the page gives no ballistic coefficient |
| Norma | 9,3x62 | [Oryx](https://www.norma-ammunition.com/products/hunting/norma-oryx/norma-oryx-9-3-x-62-285gr---20193132) | 18.5 g | velocity table and BC 0.356 disagree: 520 m/s printed at 300 m, BC gives 502 m/s |
| Nosler | .22 Creedmoor | [RDF Match Grade](https://www.nosler.com/22-creedmoor-85gr-rdf-match-grade-ammunition.html) | 5.51 g | muzzle energy printed as 3299 J, but 5.51 g at 968 m/s is 2581 J |
| Nosler | .30-30 Win. | [Ballistic Tip Hunting](https://www.nosler.com/30-30-winchester-150gr-ballistic-tip-hunting-ammunition.html) | 9.72 g | muzzle energy printed as 1992 J, but 9.72 g at 728 m/s is 2575 J |
| Nosler | .300 RUM | [300 RUM 200 AccuBond Trophy Grade](https://www.nosler.com/300-rum-180-accubond-trophy-grade-ammunition-1.html) | 12.96 g | no BC reproduces the velocity table (best fit 0.624 is still 2.9% off) |
| Nosler | .325 WSM | [325 WSM 180gr Expansion Tip](https://www.nosler.com/325-wsm-180gr-expansion-tip-ammunition.html) | 11.66 g | no BC reproduces the velocity table (best fit 0.364 is still 2.3% off) |
| PPU (Prvi Partizan) | .300 Win. Mag. | [Hollow Point Boat Tail (Match)](https://www.prvipartizan.com/search_rb.php?id=A-372) | 12.3 g | muzzle energy printed as 4822 J, but 12.3 g at 865 m/s is 4601 J |
| PPU (Prvi Partizan) | 6,5x52 Carcano | [Full Metal Jacket Boat Tail](https://www.prvipartizan.com/search_rb.php?id=A-208) | 9 g | no BC reproduces the velocity table (best fit 0.432 is still 2.7% off) |
| PPU (Prvi Partizan) | 6,5x52 Carcano | [Full Metal Jacket Boat Tail](https://www.prvipartizan.com/search_rb.php?id=A-605) | 9 g | no BC reproduces the velocity table (best fit 0.432 is still 2.7% off) |
| PPU (Prvi Partizan) | 6,5x52 Carcano | [Soft Point Boat Tail](https://www.prvipartizan.com/search_rb.php?id=A-207) | 9 g | no BC reproduces the velocity table (best fit 0.432 is still 2.7% off) |
| PPU (Prvi Partizan) | 8x50 R Lebel | [Full Metal Jacket Boat Tail](https://www.prvipartizan.com/search_rb.php?id=A-417) | 12.96 g | no BC reproduces the velocity table (best fit 0.39 is still 13.7% off) |
| PPU (Prvi Partizan) | 8x57 JS | [Soft Point](https://www.prvipartizan.com/search_rb.php?id=A-462) | 9 g | muzzle energy printed as 4014 J, but 9 g at 795 m/s is 2844 J |
| PPU (Prvi Partizan) | 8x60 S | [Grom](https://www.prvipartizan.com/search_rb.php?id=A-531) | 12 g | no BC reproduces the velocity table (best fit 0.357 is still 3.4% off) |
| RWS | .223 Rem. | [Target Elite Plus](https://www.rws-ammunition.com/en/products/centerfire-rifle-cartridges/rws-target-elite-plus-223-rem-5-0g) | 5 g | velocity table and BC 0.373 disagree: 596 m/s printed at 300 m, BC gives 564 m/s |
| Sax | .375 Fl. Mag. N.E. | [KJG-SR](https://www.sax-munition.de/.375-Fl.-Mag.-N.E.-KJG-SR-10-0-g/M0060) | 10 g | no BC reproduces the velocity table (best fit 0.225 is still 3.9% off) |
| Sax | .375 Ruger | [KJG-S](https://www.sax-munition.de/.375-Ruger-KJG-S-15-8-g/M0189.1) | 15.8 g | muzzle energy printed as 3961 J, but 15.8 g at 890 m/s is 6257 J |
| Sax | .577 N.E. 3" | [KJG-BCS](https://www.sax-munition.de/.577-N.E.-3-KJG-BCS-37-1-g/M0068) | 37.1 g | no BC reproduces the velocity table (best fit 0.293 is still 4.8% off) |
| Sax | .600 N.E. | [KJG-BCS](https://www.sax-munition.de/.600-N.E.-KJG-BCS-41-2-g/M0069) | 41.2 g | no BC reproduces the velocity table (best fit 0.254 is still 5.1% off) |
| Winchester | .300 AAC Blackout | [USA](https://winchester.com/Products/Ammunition/Rifle/USA/USA300BLK) | 8.1 g | no BC reproduces the velocity table (best fit 0.279 is still 6.6% off) |
| Winchester | .350 Legend | [USA](https://winchester.com/Products/Ammunition/Rifle/USA/USA3501) | 9.4 g | no BC reproduces the velocity table (best fit 0.197 is still 2.4% off) |
| Winchester | 5,56x45 NATO | [USA 250th Anniversary Edition](https://winchester.com/Products/Ammunition/Rifle/USA---250th-Anniversary-Edition/USA193125AV) | 3.56 g | no BC reproduces the velocity table (too few rows) |
| Winchester | 6,5 PRC | [Supreme Long Range](https://winchester.com/Products/Ammunition/Rifle/Supreme-Long-Range/S65PBC) | 9.07 g | no BC reproduces the velocity table (best fit 0.646 is still 5.0% off) |
| Winchester | 7mm-08 Rem. | [Deer Season XP](https://winchester.com/Products/Ammunition/Rifle/Deer-Season-XP/X708DS) | 9.07 g | no BC reproduces the velocity table (best fit 0.477 is still 3.9% off) |
