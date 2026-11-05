// Atlas pages: deer, wild boar and mouflon.

import { GROUPS, F, SEJM_SEASONS, wiki, type Species } from './atlasCommon';

export const BIG_GAME: Species[] = [
  // ------------------------------------------------------------------ roe deer
  {
    slug: 'sarna',
    group: GROUPS.deer,
    name: { pl: 'Sarna', en: 'Roe deer' },
    latin: 'Capreolus capreolus',
    terms: {
      pl: 'Samiec: <b>kozioł (rogacz)</b>, samica: <b>koza</b>, młode: <b>koźlę</b>.',
      en: 'Male: <b>kozioł (rogacz)</b>, female: <b>koza</b>, young: <b>koźlę</b> (buck, doe, kid).',
    },
    season: 'Sarna',
    facts: [
      [F.weight, { pl: 'Kozioł 20–30 kg, koza nieco lżejsza', en: 'Buck 20–30 kg, doe a little lighter' }],
      [F.height, { pl: '65–75 cm', en: '65–75 cm' }],
      [
        F.rut,
        {
          pl: 'Druga połowa lipca – połowa sierpnia. Zarodek rozwija się dopiero od grudnia (ciąża przedłużona).',
          en: 'Late July to mid August. The embryo only starts to grow in December (delayed implantation).',
        },
      ],
      [F.birth, { pl: 'Maj – czerwiec, zwykle 1–2 koźlęta w cętki', en: 'May – June, usually 1–2 spotted kids' }],
      [
        F.headgear,
        {
          pl: 'Zrzuca X–XII (starsze wcześniej), odrasta w scypule zimą, wyciera III–V (starsze wcześniej).',
          en: 'Cast Oct–Dec (older bucks first), regrown in velvet over winter, cleaned Mar–May (older bucks first).',
        },
      ],
      [
        F.life,
        {
          pl: 'Latem pojedynczo lub koza z koźlętami, kozły terytorialne; zimą w stadkach (rudlach) na polach.',
          en: 'Alone or doe with kids in summer, bucks hold territories; small groups on fields in winter.',
        },
      ],
    ],
    sex: [
      {
        pl: '<b>Poroże</b> ma tylko kozioł. Od zrzutu (X–XII) do wytarcia (III–V) kozioł ma na głowie tylko guzy albo poroże w scypule – wtedy liczą się inne cechy.',
        en: 'Only the buck has <b>antlers</b>. Between casting (Oct–Dec) and cleaning (Mar–May) he shows only knobs or velvet, so look at the other signs.',
      },
      {
        pl: '<b>Lustro</b> (jasna plama na zadzie) zimą: u kozła ma kształt nerki, u kozy serca z kępką włosów skierowaną w dół (<b>fartuszek</b>).',
        en: 'Winter <b>rump patch</b> (lustro): kidney-shaped in bucks; heart-shaped in does, with a downward tuft of hair (<b>fartuszek</b>).',
      },
      {
        pl: '<b>Pędzel</b> – kępka włosów na brzuchu kozła, dobrze widoczna z boku, zwłaszcza zimą.',
        en: '<b>Pędzel</b> – the tuft of hair under the buck’s belly, clear from the side, especially in winter.',
      },
      {
        pl: 'Kozioł ma krótszą, szerszą głowę i grubszą szyję; koza ma dłuższą, smuklejszą głowę i częściej prowadzi koźlęta.',
        en: 'The buck has a shorter, broader head and thicker neck; the doe’s head is longer and slimmer and she is often with kids.',
      },
    ],
    age: [
      {
        pl: '<b>Koźlę</b> do roku: mała, krótka głowa, w cętkach do ok. 3 miesięcy. Koziołek już jesienią ma pierwsze guziki.',
        en: '<b>Kid</b> up to one year: small, short head, spotted until about 3 months. A young male grows its first buttons in the first autumn.',
      },
      {
        pl: '<b>Kozioł w 2. roku</b>: smukły, szyja cienka, głowa noszona wysoko, wyciera poroże najpóźniej (często maj). Poroże często szpicak lub widłak, ale słabe poroże nie zawsze znaczy młody wiek.',
        en: '<b>Buck in 2nd year</b>: slender, thin neck, head held high, cleans last (often May). Antlers are often spikes or forks, but weak antlers do not always mean a young buck.',
      },
      {
        pl: '<b>Kozioł dojrzały</b>: ciężka sylwetka z mocnym przodem, gruba szyja, głowa noszona nisko. Róże blisko czaszki na krótkich, grubych możdżeniach; wyciera najwcześniej (marzec – kwiecień).',
        en: '<b>Mature buck</b>: heavy, front-weighted body, thick neck, head carried low. Burrs sit close to the skull on short, thick pedicles; cleans first (March – April).',
      },
      {
        pl: '<b>Po strzale – uzębienie</b>: do ok. 13–15 miesięcy trzeci przedtrzonowiec (P3) jest mleczny i trzyczęściowy; potem wyrasta stały, dwuczęściowy. Wiek starszych sztuk ocenia się po starciu zębów trzonowych.',
        en: '<b>After the shot – teeth</b>: until about 13–15 months the third premolar (P3) is a milk tooth with three parts; then the permanent two-part tooth replaces it. Older animals are aged by molar wear.',
      },
    ],
    track: {
      print: { len: 4.5, width: 3, tip: 'pointed', dew: 'soft' },
      text: [
        {
          pl: 'Racica wąska i ostro zakończona, długość 4–5 cm, szerokość ok. 3 cm. Racice boczne odciskają się tylko w miękkim gruncie lub w ucieczce.',
          en: 'Narrow, pointed hoof, 4–5 cm long and about 3 cm wide. Dewclaws only show in soft ground or when fleeing.',
        },
        {
          pl: 'W spokojnym chodzie tylna noga staje w odcisku przedniej; w ucieczce skoki do 2–4 m, racice szeroko rozchylone.',
          en: 'At a walk the hind foot steps into the front print; when fleeing it bounds 2–4 m with the hoof halves spread.',
        },
      ],
    },
    signs: [
      {
        pl: '<b>Wycieranki</b>: młode drzewka i krzewy z obdartą korą na wysokości 30–70 cm, często z zeskrobaną do gołej ziemi plamą obok (znakowanie terytorium, III–VIII).',
        en: '<b>Frayed saplings</b>: young trees with bark rubbed off 30–70 cm above ground, often with a scraped bare patch next to them (territory marking, Mar–Aug).',
      },
      {
        pl: '<b>Czarcie kręgi</b>: wydeptane koła lub ósemki w trawie i zbożu po gonitwach w czasie rui.',
        en: '<b>Rut rings</b> (czarcie kręgi): trampled circles or figures of eight in grass and crops where the buck chases the doe.',
      },
      {
        pl: '<b>Legowiska</b>: owalne, wygrzebane do ziemi zagłębienia ok. 50–70 cm. <b>Bobki</b>: czarne, owalne, ok. 1–1,5 cm, w kupkach.',
        en: '<b>Beds</b>: oval scrapes about 50–70 cm, pawed down to soil. <b>Droppings</b>: black ovals of about 1–1.5 cm, in heaps.',
      },
      {
        pl: '<b>Głos</b>: szczekanie (alarm), a w czasie rui piszczenie kozy, które naśladuje się wabikiem.',
        en: '<b>Calls</b>: barking (alarm); in the rut the doe’s squeak, which hunters imitate with a call.',
      },
    ],
    photos: [
      { file: 'Capreolus capreolus Wien Zentralfriedhof 20221021 05.jpg', caption: { pl: 'Kozioł jesienią', en: 'Roe buck in autumn' } },
      { file: 'Wraxall 2012 MMB 36.jpg', caption: { pl: 'Koza latem', en: 'Roe doe in summer' } },
      { file: 'Sarna nad Wisłą w Chrząstowicach, powiat wadowicki, 20250105 0826 3075.jpg', caption: { pl: 'Sarna zimą – widoczne lustro', en: 'Roe deer in winter – rump patch visible' } },
    ],
    sources: [SEJM_SEASONS, ...wiki('Sarna europejska', 'Roe deer')],
  },

  // ------------------------------------------------------------------ red deer
  {
    slug: 'jelen',
    group: GROUPS.deer,
    name: { pl: 'Jeleń szlachetny', en: 'Red deer' },
    latin: 'Cervus elaphus',
    terms: {
      pl: 'Samiec: <b>byk</b>, samica: <b>łania</b>, młode: <b>cielę</b>. Stado: <b>chmara</b>.',
      en: 'Male: <b>byk</b> (stag), female: <b>łania</b> (hind), young: <b>cielę</b> (calf). Herd: <b>chmara</b>.',
    },
    season: 'Jeleń szlachetny',
    facts: [
      [F.weight, { pl: 'Byk 150–250 kg, łania 80–120 kg', en: 'Stag 150–250 kg, hind 80–120 kg' }],
      [F.height, { pl: '110–150 cm', en: '110–150 cm' }],
      [F.rut, { pl: '<b>Rykowisko</b>: połowa września – połowa października', en: '<b>Rykowisko</b> (roaring): mid September – mid October' }],
      [F.birth, { pl: 'Maj – czerwiec, zwykle jedno cielę w cętki (ciąża ok. 8 miesięcy)', en: 'May – June, usually one spotted calf (about 8 months pregnancy)' }],
      [
        F.headgear,
        {
          pl: 'Zrzuca II–IV (starsze wcześniej), wyciera VII–VIII (starsze wcześniej). Pierwsze poroże w 2. roku: zwykle szpicak.',
          en: 'Cast Feb–Apr (older stags first), cleaned Jul–Aug (older first). First antlers in the 2nd year, usually spikes.',
        },
      ],
      [
        F.life,
        {
          pl: 'Łanie z cielętami i młodzieżą w chmarach; byki poza rykowiskiem osobno, pojedynczo lub w grupach.',
          en: 'Hinds, calves and young in herds; stags live apart outside the rut, alone or in bachelor groups.',
        },
      ],
    ],
    sex: [
      {
        pl: '<b>Poroże</b> ma tylko byk. Od zrzutu (II–IV) do wytarcia (VII–VIII) byka poznasz po masywniejszej sylwetce, grubszej szyi i porożu w scypule.',
        en: 'Only stags carry <b>antlers</b>. Between casting (Feb–Apr) and cleaning (Jul–Aug) a stag shows a heavier body, thicker neck and velvet antlers.',
      },
      {
        pl: 'W czasie rykowiska byk ma ciemną grzywę na szyi i ryczy; łania ma długą, wąską głowę i smukłą szyję.',
        en: 'In the rut the stag grows a dark neck mane and roars; the hind has a long, narrow head and a slim neck.',
      },
      {
        pl: 'Cielę trzyma się blisko matki. Przy odstrzale łani prowadzącej cielę najpierw strzela się cielę.',
        en: 'A calf keeps close to its mother. When culling a hind with a calf, the calf is shot first.',
      },
    ],
    age: [
      {
        pl: '<b>Cielę</b>: krótka głowa, w cętkach do ok. 3 miesięcy; jesienią młode byczki mają na czole małe guzy.',
        en: '<b>Calf</b>: short head, spotted until about 3 months; in autumn young males show small knobs on the forehead.',
      },
      {
        pl: '<b>Byk młody</b>: smukły „łania z porożem”, cienka szyja, wysoko noszona głowa, linia grzbietu prosta. Poroże zwykle bez korony, cienkie tyki.',
        en: '<b>Young stag</b>: slender, “a hind with antlers”, thin neck, head carried high, straight back. Antlers usually without a crown, thin beams.',
      },
      {
        pl: '<b>Byk dojrzały</b>: ciężki przód, gruba szyja przechodząca w pierś bez wcięcia, głowa noszona nisko, zapadnięta linia grzbietu. Poroże masywne, często z koroną; wyciera najwcześniej.',
        en: '<b>Mature stag</b>: heavy front, thick neck running into the chest, head carried low, sagging back. Massive antlers, often crowned; cleans first.',
      },
      {
        pl: 'Byki dzieli się na klasy wieku według zasad selekcji PZŁ obowiązujących w danym okręgu – sprawdź aktualne kryteria przed polowaniem.',
        en: 'Stags are culled by age class under the PZŁ selection rules of your region – check the current criteria before hunting.',
      },
      {
        pl: '<b>Po strzale – uzębienie</b>: stałe uzębienie kompletne w wieku ok. 26–30 miesięcy (do tego czasu P3 trzyczęściowy, mleczny). Starsze sztuki ocenia się po starciu trzonowców. Oba płcie mają <b>grandle</b> (szczątkowe kły w szczęce górnej).',
        en: '<b>After the shot – teeth</b>: permanent teeth are complete at about 26–30 months (until then P3 is a three-part milk tooth). Older animals are aged by molar wear. Both sexes have <b>grandle</b> (upper canine “ivories”).',
      },
    ],
    track: {
      print: { len: 8.5, width: 6.5, tip: 'medium', dew: 'soft' },
      text: [
        {
          pl: 'Byk: 8–10 cm długości, 6–7 cm szerokości, racice zaokrąglone. Łania: 6–8 cm, węższe i bardziej szpiczaste. Racice boczne odbijają się w miękkim gruncie.',
          en: 'Stag: 8–10 cm long, 6–7 cm wide, rounded tips. Hind: 6–8 cm, narrower and more pointed. Dewclaws print in soft ground.',
        },
        {
          pl: 'Odcisk wyraźnie większy od sarny i daniela; mniejszy i węższy niż łosia.',
          en: 'Clearly bigger than roe or fallow deer; smaller and narrower than an elk’s.',
        },
      ],
    },
    signs: [
      {
        pl: '<b>Spałowanie</b>: kora zdarta zębami pionowymi pasami z młodych drzew (świerk, sosna, buk), szczególnie zimą i wiosną.',
        en: '<b>Bark stripping</b> (spałowanie): bark pulled off young trees in vertical strips with the teeth (spruce, pine, beech), mostly in winter and spring.',
      },
      {
        pl: '<b>Kaliska</b>: błotniste zagłębienia, w których jelenie się tarzają, zwłaszcza byki przed i w czasie rykowiska. Obok drzewa obtarte błotem.',
        en: '<b>Wallows</b> (kaliska): muddy hollows where deer roll, especially stags around the rut, with muddy rubbed trees nearby.',
      },
      {
        pl: '<b>Wycieranki</b>: drzewka obdarte porożem na wysokości do ok. 1,5 m, połamane gałęzie (VII–VIII i w rykowisku).',
        en: '<b>Frayed trees</b>: saplings rubbed by antlers up to about 1.5 m with broken branches (Jul–Aug and during the rut).',
      },
      {
        pl: '<b>Bobki</b>: 2–2,5 cm, u byka często z wgłębieniem na jednym końcu i szpicem na drugim, u łani bardziej okrągłe.',
        en: '<b>Droppings</b>: 2–2.5 cm; a stag’s often have a dimple at one end and a point at the other, a hind’s are rounder.',
      },
    ],
    photos: [
      { file: 'Red Deer Cervus Elaphus in Richmond Park 2023 02.jpg', caption: { pl: 'Dojrzały byk', en: 'Mature stag' } },
      { file: 'Red deer (Cervus elaphus) young stag.jpg', caption: { pl: 'Młody byk', en: 'Young stag' } },
      { file: 'Red deer (Cervus elaphus) hind with juvenile.jpg', caption: { pl: 'Łania z cielęciem', en: 'Hind with calf' } },
      { file: 'Hubertus Hert.JPG', caption: { pl: 'Byk z porożem w scypule', en: 'Stag with antlers in velvet' } },
    ],
    sources: [SEJM_SEASONS, ...wiki('Jeleń szlachetny', 'Red deer')],
  },

  // ------------------------------------------------------------------ fallow deer
  {
    slug: 'daniel',
    group: GROUPS.deer,
    name: { pl: 'Daniel', en: 'Fallow deer' },
    latin: 'Dama dama',
    terms: {
      pl: 'Samiec: <b>byk</b>, samica: <b>łania</b>, młode: <b>cielę</b>. Byk z łopatami: <b>łopatacz</b>.',
      en: 'Male: <b>byk</b> (buck), female: <b>łania</b> (doe), young: <b>cielę</b> (fawn). A buck with palmate antlers: <b>łopatacz</b>.',
    },
    season: 'Daniel',
    facts: [
      [F.weight, { pl: 'Byk 60–100 kg, łania 35–55 kg', en: 'Buck 60–100 kg, doe 35–55 kg' }],
      [F.height, { pl: '85–100 cm', en: '85–100 cm' }],
      [F.rut, { pl: '<b>Bekowisko</b>: druga połowa października – początek listopada', en: '<b>Bekowisko</b> (groaning): late October – early November' }],
      [F.birth, { pl: 'Czerwiec, zwykle jedno cielę', en: 'June, usually one fawn' }],
      [
        F.headgear,
        {
          pl: 'Zrzuca IV–V, wyciera VIII – początek IX. Kolejno: szpicak, łyżkarz (łopaty ledwie zaznaczone), łopatacz.',
          en: 'Cast Apr–May, cleaned Aug – early Sept. In turn: spiker, łyżkarz (palms barely started), łopatacz (full palms).',
        },
      ],
      [F.life, { pl: 'Stadny, chętnie na skrajach lasu i w zadrzewieniach śródpolnych', en: 'Lives in herds, likes forest edges and woodlots among fields' }],
    ],
    sex: [
      {
        pl: '<b>Poroże</b> (łopaty u starszych) ma tylko byk; od zrzutu (IV–V) do sierpnia byk ma poroże w scypule.',
        en: 'Only bucks have <b>antlers</b> (palmate in older ones); from casting (Apr–May) until August they are in velvet.',
      },
      {
        pl: 'Byk ma mocniejszą szyję z wyraźną krtanią i <b>pędzel</b> pod brzuchem; łania jest drobniejsza, z dłuższą, wąską głową.',
        en: 'The buck has a thicker neck with a prominent larynx and a <b>pędzel</b> tuft under the belly; the doe is smaller with a long, narrow head.',
      },
      {
        pl: 'Ubarwienie nie pomaga w ustaleniu płci: obie płcie latem są w białe cętki, a występują też odmiany białe i ciemne.',
        en: 'Coat colour does not help with sex: both are white-spotted in summer, and there are white and dark colour forms.',
      },
    ],
    age: [
      {
        pl: '<b>Byk w 2. roku</b>: szpicak, smukły, cienka szyja.',
        en: '<b>Buck in 2nd year</b>: spiker, slender, thin neck.',
      },
      {
        pl: '<b>Byk w 3.–4. roku</b>: łyżkarz – łopaty wąskie, poroże lekkie, sylwetka wciąż smukła.',
        en: '<b>Buck in 3rd–4th year</b>: łyżkarz – narrow palms, light antlers, still slim.',
      },
      {
        pl: '<b>Byk dojrzały</b>: szerokie łopaty, mocny przód ciała, gruba szyja, w bekowisku wyraźna krtań i ciemne, nabrzmiałe podbrzusze.',
        en: '<b>Mature buck</b>: broad palms, heavy front, thick neck; in the rut a prominent larynx and dark, swollen belly.',
      },
      {
        pl: '<b>Po strzale – uzębienie</b>: stałe uzębienie kompletne w wieku ok. 2 lat; starsze sztuki po starciu trzonowców.',
        en: '<b>After the shot – teeth</b>: permanent teeth complete at about 2 years; older animals aged by molar wear.',
      },
    ],
    track: {
      print: { len: 6, width: 4, tip: 'pointed', dew: 'soft' },
      text: [
        {
          pl: 'Racica 5–7 cm długości, 3,5–4,5 cm szerokości, szpiczasta – większa od sarny, mniejsza od jelenia.',
          en: 'Hoof 5–7 cm long and 3.5–4.5 cm wide, pointed – bigger than roe, smaller than red deer.',
        },
      ],
    },
    signs: [
      {
        pl: '<b>Doły rujowe</b>: wygrzebane przez byki płytkie doły, oznakowane moczem, na stałych miejscach bekowiska.',
        en: '<b>Rut scrapes</b>: shallow pits pawed by bucks and marked with urine at traditional rutting stands.',
      },
      {
        pl: '<b>Wycieranki</b> i połamane krzewy (VIII–IX). <b>Bobki</b> ok. 1,5 cm, podobne do jelenich, ale mniejsze.',
        en: '<b>Frayed saplings</b> and broken shrubs (Aug–Sept). <b>Droppings</b> about 1.5 cm, like red deer but smaller.',
      },
      {
        pl: '<b>Głos</b>: w bekowisku byk wydaje chrapliwe, rytmiczne beknięcia.',
        en: '<b>Calls</b>: in the rut the buck gives hoarse, rhythmic groans.',
      },
    ],
    photos: [
      { file: 'Daim DSCF6119.jpg', caption: { pl: 'Byk – łopatacz', en: 'Mature buck with palmate antlers' } },
      { file: 'Daim européen juvénile (Dama dama) (2).jpg', caption: { pl: 'Młody byk', en: 'Young buck' } },
      { file: 'Dama dama (femia). Naturlandia. Sant Julià de Lòira. Andorra 240.jpg', caption: { pl: 'Łania w letniej sukni w cętki', en: 'Doe in spotted summer coat' } },
    ],
    sources: [SEJM_SEASONS, ...wiki('Daniel (ssak)', 'European fallow deer')],
  },

  // ------------------------------------------------------------------ elk
  {
    slug: 'los',
    group: GROUPS.deer,
    name: { pl: 'Łoś', en: 'Elk (moose)' },
    latin: 'Alces alces',
    terms: {
      pl: 'Samiec: <b>byk</b>, samica: <b>klępa</b>, młode: <b>łoszak</b> (do roku: <b>cielę</b>).',
      en: 'Male: <b>byk</b> (bull), female: <b>klępa</b> (cow), young: <b>łoszak</b> (calf up to one year: <b>cielę</b>).',
    },
    season: 'Łoś',
    facts: [
      [F.weight, { pl: 'Byk 350–500 kg, klępa 250–400 kg', en: 'Bull 350–500 kg, cow 250–400 kg' }],
      [F.height, { pl: '170–210 cm', en: '170–210 cm' }],
      [F.rut, { pl: '<b>Bukowisko</b>: wrzesień – październik', en: '<b>Bukowisko</b>: September – October' }],
      [F.birth, { pl: 'Maj – czerwiec, 1–2 jednolicie rude cielęta (bez cętek)', en: 'May – June, 1–2 plain reddish calves (no spots)' }],
      [
        F.headgear,
        {
          pl: 'Łopatacz (poroże z łopatami) albo badylarz (poroże w tyki bez łopat). Zrzuca XI–II, wyciera VIII.',
          en: 'Łopatacz (palmate antlers) or badylarz (pole-type, no palms). Cast Nov–Feb, cleaned in August.',
        },
      ],
      [F.life, { pl: 'Pojedynczo lub klępa z młodymi; bagna, olsy, młodniki sosnowe', en: 'Alone or cow with young; marshes, alder swamps, young pine stands' }],
    ],
    sex: [
      {
        pl: '<b>Uwaga:</b> łoś jest pod całoroczną ochroną – polowanie jest zabronione. Rozpoznawanie przydaje się przy obserwacji i liczeniu zwierzyny.',
        en: '<b>Note:</b> elk are protected all year – no hunting. Telling them apart is still useful for observing and counting game.',
      },
      {
        pl: 'Poroże ma tylko byk (VIII–XII). Byk ma większą <b>brodę</b> (fałd skóry pod gardłem) i masywniejszą głowę.',
        en: 'Only the bull has antlers (Aug–Dec). He has a bigger <b>bell</b> (dewlap under the throat) and a heavier head.',
      },
      {
        pl: 'Klępę zimą poznasz z tyłu po jasnej plamie pod ogonem; zwykle prowadzi łoszaki.',
        en: 'From behind, a cow shows a light patch below the tail in winter; she usually has calves with her.',
      },
    ],
    age: [
      {
        pl: '<b>Łoszak</b>: krótka głowa i krótki pysk, w pierwszym roku przy klępie.',
        en: '<b>Calf</b>: short head and muzzle, with its mother in the first year.',
      },
      {
        pl: '<b>Byk młody</b>: smukły, długie nogi, poroże małe – szpice, widły lub małe łopaty.',
        en: '<b>Young bull</b>: slim, long-legged, small antlers – spikes, forks or small palms.',
      },
      {
        pl: '<b>Byk dojrzały</b>: masywny kark i przód, wysoki garb nad łopatkami, duże poroże; zrzuca je wcześniej niż młode byki.',
        en: '<b>Mature bull</b>: massive neck and front, high hump over the shoulders, big antlers; casts them earlier than young bulls.',
      },
      {
        pl: '<b>Uzębienie</b>: stałe zęby kompletne w wieku ok. 16–18 miesięcy.',
        en: '<b>Teeth</b>: permanent teeth complete at about 16–18 months.',
      },
    ],
    track: {
      print: { len: 14, width: 11, tip: 'blunt', dew: 'soft', gap: 0.6 },
      text: [
        {
          pl: 'Największy trop racicowy w Polsce: 13–16 cm długości i 10–12 cm szerokości. Na miękkim gruncie racice rozchylają się, a racice boczne zostawiają głębokie ślady.',
          en: 'The biggest hoof print in Poland: 13–16 cm long and 10–12 cm wide. On soft ground the halves splay and the dewclaws leave deep marks.',
        },
      ],
    },
    signs: [
      {
        pl: '<b>Zgryzanie</b> pędów sosny, wierzby i osiki na wysokości do 2,5–3 m; łoś nagina i łamie młode drzewka, aby dostać się do wierzchołka.',
        en: '<b>Browsing</b> pine, willow and aspen shoots up to 2.5–3 m high; elk bend and break saplings to reach the tops.',
      },
      {
        pl: '<b>Spałowanie</b> kory osiki i sosny. <b>Odchody</b>: zimą duże, suche, podłużne bobki 2,5–3,5 cm; latem miękkie placki.',
        en: '<b>Bark stripping</b> on aspen and pine. <b>Droppings</b>: big dry oblong pellets 2.5–3.5 cm in winter, soft cakes in summer.',
      },
    ],
    photos: [
      { file: 'Élan européen (Alces alces alces) (Rhodes).jpg', caption: { pl: 'Byk z porożem', en: 'Bull with antlers' } },
      { file: 'Elk (Alces alces alces) female Oppdal.jpg', caption: { pl: 'Klępa', en: 'Cow elk' } },
      { file: 'Elk (Alces alces) calf Biebrzanski.jpg', caption: { pl: 'Łoszak, Biebrzański PN', en: 'Young elk, Biebrza National Park' } },
    ],
    sources: [SEJM_SEASONS, ...wiki('Łoś euroazjatycki', 'Moose')],
  },

  // ------------------------------------------------------------------ wild boar
  {
    slug: 'dzik',
    group: GROUPS.other,
    name: { pl: 'Dzik', en: 'Wild boar' },
    latin: 'Sus scrofa',
    terms: {
      pl: 'Samiec: <b>odyniec</b>, samica: <b>locha</b>, młode do roku: <b>warchlak</b> (w pasy: <b>pasiak</b>), w 2. roku: <b>przelatek</b>. Stado: <b>wataha</b>.',
      en: 'Male: <b>odyniec</b>, female: <b>locha</b>, young up to one year: <b>warchlak</b> (striped: <b>pasiak</b>), in 2nd year: <b>przelatek</b>. Group: <b>wataha</b>.',
    },
    season: 'Dzik',
    facts: [
      [F.weight, { pl: 'Odyniec 100–150 kg (wyjątkowo więcej), locha 60–100 kg', en: 'Boar 100–150 kg (rarely more), sow 60–100 kg' }],
      [F.height, { pl: '80–100 cm', en: '80–100 cm' }],
      [F.rut, { pl: '<b>Huczka</b>: głównie listopad – styczeń', en: '<b>Huczka</b>: mostly November – January' }],
      [
        F.birth,
        {
          pl: 'Głównie marzec – maj, ale warchlaki rodzą się przez cały rok; ciąża ok. 115 dni, 4–8 młodych',
          en: 'Mainly March – May, but piglets are born all year; pregnancy about 115 days, 4–8 young',
        },
      ],
      [
        F.tusks,
        {
          pl: 'U odyńca dolne kły to <b>szable</b>, górne <b>fajki</b>; u lochy krótkie <b>haki</b>.',
          en: 'In boars the lower tusks are <b>szable</b> and the upper <b>fajki</b>; sows have short <b>haki</b>.',
        },
      ],
      [F.life, { pl: 'Lochy z młodymi w watahach; dojrzałe odyńce zwykle pojedynczo', en: 'Sows and young in groups; mature boars mostly alone' }],
    ],
    sex: [
      {
        pl: '<b>Pędzel</b>: kępka szczeciny pod brzuchem odyńca, widoczna z boku jako „pędzelek” w połowie brzucha.',
        en: '<b>Pędzel</b>: the tuft of bristles under the boar’s belly, seen from the side halfway along.',
      },
      {
        pl: 'Odyniec ma klinowatą sylwetkę z ciężkim przodem i dużą głową, często chodzi sam. Locha ma bardziej prostokątną sylwetkę, dłuższy grzbiet i zwykle prowadzi warchlaki.',
        en: 'A boar is wedge-shaped with a heavy front and big head, often alone. A sow is more rectangular with a longer back and usually leads piglets.',
      },
      {
        pl: '<b>Lochy prowadzącej</b> (z warchlakami zależnymi od niej) nie wolno strzelać. Przy watasze strzela się najpierw warchlaki i przelatki, zaczynając od najsłabszych.',
        en: 'Never shoot a <b>leading sow</b> (with piglets that depend on her). In a group, shoot piglets and yearlings first, the weakest first.',
      },
    ],
    age: [
      {
        pl: '<b>Warchlak</b>: w pasy do ok. 4 miesięcy, potem rudobrązowy; jesienią i zimą 20–50 kg. Głowa krótka w stosunku do tułowia.',
        en: '<b>Piglet</b>: striped until about 4 months, then reddish-brown; 20–50 kg in autumn and winter. Head short for the body.',
      },
      {
        pl: '<b>Przelatek</b> (2. rok): smukły, wysoki na nogach, długi tułów; ok. 40–70 kg.',
        en: '<b>Yearling</b> (2nd year): slim, long-legged, long body; about 40–70 kg.',
      },
      {
        pl: '<b>Odyniec dojrzały</b>: masywny przód, wysoki kark, głowa duża i nisko noszona, szable widoczne z boku pyska.',
        en: '<b>Mature boar</b>: massive front, high neck, big head carried low, tusks visible from the side of the snout.',
      },
      {
        pl: 'Na stanowisku porównuj sztuki ze sobą: wielkość głowy do tułowia i wysokość nóg lepiej mówią o wieku niż sama masa, szczególnie nocą przez lunetę.',
        en: 'On the stand compare animals with each other: head size against body and leg length tell age better than weight alone, especially at night.',
      },
      {
        pl: '<b>Po strzale</b>: stałe uzębienie kompletne w wieku ok. 21–24 miesięcy; u odyńców wiek ocenia się także po długości i starciu szabli.',
        en: '<b>After the shot</b>: permanent teeth complete at about 21–24 months; in boars age is also judged by tusk length and wear.',
      },
    ],
    track: {
      print: { len: 6, width: 5, tip: 'blunt', dew: 'always', dewWide: true },
      text: [
        {
          pl: 'Racice 5–7 cm (u starych odyńców do 9 cm), zaokrąglone, z odstępem między połówkami. <b>Racice boczne odbijają się prawie zawsze</b>, szeroko po bokach – to główna różnica wobec jeleniowatych.',
          en: 'Hooves 5–7 cm (old boars up to 9 cm), rounded, with a gap between the halves. <b>The dewclaws almost always print</b>, set wide to the sides – the main difference from deer.',
        },
        {
          pl: 'Ślady stawiane są w linii zygzakowatej, krok krótki.',
          en: 'Prints are placed in a zigzag line with a short stride.',
        },
      ],
    },
    signs: [
      {
        pl: '<b>Buchtowanie</b>: zryta ziemia na łąkach, polach i w lesie w poszukiwaniu pędraków, korzeni i żołędzi.',
        en: '<b>Rooting</b> (buchtowanie): turned-over soil in meadows, fields and forest where boar look for grubs, roots and acorns.',
      },
      {
        pl: '<b>Kaliska</b> (błotne kąpieliska) i obok drzewa obtarte błotem, z wbitą szczeciną; często na tej samej wysokości.',
        en: '<b>Wallows</b> (kaliska) with nearby trees rubbed with mud and bristles stuck in it, often at the same height.',
      },
      {
        pl: '<b>Barłogi</b> (legowiska) wyścielone gałązkami i trawą; locha przed porodem buduje <b>gajno</b>.',
        en: '<b>Beds</b> (barłogi) lined with twigs and grass; before farrowing a sow builds a nest (<b>gajno</b>).',
      },
      {
        pl: '<b>Odchody</b>: ciemne, zbite grudy lub kiełbaski, zależnie od pokarmu.',
        en: '<b>Droppings</b>: dark lumps or sausages, depending on food.',
      },
    ],
    photos: [
      { file: 'Dzik na ulicy Basistówka w Krakowie, 20250228 1420 3362.jpg', caption: { pl: 'Dorosły dzik', en: 'Adult wild boar' } },
      { file: 'Dziki na ulicy Basistówka w Krakowie, 20250209 0950 3199.jpg', caption: { pl: 'Locha z warchlakiem', en: 'Sow with a piglet' } },
      { file: 'Młody dzik na ulicy Basistówka w Krakowie, 20250209 0954 3224.jpg', caption: { pl: 'Warchlak w pasy (pasiak)', en: 'Striped piglet' } },
    ],
    sources: [SEJM_SEASONS, ...wiki('Dzik euroazjatycki', 'Wild boar')],
  },

  // ------------------------------------------------------------------ mouflon
  {
    slug: 'muflon',
    group: GROUPS.other,
    name: { pl: 'Muflon', en: 'Mouflon' },
    latin: 'Ovis gmelini musimon',
    terms: {
      pl: 'Samiec: <b>tryk</b>, samica: <b>owca</b>, młode: <b>jagnię</b>. Rogi tryka: <b>ślimy</b>.',
      en: 'Male: <b>tryk</b> (ram), female: <b>owca</b> (ewe), young: <b>jagnię</b> (lamb). The ram’s horns: <b>ślimy</b>.',
    },
    season: 'Muflon',
    facts: [
      [F.weight, { pl: 'Tryk 35–50 kg, owca 25–35 kg', en: 'Ram 35–50 kg, ewe 25–35 kg' }],
      [F.height, { pl: '65–80 cm', en: '65–80 cm' }],
      [F.rut, { pl: 'Październik – grudzień', en: 'October – December' }],
      [F.birth, { pl: 'Kwiecień – maj, zwykle 1 jagnię (ciąża ok. 5 miesięcy)', en: 'April – May, usually one lamb (about 5 months pregnancy)' }],
      [
        F.horns,
        {
          pl: 'Rogi rosną przez całe życie i nie są zrzucane. Co rok przybywa pierścień przyrostu.',
          en: 'Horns grow for life and are never shed. A growth ring is added every year.',
        },
      ],
      [F.life, { pl: 'Stadny; w Polsce głównie w górach i na pogórzu (Sudety), w kilku ośrodkach na nizinach', en: 'Lives in herds; in Poland mainly in the Sudetes and foothills, a few lowland sites' }],
    ],
    sex: [
      {
        pl: 'Tryk ma duże, zakręcone <b>ślimy</b>; owca zwykle nie ma rogów albo ma krótkie różki.',
        en: 'The ram has big curled horns (<b>ślimy</b>); the ewe is usually hornless or has short horns.',
      },
      {
        pl: 'Zimą dorosły tryk ma na boku jasną plamę (<b>siodło</b>) i ciemną grzywę na szyi.',
        en: 'In winter an adult ram shows a light saddle patch (<b>siodło</b>) on its flank and a dark neck ruff.',
      },
    ],
    age: [
      {
        pl: '<b>Wiek tryka liczy się po pierścieniach przyrostu rocznego na ślimach</b> – każdy wyraźny pierścień zimowy to jeden rok.',
        en: '<b>A ram’s age is counted by the annual growth rings on the horns</b> – each clear winter ring is one year.',
      },
      {
        pl: 'Młody tryk ma ślimy tworzące mniej niż pół zwoju; u dojrzałego zbliżają się do pełnego zwoju, a końce rozchodzą na boki.',
        en: 'A young ram’s horns make less than half a curl; a mature ram’s near a full curl with the tips turning out.',
      },
      {
        pl: '<b>Uzębienie</b>: siekacze stałe wyrastają parami mniej więcej co rok; komplet ok. 3,5–4 lat.',
        en: '<b>Teeth</b>: permanent incisors come in pairs about once a year; complete at about 3.5–4 years.',
      },
    ],
    track: {
      print: { len: 5.5, width: 3.8, tip: 'pointed', dew: 'soft' },
      text: [
        {
          pl: 'Racica 5–6 cm, szpiczasta, o prostych, równoległych brzegach wewnętrznych; ostre krawędzie dobrze trzymają się skał.',
          en: 'Hoof 5–6 cm, pointed, with straight, parallel inner edges; the sharp rims grip rock well.',
        },
        {
          pl: 'Łatwo pomylić z sarną lub danielem – patrz na teren (skały, stoki) i ślady stada.',
          en: 'Easy to mix up with roe or fallow deer – look at the terrain (rocks, slopes) and signs of a herd.',
        },
      ],
    },
    signs: [
      {
        pl: '<b>Zgryzanie i spałowanie</b> drzew; wydeptane ścieżki na stokach. <b>Bobki</b> ok. 1–1,5 cm, często sklejone, podobne do owczych.',
        en: '<b>Browsing and bark stripping</b>; trodden paths on slopes. <b>Droppings</b> about 1–1.5 cm, often stuck together, like a sheep’s.',
      },
    ],
    photos: [
      { file: '139 Zoo de Barcelona, mufló de Còrsega (Ovis aries musimon) (cropped).jpg', caption: { pl: 'Tryk z siodłem', en: 'Ram with saddle patch' } },
      { file: 'European mouflon (Ovis orientalis musimon) (5).jpg', caption: { pl: 'Owce z trykiem', en: 'Ewes with a ram' } },
      { file: 'Mouflon In Winter (221325021).jpeg', caption: { pl: 'Ślimy – widoczne pierścienie przyrostu', en: 'Horns with annual growth rings' } },
    ],
    sources: [SEJM_SEASONS, ...wiki('Muflon śródziemnomorski', 'Mouflon')],
  },
];

