// Atlas pages: predators, small game and game birds. Shorter than the big game pages.
// Written for this app in our own words from the sources listed for each species.

import { GROUPS, F, SEJM_SEASONS, wiki, type Species, type Tx } from './atlasCommon';

const t = (pl: string, en: string): Tx => ({ pl, en });

export const SMALL_GAME: Species[] = [
  // ================================================================== predators
  {
    slug: 'lis',
    group: GROUPS.pred,
    name: t('Lis', 'Red fox'),
    latin: 'Vulpes vulpes',
    terms: t(
      'Samica: <b>lisica</b> (liszka), młode: <b>lisięta</b>. Ogon: <b>kita</b>, schronienie: <b>nora</b>.',
      'Female: <b>lisica</b> (liszka), young: <b>lisięta</b>. Tail: <b>kita</b>, den: <b>nora</b>.',
    ),
    season: 'Lis',
    facts: [
      [F.weight, t('5–8 kg', '5–8 kg')],
      [F.length, t('60–80 cm, ogon 35–45 cm z białym końcem', '60–80 cm, tail 35–45 cm with a white tip')],
      [F.rut, t('<b>Cieczka</b>: styczeń – luty', '<b>Cieczka</b> (mating): January – February')],
      [F.birth, t('Marzec – kwiecień w norze, zwykle 4–6 lisiąt', 'March – April in the den, usually 4–6 cubs')],
      [F.food, t('Gryzonie (głównie norniki), ptaki, zające, padlina, owoce', 'Rodents (mostly voles), birds, hares, carrion, fruit')],
    ],
    sex: [
      t(
        'W terenie trudno odróżnić płeć. Lis ma zwykle szerszą, masywniejszą głowę; lisica jest drobniejsza, a wiosną widać u niej sutki.',
        'Hard to tell in the field. The male usually has a broader, heavier head; the vixen is slighter and shows teats in spring.',
      ),
    ],
    age: [
      t(
        'Młode z bieżącego roku jesienią są smuklejsze, mają białe, ostre zęby; u starszych lisów zęby są starte i żółtawe.',
        'Cubs of the year are slimmer in autumn with white, sharp teeth; older foxes have worn, yellowish teeth.',
      ),
    ],
    track: {
      print: { kind: 'paw', len: 5.5, width: 4.2, style: 'canid' },
      text: [
        t(
          'Trop owalny, ok. 5–6 cm długości i 4–4,5 cm szerokości, z widocznymi pazurami. Między poduszkami palców a poduszką śródstopia zostaje wolne miejsce, przez które można poprowadzić „krzyżyk”.',
          'Oval print about 5–6 cm long and 4–4.5 cm wide, claws visible. There is open space between the toe pads and the main pad, so you can draw an “X” through it.',
        ),
        t(
          'W kłusie lis stawia łapy w jednej prostej linii („sznuruje”), w odróżnieniu od psa.',
          'At a trot the fox places its feet in one straight line, unlike a dog.',
        ),
      ],
    },
    signs: [
      t(
        '<b>Nora</b> z kilkoma wejściami ok. 20–30 cm, wiosną z resztkami ofiar i silnym zapachem przed wejściem.',
        '<b>Den</b> with several entrances of about 20–30 cm; in spring with prey remains and a strong smell at the entrance.',
      ),
      t(
        '<b>Odchody</b> skręcone, ze sierścią i kośćmi, zostawiane na widocznych miejscach: kamieniach, kretowiskach, skrzyżowaniach dróg.',
        '<b>Droppings</b> twisted, with fur and bones, left on prominent spots: stones, molehills, track crossings.',
      ),
    ],
    photos: [
      { file: 'Renard roux (Vulpes vulpes) (Rhodes) (2).jpg', caption: t('Lis', 'Red fox') },
      { file: 'Red fox kit Bombay Hook (36237).jpg', caption: t('Młody lis', 'Fox cub') },
    ],
    sources: [SEJM_SEASONS, ...wiki('Lis rudy', 'Red fox')],
  },
  {
    slug: 'szakal',
    group: GROUPS.pred,
    name: t('Szakal złocisty', 'Golden jackal'),
    latin: 'Canis aureus',
    terms: t('Gatunek, który w ostatnich latach zasiedla Polskę z południa.', 'A species that has spread into Poland from the south in recent years.'),
    season: 'Szakal złocisty',
    facts: [
      [F.weight, t('8–15 kg', '8–15 kg')],
      [F.length, t('70–90 cm, ogon 20–30 cm', '70–90 cm, tail 20–30 cm')],
      [F.rut, t('Styczeń – luty', 'January – February')],
      [F.birth, t('Kwiecień – maj, 3–6 szczeniąt', 'April – May, 3–6 pups')],
      [F.life, t('W parach i grupach rodzinnych; wieczorem chóralnie wyje', 'In pairs and family groups; howls in chorus at dusk')],
    ],
    sex: [t('Płci w terenie praktycznie nie da się odróżnić; samce są nieco większe.', 'Sexes look alike in the field; males are a little larger.')],
    identify: [
      t(
        '<b>Jak odróżnić od lisa i wilka:</b> od lisa jest wyższy na nogach, ma szarożółte futro i krótszy ogon z ciemnym (nie białym) końcem. Od wilka jest wyraźnie mniejszy, wielkości średniego psa.',
        '<b>Telling it from fox and wolf:</b> taller than a fox, with a greyish-yellow coat and a shorter tail with a dark (not white) tip. Clearly smaller than a wolf, the size of a medium dog.',
      ),
    ],
    track: {
      print: { kind: 'paw', len: 6, width: 4.5, style: 'canid' },
      text: [
        t(
          'Trop psowaty, ok. 5,5–6,5 cm długości, nieco większy i węższy niż lisa; pazury blisko poduszek palców.',
          'Dog-like print about 5.5–6.5 cm long, a little bigger and narrower than a fox’s; claws close to the toe pads.',
        ),
      ],
    },
    signs: [
      t('<b>Wycie</b> grupy o zmierzchu, wysokie i „zawodzące”, często odpowiada mu kilka grup.', '<b>Howling</b> by a group at dusk, high and wailing, often answered by other groups.'),
    ],
    photos: [{ file: '033 Golden jackal in Keoladeo National Park Photo by Giles Laurent.jpg', caption: t('Szakal złocisty', 'Golden jackal') }],
    sources: [SEJM_SEASONS, ...wiki('Szakal złocisty', 'Golden jackal')],
  },
  {
    slug: 'borsuk',
    group: GROUPS.pred,
    name: t('Borsuk', 'Badger'),
    latin: 'Meles meles',
    terms: t('Schronienie: <b>jama</b> (borsucza nora), często wieloletnia, z wieloma wejściami.', 'Home: <b>jama</b> (sett), often used for many years, with many entrances.'),
    season: 'Borsuk',
    facts: [
      [F.weight, t('10–15 kg, jesienią do 20 kg', '10–15 kg, up to 20 kg in autumn')],
      [F.length, t('65–80 cm', '65–80 cm')],
      [F.breeding, t('Gody głównie wiosną, ciąża przedłużona; 2–4 młode rodzą się w jamie w styczniu – marcu', 'Mates mostly in spring with delayed implantation; 2–4 cubs born in the sett in January – March')],
      [F.life, t('Nocny; zimą śpi w jamie, w łagodne dni wychodzi', 'Nocturnal; sleeps in the sett in winter, comes out on mild days')],
      [F.food, t('Dżdżownice, owady i ich larwy, kłącza, owoce, kukurydza', 'Earthworms, insects and grubs, roots, fruit, maize')],
    ],
    sex: [t('Płci nie da się pewnie odróżnić w terenie; samiec ma zwykle szerszą głowę.', 'Sexes cannot be told apart reliably in the field; the male usually has a broader head.')],
    age: [t('Młode tego roku są jesienią wyraźnie mniejsze i lżejsze.', 'Young of the year are clearly smaller and lighter in autumn.')],
    track: {
      print: { kind: 'paw', len: 5.5, width: 5, style: 'badger' },
      text: [
        t(
          'Szeroki trop z pięcioma palcami prawie w jednej linii i długimi pazurami (przednie do 2–3 cm), przypomina mały trop niedźwiedzia. Szerokość ok. 4,5–5,5 cm.',
          'A broad print with five toes almost in a line and long claws (front ones up to 2–3 cm), like a small bear’s track. About 4.5–5.5 cm wide.',
        ),
      ],
    },
    signs: [
      t('<b>Jamy</b> z dużymi wałami wyrzuconej ziemi, często ze ściółką z liści i trawy przed wejściem.', '<b>Setts</b> with big mounds of dug earth, often with bedding of leaves and grass by the entrance.'),
      t('<b>Latryny</b>: płytkie dołki z odchodami w pobliżu jamy i na granicach terytorium.', '<b>Latrines</b>: shallow pits with droppings near the sett and on territory borders.'),
      t('<b>Wydeptane ścieżki</b> i zryte łąki z małymi lejkami po wygrzebanych larwach.', '<b>Trodden paths</b> and meadows dug over with small cone-shaped holes where grubs were taken.'),
    ],
    photos: [{ file: 'European badger (Meles meles taxus) Drenthe.jpg', caption: t('Borsuk', 'Badger') }],
    sources: [SEJM_SEASONS, ...wiki('Borsuk europejski', 'European badger')],
  },
  {
    slug: 'tchorz',
    group: GROUPS.pred,
    name: t('Tchórz zwyczajny', 'European polecat'),
    latin: 'Mustela putorius',
    terms: t('Ciemne futro z jaśniejszym podszerstkiem i białą „maską” na pysku.', 'Dark coat with lighter underfur and a white “mask” on the face.'),
    season: 'Tchórz, kuna leśna i domowa',
    facts: [
      [F.weight, t('Samiec 1–1,5 kg, samica 0,5–0,9 kg', 'Male 1–1.5 kg, female 0.5–0.9 kg')],
      [F.breeding, t('Gody marzec – kwiecień, 4–8 młodych w maju – czerwcu', 'Mates March – April, 4–8 young in May – June')],
      [F.where, t('Zadrzewienia przy wodzie, skraje lasów, zabudowania', 'Woodland near water, forest edges, farm buildings')],
      [F.food, t('Gryzonie, żaby, ptaki, jaja', 'Rodents, frogs, birds, eggs')],
    ],
    sex: [t('Samiec jest wyraźnie większy od samicy, nawet dwukrotnie cięższy.', 'The male is clearly bigger, up to twice the female’s weight.')],
    age: [t('Młode jesienią są mniejsze, z mniej wyraźną maską.', 'Young are smaller in autumn, with a less distinct mask.')],
    track: {
      print: { kind: 'paw', len: 3.5, width: 3, style: 'mustelid' },
      text: [
        t('Trop ok. 3–4 cm, pięć palców w łuku. W skokach ślady parami („dwójki”), co 30–60 cm.', 'Print about 3–4 cm, five toes in an arc. When bounding the prints come in pairs, every 30–60 cm.'),
      ],
    },
    signs: [t('Silny, nieprzyjemny zapach; zapasy żab i gryzoni w kryjówkach.', 'A strong, unpleasant smell; stores of frogs and rodents in hiding places.')],
    photos: [{ file: 'Ilder.jpg', caption: t('Tchórze', 'Polecats') }],
    sources: [SEJM_SEASONS, ...wiki('Tchórz zwyczajny', 'European polecat')],
  },
  {
    slug: 'kuna-lesna',
    group: GROUPS.pred,
    name: t('Kuna leśna', 'Pine marten'),
    latin: 'Martes martes',
    terms: t('Zwana też <b>tumakiem</b>.', 'Also called <b>tumak</b>.'),
    season: 'Tchórz, kuna leśna i domowa',
    facts: [
      [F.weight, t('1–1,8 kg', '1–1.8 kg')],
      [F.breeding, t('Gody lipiec – sierpień, ciąża przedłużona; 2–4 młode w marcu – kwietniu', 'Mates July – August with delayed implantation; 2–4 young in March – April')],
      [F.where, t('Stare lasy, dziuple, gniazda wiewiórek i ptaków', 'Old forest, tree holes, squirrel and bird nests')],
    ],
    sex: [t('Samiec jest większy, ale w terenie płci praktycznie się nie odróżnia.', 'The male is bigger, but sexes are practically impossible to tell in the field.')],
    identify: [
      t(
        '<b>Jak odróżnić od kuny domowej:</b> plama na gardle (podgardle) żółta lub pomarańczowa, zaokrąglona u dołu, nos ciemny, uszy z jasnym obrzeżeniem.',
        '<b>Telling it from the stone marten:</b> a yellow or orange throat patch, rounded at the bottom, a dark nose, ears with light edges.',
      ),
    ],
    track: {
      print: { kind: 'paw', len: 4.5, width: 4, style: 'mustelid' },
      text: [t('Trop ok. 4–5 cm, w zimie zatarty przez owłosione stopy; skoki parami.', 'Print about 4–5 cm, blurred in winter by hairy soles; bounds in pairs.')],
    },
    signs: [t('Odchody skręcone, często z pestkami owoców, na pniach i ścieżkach.', 'Twisted droppings, often with fruit stones, on logs and paths.')],
    photos: [{ file: 'Pine Marten (48173751702).jpg', caption: t('Kuna leśna', 'Pine marten') }],
    sources: [SEJM_SEASONS, ...wiki('Kuna leśna', 'European pine marten')],
  },
  {
    slug: 'kuna-domowa',
    group: GROUPS.pred,
    name: t('Kuna domowa', 'Stone marten'),
    latin: 'Martes foina',
    terms: t('Zwana też <b>kamionką</b>.', 'Also called <b>kamionka</b>.'),
    season: 'Tchórz, kuna leśna i domowa',
    facts: [
      [F.weight, t('1,1–2,3 kg', '1.1–2.3 kg')],
      [F.breeding, t('Gody lipiec – sierpień, ciąża przedłużona; 2–4 młode w marcu – kwietniu', 'Mates July – August with delayed implantation; 2–4 young in March – April')],
      [F.where, t('Blisko ludzi: strychy, stodoły, ruiny, parki', 'Near people: attics, barns, ruins, parks')],
    ],
    sex: [t('Samiec jest większy, ale w terenie płci praktycznie się nie odróżnia.', 'The male is bigger, but sexes are practically impossible to tell in the field.')],
    identify: [
      t(
        '<b>Jak odróżnić od kuny leśnej:</b> plama na gardle biała, rozwidlona w dół na przednie nogi, nos jasny, cielisty.',
        '<b>Telling it from the pine marten:</b> a white throat patch that forks down onto the front legs, a light, pinkish nose.',
      ),
    ],
    track: {
      print: { kind: 'paw', len: 4.5, width: 4, style: 'mustelid' },
      text: [t('Trop jak u kuny leśnej, ok. 4–5 cm; poduszki zwykle wyraźniejsze.', 'Print like the pine marten’s, about 4–5 cm; pads usually clearer.')],
    },
    signs: [
      t('Hałas nocą na strychu, przegryzione kable i osłony w samochodach, odchody i resztki jedzenia w budynkach.', 'Noise in the attic at night, chewed cables and insulation in cars, droppings and food remains in buildings.'),
    ],
    photos: [{ file: 'Beech Marten.jpg', caption: t('Kuna domowa – białe, rozwidlone podgardle', 'Stone marten – white, forked throat patch') }],
    sources: [SEJM_SEASONS, ...wiki('Kuna domowa', 'Beech marten')],
  },
  {
    slug: 'norka',
    group: GROUPS.pred,
    name: t('Norka amerykańska', 'American mink'),
    latin: 'Neogale vison',
    terms: t('Gatunek obcy, który uciekł z ferm; szkodzi ptakom wodnym.', 'An alien species escaped from fur farms; harms waterbirds.'),
    season: 'Norka amerykańska',
    facts: [
      [F.weight, t('0,6–1,5 kg', '0.6–1.5 kg')],
      [F.breeding, t('Gody luty – marzec, 4–6 młodych w kwietniu – maju', 'Mates February – March, 4–6 young in April – May')],
      [F.where, t('Brzegi rzek, jezior i stawów', 'Banks of rivers, lakes and ponds')],
      [F.food, t('Ryby, raki, gryzonie, ptaki wodne i ich jaja', 'Fish, crayfish, rodents, waterbirds and their eggs')],
    ],
    sex: [t('Samiec większy od samicy.', 'The male is bigger than the female.')],
    identify: [t('Futro jednolicie ciemnobrązowe z białą plamką na brodzie – odróżnia ją od tchórza (biała maska).', 'Uniform dark brown coat with a white chin spot – unlike the polecat’s white mask.')],
    track: {
      print: { kind: 'paw', len: 3.5, width: 3.5, style: 'mustelid' },
      text: [t('Trop ok. 3–4 cm, gwiaździsty, z pięcioma palcami, najczęściej w błocie nad wodą.', 'Star-shaped print about 3–4 cm with five toes, usually in mud by the water.')],
    },
    signs: [t('Resztki ryb i raków na brzegu, zniszczone gniazda ptaków wodnych.', 'Fish and crayfish remains on the bank, raided waterbird nests.')],
    photos: [{ file: 'American Mink.jpg', caption: t('Norka amerykańska', 'American mink') }],
    sources: [SEJM_SEASONS, ...wiki('Norka amerykańska', 'American mink')],
  },

  // ================================================================== small game
  {
    slug: 'zajac',
    group: GROUPS.small,
    name: t('Zając szarak', 'European hare'),
    latin: 'Lepus europaeus',
    terms: t(
      'Uszy: <b>słuchy</b>, ogon: <b>omyk</b>, oczy: <b>trzeszcze</b>, legowisko: <b>kotlinka</b>.',
      'Ears: <b>słuchy</b>, tail: <b>omyk</b>, eyes: <b>trzeszcze</b>, form (bed): <b>kotlinka</b>.',
    ),
    season: 'Zając szarak, dziki królik',
    facts: [
      [F.weight, t('3,5–5 kg', '3.5–5 kg')],
      [F.breeding, t('Luty – wrzesień, 3–4 mioty po 1–4 młode; młode rodzą się owłosione i widzące', 'February – September, 3–4 litters of 1–4; young are born furred and with open eyes')],
      [F.where, t('Pola i łąki z miedzami i zadrzewieniami', 'Fields and meadows with hedgerows and woodlots')],
    ],
    sex: [t('Płci w terenie nie da się odróżnić; po strzale – po narządach płciowych.', 'Sexes cannot be told in the field; after the shot by the genitals.')],
    age: [
      t(
        '<b>Guzek Stroha</b>: u młodych zajęcy (do ok. 7–8 miesięcy) na zewnętrznej stronie przedniej nogi, nad nadgarstkiem, wyczuwa się zgrubienie kości. U starszych zanika.',
        '<b>Stroh’s mark</b>: in young hares (up to about 7–8 months) a small bony knob can be felt on the outside of the front leg above the wrist. It disappears with age.',
      ),
    ],
    track: {
      print: { kind: 'hare', len: 9, width: 3.5 },
      text: [
        t(
          'Ślady w grupach po cztery: przednie łapy jedna za drugą, tylne obok siebie przed nimi. Tylny ślad 6–12 cm, owłosiony, bez wyraźnych poduszek.',
          'Prints come in groups of four: the front feet one behind the other, the hind feet side by side ahead of them. Hind print 6–12 cm, hairy, without clear pads.',
        ),
      ],
    },
    signs: [
      t('<b>Kotlinka</b>: płytkie zagłębienie w ziemi lub śniegu, w którym zając leży za dnia.', '<b>Form</b> (kotlinka): a shallow scrape in soil or snow where the hare lies by day.'),
      t('<b>Bobki</b> okrągłe, lekko spłaszczone, ok. 1,5 cm; zgryzione pędy ścięte ukośnie, obgryziona kora drzew owocowych.', '<b>Droppings</b> round and slightly flat, about 1.5 cm; shoots cut off at a slant, bark gnawed on fruit trees.'),
    ],
    photos: [{ file: 'European Brown Hare (50341079472).jpg', caption: t('Zając szarak', 'European hare') }],
    sources: [SEJM_SEASONS, ...wiki('Zając szarak', 'European hare')],
  },
  {
    slug: 'krolik',
    group: GROUPS.small,
    name: t('Dziki królik', 'European rabbit'),
    latin: 'Oryctolagus cuniculus',
    terms: t('W Polsce rzadki, żyje koloniami w norach.', 'Rare in Poland, lives in colonies in burrows.'),
    season: 'Zając szarak, dziki królik',
    facts: [
      [F.weight, t('1,2–2 kg', '1.2–2 kg')],
      [F.breeding, t('Luty – wrzesień, kilka miotów po 4–8 młodych, które rodzą się nagie i ślepe', 'February – September, several litters of 4–8 young that are born naked and blind')],
      [F.where, t('Piaszczyste skarpy, nasypy, parki, obrzeża miast', 'Sandy banks, embankments, parks, town edges')],
    ],
    sex: [t('Płci w terenie nie da się odróżnić.', 'Sexes cannot be told apart in the field.')],
    identify: [
      t(
        '<b>Jak odróżnić od zająca:</b> mniejszy, uszy krótsze od głowy i bez czarnych końców, krótsze nogi; w razie zagrożenia ucieka do nory, a zając – w otwarte pole.',
        '<b>Telling it from a hare:</b> smaller, ears shorter than the head and without black tips, shorter legs; it runs to its burrow when alarmed, a hare runs into open field.',
      ),
    ],
    track: {
      print: { kind: 'hare', len: 5, width: 2.5 },
      text: [t('Układ śladów jak u zająca, ale ślady mniejsze (tylny 4–6 cm) i skoki krótsze.', 'Pattern like a hare’s but smaller (hind print 4–6 cm) with shorter bounds.')],
    },
    signs: [t('Nory z wieloma wejściami, kupki bobków (ok. 1 cm) w stałych miejscach.', 'Burrows with many entrances, heaps of droppings (about 1 cm) at fixed spots.')],
    photos: [{ file: 'Oryctolagus cuniculus Tasmania 2 (cropped).jpg', caption: t('Dziki królik', 'European rabbit') }],
    sources: [SEJM_SEASONS, ...wiki('Królik europejski', 'European rabbit')],
  },

  // ================================================================== birds
  {
    slug: 'bazant',
    group: GROUPS.birds,
    name: t('Bażant', 'Common pheasant'),
    latin: 'Phasianus colchicus',
    terms: t('Samiec: <b>kogut</b>, samica: <b>kura</b>.', 'Male: <b>kogut</b> (cock), female: <b>kura</b> (hen).'),
    season: 'Bażant',
    facts: [
      [F.weight, t('Kogut 1,2–1,5 kg, kura ok. 1 kg', 'Cock 1.2–1.5 kg, hen about 1 kg')],
      [F.breeding, t('Kwiecień – czerwiec, 8–12 jaj w gnieździe na ziemi', 'April – June, 8–12 eggs in a ground nest')],
      [F.where, t('Pola z zadrzewieniami, trzcinowiska; gatunek sprowadzony do Europy', 'Farmland with copses, reedbeds; introduced to Europe')],
    ],
    sex: [
      t(
        'Kogut barwny, z długim ogonem, zielonogłowy, z czerwonymi <b>różami</b> wokół oczu; kura brązowo nakrapiana, z krótszym ogonem.',
        'The cock is colourful with a long tail, a green head and red wattles around the eyes; the hen is speckled brown with a shorter tail.',
      ),
    ],
    age: [
      t(
        '<b>Ostroga</b> koguta: u młodych krótka i tępa, u starszych długa i ostra.',
        'The cock’s <b>spur</b>: short and blunt in young birds, long and sharp in older ones.',
      ),
    ],
    track: {
      print: { kind: 'bird', len: 6.5, width: 6, feet: 'game', hind: 'short' },
      text: [t('Trzy palce do przodu (środkowy najdłuższy) i krótki tylny; długość ok. 6–7 cm.', 'Three toes forward (the middle one longest) and a short hind toe; about 6–7 cm long.')],
    },
    signs: [t('Kąpieliska piaskowe, wiosną donośne „kok-kok” koguta z trzepotem skrzydeł.', 'Dust baths; in spring the cock’s loud “kok-kok” call with a wing whirr.')],
    photos: [{ file: 'Fagiano 1.jpg', caption: t('Kogut bażanta', 'Pheasant cock') }],
    sources: [SEJM_SEASONS, ...wiki('Bażant zwyczajny', 'Common pheasant')],
  },
  {
    slug: 'kuropatwa',
    group: GROUPS.birds,
    name: t('Kuropatwa', 'Grey partridge'),
    latin: 'Perdix perdix',
    terms: t('Jesienią i zimą żyje w rodzinnych <b>stadkach</b>.', 'Lives in family <b>coveys</b> in autumn and winter.'),
    season: 'Kuropatwa',
    facts: [
      [F.weight, t('ok. 0,4 kg', 'about 0.4 kg')],
      [F.breeding, t('Maj – czerwiec, 10–20 jaj w gnieździe na ziemi', 'May – June, 10–20 eggs in a ground nest')],
      [F.where, t('Pola z miedzami i zakrzaczeniami', 'Fields with field margins and scrub')],
    ],
    sex: [
      t(
        'Kogut ma zwykle wyraźną kasztanową „<b>podkowę</b>” na piersi (u kury bywa słabsza). Pewniejsza cecha: pióra pokryw skrzydłowych kury mają poprzeczne jasne prążki, koguta – tylko podłużną jasną kreskę.',
        'The cock usually has a clear chestnut “<b>horseshoe</b>” on the belly (often fainter in hens). Surer: the hen’s wing covert feathers have light cross-bars, the cock’s only a light lengthwise streak.',
      ),
    ],
    age: [t('U młodych dwie pierwsze lotki są zaostrzone, a nogi żółtawe; u dorosłych lotki zaokrąglone, nogi szare.', 'Young birds have the first two primaries pointed and yellowish legs; adults have rounded primaries and grey legs.')],
    track: {
      print: { kind: 'bird', len: 3.8, width: 3.5, feet: 'game', hind: 'short' },
      text: [t('Ślad ok. 3,5–4 cm, trzy palce i bardzo krótki tylny; stadko zostawia gęstą siatkę śladów.', 'Print about 3.5–4 cm, three toes and a very short hind toe; a covey leaves a dense web of tracks.')],
    },
    signs: [t('Kąpieliska w piasku, zimą „kotlinki” w śniegu, gdzie stadko nocuje w kręgu.', 'Dust baths; in winter hollows in the snow where the covey roosts in a circle.')],
    photos: [{ file: 'Nurmkana (cropped).jpg', caption: t('Kuropatwa', 'Grey partridge') }],
    sources: [SEJM_SEASONS, ...wiki('Kuropatwa zwyczajna', 'Grey partridge')],
  },
  {
    slug: 'jarzabek',
    group: GROUPS.birds,
    name: t('Jarząbek', 'Hazel grouse'),
    latin: 'Tetrastes bonasia',
    terms: t('Najmniejszy z naszych kuraków leśnych.', 'The smallest of our forest grouse.'),
    season: 'Jarząbek',
    facts: [
      [F.weight, t('ok. 0,4 kg', 'about 0.4 kg')],
      [F.breeding, t('Maj – czerwiec, 7–11 jaj', 'May – June, 7–11 eggs')],
      [F.where, t('Wilgotne lasy mieszane z leszczyną, olchą i brzozą', 'Damp mixed forest with hazel, alder and birch')],
    ],
    sex: [t('Kogut ma czarne podgardle obrzeżone białym paskiem; u kury podgardle jest jasne, brązowawe.', 'The cock has a black throat edged with white; the hen’s throat is pale brownish.')],
    age: [t('Młode jesienią mają krótsze, mniej kontrastowe pióra.', 'Young birds have shorter, less contrasting feathers in autumn.')],
    track: {
      print: { kind: 'bird', len: 4, width: 4, feet: 'game', hind: 'short' },
      text: [t('Ślad ok. 4 cm; zimą boki palców obrastają rogowymi frędzlami, które poszerzają odcisk.', 'Print about 4 cm; in winter horny fringes grow on the toes and widen the print.')],
    },
    signs: [t('Zgryzione pąki i kotki olchy, brzozy i leszczyny; zimą nocuje zagrzebany w śniegu.', 'Nipped buds and catkins of alder, birch and hazel; roosts buried in snow in winter.')],
    photos: [{ file: 'Tetrastes bonasia.jpg', caption: t('Jarząbek', 'Hazel grouse') }],
    sources: [SEJM_SEASONS, ...wiki('Jarząbek zwyczajny', 'Hazel grouse')],
  },
  {
    slug: 'krzyzowka',
    group: GROUPS.birds,
    name: t('Krzyżówka', 'Mallard'),
    latin: 'Anas platyrhynchos',
    terms: t('Samiec: <b>kaczor</b>, samica: <b>kaczka</b>. Barwne pole na skrzydle: <b>lusterko</b>.', 'Male: <b>kaczor</b> (drake), female: <b>kaczka</b>. Coloured wing patch: <b>lusterko</b> (speculum).'),
    season: 'Kaczki: krzyżówka, cyraneczka, głowienka, czernica',
    facts: [
      [F.weight, t('1–1,3 kg', '1–1.3 kg')],
      [F.breeding, t('Marzec – maj, 8–12 jaj', 'March – May, 8–12 eggs')],
      [F.life, t('Kaczka pływająca: żeruje z powierzchni, nie nurkuje; startuje prosto z wody', 'Dabbling duck: feeds from the surface, does not dive; takes off straight from the water')],
    ],
    sex: [
      t(
        'Kaczor: zielona głowa, biała obroża, brązowa pierś. Kaczka brązowo nakrapiana, dziób pomarańczowy z ciemnym. Oboje mają niebieskie lusterko z białymi obwódkami.',
        'Drake: green head, white collar, brown breast. Female speckled brown, bill orange with dark marks. Both have a blue speculum edged with white.',
      ),
      t('Latem kaczor w <b>szacie spoczynkowej</b> wygląda jak kaczka, ale ma żółtozielony dziób.', 'In summer the drake in <b>eclipse plumage</b> looks like a female but has a yellow-green bill.'),
    ],
    age: [t('Młode jesienią podobne do samic; dorosłe kaczory mają podkręcone środkowe sterówki.', 'Young look like females in autumn; adult drakes have curled central tail feathers.')],
    track: {
      print: { kind: 'bird', len: 5.5, width: 5.5, feet: 'webbed', hind: 'none' },
      text: [t('Trzy palce spięte błoną pławną, ok. 5–6 cm; palce lekko zwrócone do środka.', 'Three webbed toes, about 5–6 cm; toes turned slightly inward.')],
    },
    signs: [t('Pióra i odchody na brzegach, ścieżki w trzcinach, wieczorne przeloty na żerowiska.', 'Feathers and droppings on banks, paths through reeds, evening flights to feeding sites.')],
    photos: [{ file: 'Anas platyrhynchos (mixed pair) (32428014687).jpg', caption: t('Kaczor i kaczka krzyżówki', 'Mallard drake and duck') }],
    sources: [SEJM_SEASONS, ...wiki('Krzyżówka (ptak)', 'Mallard')],
  },
  {
    slug: 'cyraneczka',
    group: GROUPS.birds,
    name: t('Cyraneczka', 'Eurasian teal'),
    latin: 'Anas crecca',
    terms: t('Najmniejsza z naszych kaczek.', 'The smallest of our ducks.'),
    season: 'Kaczki: krzyżówka, cyraneczka, głowienka, czernica',
    facts: [
      [F.weight, t('ok. 0,3 kg', 'about 0.3 kg')],
      [F.breeding, t('Kwiecień – czerwiec, 8–11 jaj', 'April – June, 8–11 eggs')],
      [F.life, t('Kaczka pływająca; lata szybko, zwrotnie, w zwartych stadach', 'Dabbling duck; flies fast and nimbly in tight flocks')],
    ],
    sex: [
      t(
        'Kaczor: kasztanowa głowa z zieloną plamą wokół oka, żółty trójkąt pod ogonem. Kaczka brązowa, drobna. Lusterko zielone.',
        'Drake: chestnut head with a green patch around the eye, a yellow triangle under the tail. Female small and brown. Green speculum.',
      ),
    ],
    age: [t('Młode jesienią podobne do samic.', 'Young look like females in autumn.')],
    track: {
      print: { kind: 'bird', len: 4, width: 4, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 4 cm.', 'Webbed print, about 4 cm.')],
    },
    signs: [t('Stada żerujące na płyciznach i błotnistych brzegach.', 'Flocks feeding in shallows and on muddy shores.')],
    photos: [{ file: 'Eurasian Teal Anas crecca, RSPB Titchwell, Norfolk (33675784246).jpg', caption: t('Kaczor i kaczka cyraneczki', 'Teal drake and duck') }],
    sources: [SEJM_SEASONS, ...wiki('Cyraneczka zwyczajna', 'Eurasian teal')],
  },
  {
    slug: 'glowienka',
    group: GROUPS.birds,
    name: t('Głowienka', 'Common pochard'),
    latin: 'Aythya ferina',
    terms: t('Kaczka nurkująca.', 'A diving duck.'),
    season: 'Kaczki: krzyżówka, cyraneczka, głowienka, czernica',
    facts: [
      [F.weight, t('0,8–1 kg', '0.8–1 kg')],
      [F.breeding, t('Maj – czerwiec, 6–11 jaj', 'May – June, 6–11 eggs')],
      [F.life, t('Nurkuje po pokarm; przed startem rozbiega się po wodzie', 'Dives for food; runs along the water before take-off')],
    ],
    sex: [t('Kaczor: rdzawoczerwona głowa, czarna pierś, szary grzbiet. Kaczka szarobrązowa, z jaśniejszym pyskiem.', 'Drake: rusty-red head, black breast, grey back. Female greyish-brown with a paler face.')],
    age: [t('Młode jesienią podobne do samic.', 'Young look like females in autumn.')],
    track: {
      print: { kind: 'bird', len: 5.5, width: 5.5, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 5–6 cm.', 'Webbed print, about 5–6 cm.')],
    },
    signs: [t('Stada na otwartej wodzie jezior i stawów.', 'Flocks on open water of lakes and ponds.')],
    photos: [
      { file: 'Aythya ferina Sandwell 2.jpg', caption: t('Kaczor głowienki', 'Pochard drake') },
      { file: 'Aythya ferina Gentofte 1.jpg', caption: t('Kaczka głowienki z młodymi', 'Pochard duck with ducklings') },
    ],
    sources: [SEJM_SEASONS, ...wiki('Głowienka zwyczajna', 'Common pochard')],
  },
  {
    slug: 'czernica',
    group: GROUPS.birds,
    name: t('Czernica', 'Tufted duck'),
    latin: 'Aythya fuligula',
    terms: t('Kaczka nurkująca z czubem na potylicy.', 'A diving duck with a crest on the back of the head.'),
    season: 'Kaczki: krzyżówka, cyraneczka, głowienka, czernica',
    facts: [
      [F.weight, t('0,7–1 kg', '0.7–1 kg')],
      [F.breeding, t('Maj – lipiec, 8–11 jaj', 'May – July, 8–11 eggs')],
      [F.life, t('Nurkuje po małże i bezkręgowce', 'Dives for mussels and invertebrates')],
    ],
    sex: [t('Kaczor czarny z białymi bokami i wyraźnym czubem. Kaczka ciemnobrązowa z małym czubem. Oboje mają żółte oczy.', 'Drake black with white flanks and a clear crest. Female dark brown with a small crest. Both have yellow eyes.')],
    age: [t('Młode jesienią podobne do samic, z krótszym czubem.', 'Young look like females in autumn, with a shorter crest.')],
    track: {
      print: { kind: 'bird', len: 5.5, width: 5.5, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 5–6 cm.', 'Webbed print, about 5–6 cm.')],
    },
    signs: [t('Stada na otwartej wodzie, często z głowienkami.', 'Flocks on open water, often with pochards.')],
    photos: [{ file: 'Tufted Duck 09 05 2025 02.jpg', caption: t('Kaczor czernicy', 'Tufted duck drake') }],
    sources: [SEJM_SEASONS, ...wiki('Czernica', 'Tufted duck')],
  },
  {
    slug: 'gegawa',
    group: GROUPS.birds,
    name: t('Gęgawa', 'Greylag goose'),
    latin: 'Anser anser',
    terms: t('Jedyna dzika gęś, która licznie gniazduje w Polsce.', 'The only wild goose that breeds widely in Poland.'),
    season: 'Gęgawa',
    facts: [
      [F.weight, t('3–4 kg', '3–4 kg')],
      [F.breeding, t('Marzec – kwiecień, 4–7 jaj, gniazdo w trzcinach', 'March – April, 4–7 eggs, nest in reeds')],
      [F.where, t('Jeziora i stawy z trzcinowiskami; żeruje na polach i łąkach', 'Lakes and ponds with reedbeds; feeds on fields and meadows')],
    ],
    sex: [t('Płcie wyglądają tak samo; gąsior jest nieco większy.', 'Sexes look alike; the gander is a little bigger.')],
    identify: [
      t(
        '<b>Jak rozpoznać:</b> największa z szarych gęsi, jasnoszara, z grubym pomarańczowym dziobem i różowymi nogami; w locie jasne przednie części skrzydeł.',
        '<b>How to recognise:</b> the biggest grey goose, pale grey with a thick orange bill and pink legs; light forewings in flight.',
      ),
    ],
    track: {
      print: { kind: 'bird', len: 11, width: 11, feet: 'webbed', hind: 'none' },
      text: [t('Duży ślad z błoną pławną, ok. 10–12 cm.', 'Large webbed print, about 10–12 cm.')],
    },
    signs: [t('Zielone, walcowate odchody i pióra na polach i łąkach, gdzie żerują stada.', 'Green cylindrical droppings and feathers on fields and meadows where flocks feed.')],
    photos: [{ file: '00 3688 Graugans (Anser anser).jpg', caption: t('Gęgawy', 'Greylag geese') }],
    sources: [SEJM_SEASONS, ...wiki('Gęgawa', 'Greylag goose')],
  },
  {
    slug: 'ges-zbozowa',
    group: GROUPS.birds,
    name: t('Gęś zbożowa', 'Bean goose'),
    latin: 'Anser fabalis',
    terms: t('Przelotna i zimująca; gniazduje w tundrze i tajdze.', 'A migrant and winter visitor; breeds in tundra and taiga.'),
    season: 'Gęś zbożowa i białoczelna',
    facts: [
      [F.weight, t('2,5–3,5 kg', '2.5–3.5 kg')],
      [F.where, t('Jesienią i zimą na polach, nocuje na dużych zbiornikach', 'In autumn and winter on fields, roosts on large waters')],
    ],
    sex: [t('Płcie wyglądają tak samo.', 'Sexes look alike.')],
    identify: [
      t(
        '<b>Jak rozpoznać:</b> ciemnobrązowa głowa i szyja, czarny dziób z pomarańczową przepaską, pomarańczowe nogi.',
        '<b>How to recognise:</b> dark brown head and neck, black bill with an orange band, orange legs.',
      ),
    ],
    track: {
      print: { kind: 'bird', len: 10, width: 10, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 9–11 cm.', 'Webbed print, about 9–11 cm.')],
    },
    signs: [t('Duże stada na oziminach i ścierniskach.', 'Large flocks on winter cereals and stubbles.')],
    photos: [{ file: 'Anser fabalis fabalis (Taiga Bean Goose), Naturschutzgebiet Schellbruch, Lübeck, Germany.jpg', caption: t('Gęś zbożowa', 'Bean goose') }],
    sources: [SEJM_SEASONS, ...wiki('Gęś zbożowa', 'Bean goose')],
  },
  {
    slug: 'ges-bialoczelna',
    group: GROUPS.birds,
    name: t('Gęś białoczelna', 'Greater white-fronted goose'),
    latin: 'Anser albifrons',
    terms: t('Przelotna i zimująca, często w stadach z gęsią zbożową.', 'A migrant and winter visitor, often in flocks with bean geese.'),
    season: 'Gęś zbożowa i białoczelna',
    facts: [
      [F.weight, t('2–3 kg', '2–3 kg')],
      [F.where, t('Jesienią i zimą na polach i łąkach', 'In autumn and winter on fields and meadows')],
    ],
    sex: [t('Płcie wyglądają tak samo.', 'Sexes look alike.')],
    age: [
      t(
        'Dorosłe mają <b>białe czoło</b> u nasady dziobu i czarne poprzeczne plamy na brzuchu; młode w pierwszej jesieni nie mają ani białego czoła, ani plam.',
        'Adults have a <b>white forehead</b> at the base of the bill and black bars on the belly; first-autumn young have neither.',
      ),
    ],
    track: {
      print: { kind: 'bird', len: 9, width: 9, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 8–10 cm.', 'Webbed print, about 8–10 cm.')],
    },
    signs: [t('Wysokie, „szczekliwe” głosy przelatujących stad.', 'High, yelping calls of passing flocks.')],
    photos: [{ file: 'Anser albifrons albifrons Swallow Pond 2.jpg', caption: t('Gęś białoczelna – białe czoło i plamy na brzuchu', 'White-fronted goose – white forehead and belly bars') }],
    sources: [SEJM_SEASONS, ...wiki('Gęś białoczelna', 'Greater white-fronted goose')],
  },
  {
    slug: 'lyska',
    group: GROUPS.birds,
    name: t('Łyska', 'Eurasian coot'),
    latin: 'Fulica atra',
    terms: t('Nie kaczka, lecz ptak chruścielowaty.', 'Not a duck but a member of the rail family.'),
    season: 'Łyska',
    facts: [
      [F.weight, t('0,7–0,9 kg', '0.7–0.9 kg')],
      [F.breeding, t('Kwiecień – czerwiec, 6–9 jaj w pływającym gnieździe', 'April – June, 6–9 eggs in a floating nest')],
      [F.life, t('Nurkuje po rośliny; startuje, długo biegnąc po wodzie', 'Dives for plants; takes off with a long run across the water')],
    ],
    sex: [t('Cała czarna z białym dziobem i białą tarczką na czole; samiec ma zwykle większą tarczkę.', 'All black with a white bill and white forehead shield; the male’s shield is usually bigger.')],
    age: [t('Młode są szarobrązowe z jasnym gardłem, bez tarczki.', 'Young are grey-brown with a pale throat and no shield.')],
    track: {
      print: { kind: 'bird', len: 9, width: 8, feet: 'lobed', hind: 'short' },
      text: [t('Długie palce z płatkami (bez błony między palcami), ślad ok. 8–10 cm.', 'Long toes with lobes (no web between them), print about 8–10 cm.')],
    },
    signs: [t('Pływające gniazda i platformy z roślin w trzcinach.', 'Floating nests and plant platforms in the reeds.')],
    photos: [{ file: 'Fulica atra Georges-Valbon 01.jpg', caption: t('Łyska', 'Coot') }],
    sources: [SEJM_SEASONS, ...wiki('Łyska (ptak)', 'Eurasian coot')],
  },
  {
    slug: 'grzywacz',
    group: GROUPS.birds,
    name: t('Gołąb grzywacz', 'Common wood pigeon'),
    latin: 'Columba palumbus',
    terms: t('Największy z naszych gołębi.', 'Our largest pigeon.'),
    season: 'Gołąb grzywacz',
    facts: [
      [F.weight, t('ok. 0,5 kg', 'about 0.5 kg')],
      [F.breeding, t('Kwiecień – wrzesień, 2–3 lęgi po 2 jaja w lekkim gnieździe z patyków', 'April – September, 2–3 broods of 2 eggs in a flimsy twig nest')],
      [F.food, t('Nasiona, zboże, rzepak, żołędzie', 'Seeds, cereals, rapeseed, acorns')],
    ],
    sex: [t('Płcie wyglądają tak samo.', 'Sexes look alike.')],
    age: [t('Dorosłe mają białą plamę po bokach szyi; młode jej nie mają. W locie u obu widać biały pas na skrzydle.', 'Adults have a white patch on the side of the neck; young birds lack it. Both show a white wing bar in flight.')],
    track: {
      print: { kind: 'bird', len: 5, width: 4, feet: 'game', hind: 'long' },
      text: [t('Trzy palce do przodu i długi palec tylny; ślad ok. 5 cm. Chodzi krokami, nie skacze.', 'Three toes forward and a long hind toe; print about 5 cm. Walks rather than hops.')],
    },
    signs: [t('Luźne pióra, żerowiska na rzepaku i ścierniskach; głośny klaskający odlot.', 'Loose feathers, feeding sites on rapeseed and stubble; a loud clapping take-off.')],
    photos: [{ file: 'Columba palumbus -garden post-8.jpg', caption: t('Gołąb grzywacz – biała plama na szyi', 'Wood pigeon – white neck patch') }],
    sources: [SEJM_SEASONS, ...wiki('Grzywacz', 'Common wood pigeon')],
  },
  {
    slug: 'slonka',
    group: GROUPS.birds,
    name: t('Słonka', 'Eurasian woodcock'),
    latin: 'Scolopax rusticola',
    terms: t('Wiosenny lot godowy samca o zmierzchu: <b>ciąg</b>.', 'The male’s spring display flight at dusk: <b>ciąg</b> (roding).'),
    season: 'Słonka',
    facts: [
      [F.weight, t('ok. 0,3 kg', 'about 0.3 kg')],
      [F.breeding, t('Kwiecień – czerwiec, zwykle 4 jaja na ziemi w lesie', 'April – June, usually 4 eggs on the forest floor')],
      [F.food, t('Dżdżownice i larwy wydobywane długim dziobem z miękkiej ziemi', 'Earthworms and grubs probed from soft soil with its long bill')],
    ],
    sex: [t('Płci w terenie nie da się odróżnić.', 'Sexes cannot be told apart in the field.')],
    identify: [
      t(
        '<b>Jak rozpoznać:</b> brązowe, maskujące upierzenie, prosty dziób ok. 7 cm, oczy osadzone wysoko i daleko z tyłu głowy.',
        '<b>How to recognise:</b> brown camouflaged plumage, a straight bill of about 7 cm, eyes set high and far back on the head.',
      ),
    ],
    track: {
      print: { kind: 'bird', len: 4, width: 4, feet: 'game', hind: 'short' },
      text: [t('Ślad ok. 4 cm, cienkie palce; obok często dziurki po dziobie w błocie.', 'Print about 4 cm with thin toes; often with bill probe holes in the mud beside it.')],
    },
    signs: [t('Białe plamy odchodów („kleksy”) i otwory po dziobie w wilgotnej ziemi.', 'White splashes of droppings and bill holes in damp soil.')],
    photos: [{ file: 'Waldschnepfe (scolopax rusticola) - Spiekeroog, Nationalpark Niedersächsisches Wattenmeer.jpg', caption: t('Słonka', 'Woodcock') }],
    sources: [SEJM_SEASONS, ...wiki('Słonka zwyczajna', 'Eurasian woodcock')],
  },
];
