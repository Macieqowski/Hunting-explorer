import { speciesIn, MATCHED_SLUGS } from './atlasMatch';
import { SPECIES } from './atlas';

describe('speciesIn', () => {
  it.each([
    ['Dziki w drugim roku życia nazywamy:', ['dzik']],
    ['Strzał w miot kulą do dzika , poza polowaniem zbiorowym', ['dzik']],
    ['Dziki królik żyje:', ['krolik']],
    ['Do polowania na dzikie kaczki czy bażanty', ['bazant']],
    ['Liczba miotów u lisa w ciągu roku wynosi:', ['lis']],
    ['W listopadzie odbywa się polowanie', []],
    ['Stałe uzębienie sarny składa się:', ['sarna']],
    ['Koza prowadzi koźlęta:', ['sarna']],
    ['Nogi łosia w języku łowieckim nazywane są:', ['los']],
    ['Łosoś to ryba', []],
    ['Młode jelenie szlachetne dojrzewają:', ['jelen']],
    ['Zwierzyna jeleniowata to:', []],
    ['Kuna domowa wydaje na świat w ciągu roku:', ['kuna-domowa']],
    ['Kuny polują nocą', ['kuna-lesna', 'kuna-domowa']],
    ['Odstrzał gęsi zbożowej', ['ges-zbozowa']],
    ['Uprawy zbożowe', []],
    ['Ryś euroazjatycki w Polsce jest:', ['rys']],
    ['Na rysunku przedstawiono trop', []],
    ['Wilk jest gatunkiem chronionym', ['wilk']],
    ['Gęś mała od gęsi białoczelnej różni się:', ['ges-bialoczelna', 'ges-mala']],
    ['Kszyk i słonka', ['slonka', 'kszyk']],
    ['Podgorzałka to:', ['podgorzalka']],
    ['Ogorzałka to:', ['ogorzalka']],
  ])('%s', (text, slugs) => {
    expect(speciesIn(text)).toEqual(slugs);
  });

  it('only names species that have atlas pages', () => {
    const slugs = new Set(SPECIES.map((s) => s.slug));
    for (const s of MATCHED_SLUGS) expect(slugs.has(s), s).toBe(true);
  });
});
