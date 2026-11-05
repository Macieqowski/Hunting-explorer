// Atlas pages: protected species that hunters can mistake for game. Each page lists the game
// species it is confused with (`lookalikes`); the game pages link back from that list.
// Protection status from the species protection regulation (consolidated text Dz.U. 2022
// poz. 2380): annex 1 = strict protection, annex 2 = partial protection.
// Written for this app in our own words from the sources listed for each species.

import { GROUPS, F, PROTECTION_ACT, wiki, type Species, type Tx } from './atlasCommon';

const t = (pl: string, en: string): Tx => ({ pl, en });

export const PROTECTED: Species[] = [
  // ================================================================== mammals
  {
    slug: 'wilk',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['szakal', 'lis'],
    name: t('Wilk', 'Grey wolf'),
    latin: 'Canis lupus',
    terms: t(
      'Samiec to <b>basior</b>, samica <b>wadera</b>, młode to <b>szczenięta</b>, a grupa rodzinna to <b>wataha</b>.',
      'The male is a <b>basior</b>, the female a <b>wadera</b>, the young are <b>szczenięta</b> and the family group is a <b>wataha</b> (pack).',
    ),
    facts: [
      [F.weight, t('30–50 kg, duże basiory więcej', '30–50 kg, big males more')],
      [F.height, t('70–90 cm', '70–90 cm')],
      [F.rut, t('Luty – marzec', 'February – March')],
      [F.birth, t('Kwiecień – maj, zwykle 4–6 szczeniąt', 'April – May, usually 4–6 pups')],
      [F.life, t('Wataha rodzinna na dużym terytorium; poluje głównie na jelenie, sarny i dziki', 'A family pack on a large territory; hunts mainly red deer, roe deer and wild boar')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od szakala:</b> wilk jest dwa–trzy razy cięższy, wielkości owczarka niemieckiego, ma długie nogi, jasne policzki i ciemne siodło na grzbiecie. Szakal jest wielkości średniego psa.',
        '<b>Telling it from the golden jackal:</b> a wolf is two to three times heavier, the size of a German shepherd, with long legs, pale cheeks and a dark saddle. A jackal is the size of a medium dog.',
      ),
      t(
        '<b>Jak odróżnić od lisa:</b> lis jest dużo mniejszy, rudy, z czarnymi „pończochami” i białym końcem kity. Ogon wilka jest prosty, zwisający, z ciemnym końcem.',
        '<b>Telling it from the fox:</b> a fox is much smaller and red, with black “stockings” and a white tail tip. The wolf’s tail hangs straight and has a dark tip.',
      ),
      t(
        '<b>W polowaniu zbiorowym:</b> przy słabym świetle i w gęstwinie nie strzelaj do psowatego, którego nie widzisz w całości.',
        '<b>On a driven hunt:</b> in poor light or thick cover, never shoot at a canid you cannot see in full.',
      ),
    ],
    sex: [t('Basior jest większy i ma szerszą głowę, ale w terenie płci zwykle nie da się odróżnić.', 'The male is bigger with a broader head, but in the field the sexes usually cannot be told apart.')],
    track: {
      print: { kind: 'paw', len: 10, width: 8.5, style: 'canid' },
      text: [
        t(
          'Trop psowaty, 9–11 cm długości, wyraźnie większy niż lisa czy szakala. Wilki idą „gęsiego”, stawiając łapy w jednej linii i często w tropy poprzednika, więc wataha zostawia jedną prostą ścieżkę.',
          'Dog-like print 9–11 cm long, clearly bigger than a fox’s or jackal’s. Wolves walk in single file, in a straight line and often in the leader’s prints, so a pack leaves one straight trail.',
        ),
      ],
    },
    signs: [
      t('<b>Odchody</b> z sierścią i kawałkami kości, zostawiane na skrzyżowaniach dróg leśnych.', '<b>Droppings</b> full of hair and bone fragments, left at forest road junctions.'),
      t('Resztki upolowanych jeleni i saren; <b>wycie</b> watahy, najczęściej zimą i pod koniec lata.', 'Remains of killed deer; pack <b>howling</b>, most often in winter and late summer.'),
    ],
    photos: [{ file: 'Eurasian wolf 2.jpg', caption: t('Wilk', 'Wolf') }],
    sources: [PROTECTION_ACT, ...wiki('Wilk szary', 'Wolf')],
  },
  {
    slug: 'rys',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['lis'],
    name: t('Ryś', 'Eurasian lynx'),
    latin: 'Lynx lynx',
    terms: t('Jedyny duży kot w Polsce. Młode to <b>kocięta</b>.', 'The only big cat in Poland. The young are kittens.'),
    facts: [
      [F.weight, t('18–30 kg', '18–30 kg')],
      [F.length, t('80–110 cm, krótki ogon 15–25 cm', '80–110 cm, short tail 15–25 cm')],
      [F.rut, t('Luty – marzec', 'February – March')],
      [F.birth, t('Maj – czerwiec, 2–3 kocięta', 'May – June, 2–3 kittens')],
      [F.where, t('Duże lasy północno-wschodniej Polski i Karpat; wsiedlany także na zachodzie', 'Large forests of north-eastern Poland and the Carpathians; also reintroduced in the west')],
      [F.life, t('Samotnik; poluje z zasadzki, głównie na sarny', 'Solitary; ambushes its prey, mainly roe deer')],
    ],
    identify: [
      t(
        '<b>Jak rozpoznać:</b> wysokie nogi, krótki ogon z czarnym końcem, pędzelki na uszach i baki na policzkach. Futro szarożółte lub rudawe, zwykle w ciemne cętki.',
        '<b>How to recognise:</b> long legs, a short tail with a black tip, ear tufts and cheek ruffs. Greyish-yellow or reddish coat, usually with dark spots.',
      ),
      t(
        '<b>Jak odróżnić od lisa:</b> w półmroku mignięcie rudawego zwierzęcia może wyglądać jak lis, ale lis ma długą kitę. Na śniegu trop rysia jest okrągły, bez pazurów i dwa razy większy niż lisa.',
        '<b>Telling it from the fox:</b> a reddish animal glimpsed at dusk can look like a fox, but a fox has a long bushy tail. In snow a lynx print is round, clawless and twice the size of a fox’s.',
      ),
    ],
    sex: [t('Samiec jest większy, ale w terenie płci nie da się pewnie odróżnić.', 'The male is bigger, but the sexes cannot be told apart reliably in the field.')],
    track: {
      print: { kind: 'paw', len: 7.5, width: 7.5, style: 'felid' },
      text: [
        t(
          'Trop okrągły, 7–9 cm, cztery palce, <b>bez śladów pazurów</b> (kot je chowa). Poduszka podeszwy szeroka, z tyłu trójpłatowa.',
          'Round print, 7–9 cm, four toes and <b>no claw marks</b> (the claws are retracted). Wide sole pad with three lobes at the back.',
        ),
      ],
    },
    signs: [
      t('Ofiara (zwykle sarna) przykryta liśćmi lub śniegiem; ryś wraca do niej przez kilka nocy.', 'Prey (usually a roe deer) covered with leaves or snow; the lynx returns to it for several nights.'),
      t('Ślady drapania na pniach.', 'Claw marks on tree trunks.'),
    ],
    photos: [{ file: 'Lynx Nationalpark Bayerischer Wald 01.jpg', caption: t('Ryś – krótki ogon z czarnym końcem', 'Lynx: short tail with a black tip') }],
    sources: [PROTECTION_ACT, ...wiki('Ryś euroazjatycki', 'Eurasian lynx')],
  },
  {
    slug: 'wydra',
    group: GROUPS.protected,
    protection: 'partial',
    lookalikes: ['norka'],
    name: t('Wydra', 'Eurasian otter'),
    latin: 'Lutra lutra',
    terms: t('Największy krajowy łasicowaty związany z wodą.', 'The largest native mustelid living by water.'),
    facts: [
      [F.weight, t('6–12 kg', '6–12 kg')],
      [F.length, t('60–90 cm, ogon 35–45 cm', '60–90 cm, tail 35–45 cm')],
      [F.breeding, t('Młode (2–3) mogą przyjść na świat o każdej porze roku', 'The young (2–3) can be born at any time of year')],
      [F.where, t('Rzeki, jeziora, stawy rybne', 'Rivers, lakes, fish ponds')],
      [F.food, t('Głównie ryby, też płazy i raki', 'Mainly fish, also amphibians and crayfish')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od norki:</b> wydra jest kilka razy większa (norka waży 0,5–1,5 kg), ma płaską, szeroką głowę, jaśniejsze gardło i gruby u nasady ogon. Norka jest ciemnobrązowa, prawie czarna, z białą plamką na brodzie.',
        '<b>Telling it from the American mink:</b> an otter is several times bigger (a mink weighs 0.5–1.5 kg), with a flat broad head, a paler throat and a tail thick at the base. A mink is dark brown, almost black, with a white chin spot.',
      ),
      t(
        'Pływająca wydra wystawia nad wodę tylko głowę i czasem grzbiet; płynie spokojnie i długo nurkuje.',
        'A swimming otter shows only its head and sometimes its back; it swims calmly and dives for long.',
      ),
    ],
    sex: [t('Samiec większy; w terenie płci nie da się odróżnić.', 'The male is bigger; the sexes cannot be told apart in the field.')],
    track: {
      print: { kind: 'paw', len: 6.5, width: 6, style: 'mustelid' },
      text: [
        t(
          'Trop okrągły, 6–7 cm, pięć palców, czasem widać błonę między nimi. Na śniegu między tropami ciągnie się ślad ogona.',
          'Round print, 6–7 cm, five toes, sometimes with the web between them. In snow the tail drags between the prints.',
        ),
      ],
    },
    signs: [
      t('<b>Odchody</b> z łuskami ryb na kamieniach i pod mostami, o rybim, słodkawym zapachu.', '<b>Droppings</b> with fish scales on stones and under bridges, smelling of fish and slightly sweet.'),
      t('<b>Ślizgawki</b>: wygładzone zjazdy do wody na stromych brzegach.', '<b>Slides</b>: smooth runs down steep banks into the water.'),
    ],
    photos: [
      { file: 'Fischotter, Lutra Lutra.JPG', caption: t('Wydra', 'Otter') },
      { file: 'Eurasian Otter (Lutra lutra) (2).jpg', caption: t('Pływająca wydra – widać tylko głowę i grzbiet', 'Swimming otter: only head and back show') },
    ],
    sources: [PROTECTION_ACT, ...wiki('Wydra europejska', 'Eurasian otter')],
  },

  // ================================================================== birds
  {
    slug: 'ges-mala',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['ges-bialoczelna'],
    name: t('Gęś mała', 'Lesser white-fronted goose'),
    latin: 'Anser erythropus',
    terms: t(
      'Jedna z najrzadszych gęsi Europy; przelatuje przez Polskę często w stadach gęsi białoczelnych.',
      'One of Europe’s rarest geese; it passes through Poland, often in flocks of greater white-fronted geese.',
    ),
    facts: [
      [F.weight, t('1,5–2,5 kg', '1.5–2.5 kg')],
      [F.where, t('U nas tylko na przelotach, wiosną i jesienią', 'Here only on migration, in spring and autumn')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od gęsi białoczelnej:</b> jest mniejsza, ma krótszą szyję i krótki dziób. Biała plama na czole sięga wyżej, na ciemię, a wokół oka jest <b>żółta obrączka</b>, której białoczelna nie ma.',
        '<b>Telling it from the white-fronted goose:</b> smaller, with a shorter neck and a short bill. The white blaze reaches higher, onto the crown, and there is a <b>yellow eye ring</b>, which the white-fronted goose lacks.',
      ),
      t('Gdy w stadzie białoczelnych nie da się wykluczyć gęsi małej, nie strzelaj.', 'If you cannot rule out a lesser white-front in a flock of white-fronted geese, do not shoot.'),
    ],
    sex: [t('Płci nie da się odróżnić.', 'The sexes look alike.')],
    track: {
      print: { kind: 'bird', len: 8, width: 8, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 8 cm, nieco mniejszy niż gęsi białoczelnej.', 'Webbed print, about 8 cm, a little smaller than a white-fronted goose’s.')],
    },
    signs: [t('Głos wyższy i bardziej piskliwy niż białoczelnej.', 'Its call is higher and squeakier than a white-fronted goose’s.')],
    photos: [{ file: 'Lesser White-fronted Goose (19324016712).jpg', caption: t('Gęś mała – żółta obrączka wokół oka', 'Lesser white-fronted goose: yellow eye ring') }],
    sources: [PROTECTION_ACT, ...wiki('Gęś mała', 'Lesser white-fronted goose')],
  },
  {
    slug: 'cyranka',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['cyraneczka'],
    name: t('Cyranka', 'Garganey'),
    latin: 'Spatula querquedula',
    terms: t(
      'Mała kaczka, która zimuje w Afryce; w Polsce od marca do września, więc jest jeszcze u nas na początku sezonu na kaczki.',
      'A small duck that winters in Africa; in Poland from March to September, so it is still here when the duck season opens.',
    ),
    facts: [
      [F.weight, t('0,3–0,45 kg', '0.3–0.45 kg')],
      [F.breeding, t('Maj – czerwiec, 8–11 jaj', 'May – June, 8–11 eggs')],
      [F.where, t('Podmokłe łąki, płytkie zarośnięte zbiorniki', 'Wet meadows, shallow overgrown waters')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od cyraneczki:</b> kaczor wiosną ma szeroką białą brew zakręcającą ku karkowi. Latem i jesienią kaczory wyglądają jak kaczki; wtedy patrz na głowę: cyranka ma wyraźny ciemny pasek przez oko, jasną brew i jasną plamkę u nasady dzioba.',
        '<b>Telling it from the teal:</b> in spring the drake has a broad white stripe curving back to the nape. In summer and autumn drakes look like females; then look at the head: the garganey has a clear dark eye stripe, a pale brow and a pale spot at the base of the bill.',
      ),
      t(
        'W locie lusterko cyranki jest matowe, zielonobrązowe lub szare, a przednia część skrzydła kaczora jasnoszara. Cyraneczka ma lśniące zielone lusterko.',
        'In flight the garganey’s speculum is dull green-brown or grey, and the drake’s forewing is pale grey. A teal has a bright green speculum.',
      ),
    ],
    sex: [t('Wiosną kaczor z białą brwią; od lipca do jesieni podobny do kaczki.', 'In spring the drake has the white brow; from July into autumn he looks like the female.')],
    track: {
      print: { kind: 'bird', len: 4, width: 4, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 4 cm, jak u cyraneczki.', 'Webbed print, about 4 cm, like a teal’s.')],
    },
    signs: [t('Wiosną terkoczący głos kaczora, podobny do grzechotki.', 'In spring the drake’s rattling call.')],
    photos: [{ file: 'Garganey ( Anas querquedula ) Drake ... South Yorkshire (53695451967).jpg', caption: t('Kaczor cyranki wiosną', 'Garganey drake in spring') }],
    sources: [PROTECTION_ACT, ...wiki('Cyranka zwyczajna', 'Garganey')],
  },
  {
    slug: 'krakwa',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['krzyzowka'],
    name: t('Krakwa', 'Gadwall'),
    latin: 'Mareca strepera',
    terms: t('Kaczka pływająca nieco mniejsza od krzyżówki.', 'A dabbling duck a little smaller than a mallard.'),
    facts: [
      [F.weight, t('0,6–1 kg', '0.6–1 kg')],
      [F.breeding, t('Maj – czerwiec, 8–12 jaj', 'May – June, 8–12 eggs')],
      [F.where, t('Jeziora i stawy z bogatą roślinnością', 'Lakes and ponds with rich vegetation')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od krzyżówki:</b> obie płci krakwy mają <b>białe lusterko</b>, widoczne w locie jako biały kwadrat na tylnym brzegu skrzydła. Krzyżówka ma lusterko niebieskie z białymi obwódkami.',
        '<b>Telling it from the mallard:</b> both sexes of gadwall have a <b>white speculum</b>, seen in flight as a white square on the trailing edge of the wing. A mallard’s speculum is blue with white borders.',
      ),
      t(
        'Kaczor krakwy jest szary, drobno prążkowany, z czarnym zadem i bez zielonej głowy. Kaczka podobna do kaczki krzyżówki, ale ma pomarańczowe brzegi dzioba i biały brzuch.',
        'The gadwall drake is grey, finely vermiculated, with a black rear and no green head. The female resembles a female mallard, but has orange edges to the bill and a white belly.',
      ),
    ],
    sex: [t('Kaczor szary z czarnym zadem; kaczka brązowa, nakrapiana.', 'Drake grey with a black rear; female mottled brown.')],
    track: {
      print: { kind: 'bird', len: 5, width: 5, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 5 cm.', 'Webbed print, about 5 cm.')],
    },
    signs: [t('Kaczor wydaje niskie, chrapliwe „ark”.', 'The drake gives a low, croaking “ark”.')],
    photos: [{ file: 'Anas strepera pair.jpg', caption: t('Para krakw', 'Gadwall pair') }],
    sources: [PROTECTION_ACT, ...wiki('Krakwa', 'Gadwall')],
  },
  {
    slug: 'podgorzalka',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['glowienka'],
    name: t('Podgorzałka', 'Ferruginous duck'),
    latin: 'Aythya nyroca',
    terms: t('Rzadka kaczka nurkująca, w Polsce nieliczna.', 'A rare diving duck, scarce in Poland.'),
    facts: [
      [F.weight, t('0,5–0,7 kg', '0.5–0.7 kg')],
      [F.breeding, t('Maj – czerwiec', 'May – June')],
      [F.where, t('Stawy rybne i płytkie jeziora z szuwarami', 'Fish ponds and shallow lakes with reed beds')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od głowienki:</b> podgorzałka jest cała ciemnokasztanowa, bez szarego grzbietu i czarnej piersi kaczora głowienki, i ma <b>białe podogonie</b>. Kaczor ma białe oko.',
        '<b>Telling it from the pochard:</b> the ferruginous duck is dark chestnut all over, without the pochard drake’s grey back and black breast, and has a <b>white undertail</b>. The drake has a white eye.',
      ),
      t('W locie szeroki biały pas przez całe skrzydło.', 'In flight a broad white bar runs along the whole wing.'),
    ],
    sex: [t('Kaczor z białą tęczówką, kaczka matowobrązowa z ciemnym okiem.', 'Drake with a white iris; female duller brown with a dark eye.')],
    track: {
      print: { kind: 'bird', len: 4.5, width: 4.5, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 4,5 cm.', 'Webbed print, about 4.5 cm.')],
    },
    signs: [t('Trzyma się blisko trzcin, rzadko na otwartej wodzie.', 'Keeps close to the reeds, rarely on open water.')],
    photos: [{ file: 'Ferruginous Pochard Aythya nyroca Male by Dr. Raju Kasambe DSCN2746 (12).jpg', caption: t('Kaczor podgorzałki', 'Ferruginous duck drake') }],
    sources: [PROTECTION_ACT, ...wiki('Podgorzałka zwyczajna', 'Ferruginous duck')],
  },
  {
    slug: 'ogorzalka',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['czernica'],
    name: t('Ogorzałka', 'Greater scaup'),
    latin: 'Aythya marila',
    terms: t('Kaczka nurkująca, która zimuje głównie na Bałtyku i w zatokach.', 'A diving duck that winters mainly on the Baltic and its bays.'),
    facts: [
      [F.weight, t('0,9–1,3 kg', '0.9–1.3 kg')],
      [F.where, t('U nas głównie zimą, na wybrzeżu i dużych jeziorach', 'Here mainly in winter, on the coast and large lakes')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od czernicy:</b> kaczor ogorzałki ma <b>szary, drobno prążkowany grzbiet</b> (czernica czarny) i nie ma czubka na głowie. Kaczka ogorzałki ma <b>dużą białą plamę</b> wokół nasady dzioba; u kaczki czernicy plamy nie ma albo jest mała.',
        '<b>Telling it from the tufted duck:</b> the scaup drake has a <b>grey, finely barred back</b> (the tufted drake’s is black) and no tuft. The scaup female has a <b>large white patch</b> around the base of the bill; a female tufted duck has none or only a small one.',
      ),
    ],
    sex: [t('Kaczor czarno-biało-szary, z zielonym połyskiem głowy; kaczka brązowa z białą „maską”.', 'Drake black, white and grey with a green-glossed head; female brown with a white face patch.')],
    track: {
      print: { kind: 'bird', len: 5.5, width: 5.5, feet: 'webbed', hind: 'none' },
      text: [t('Ślad z błoną pławną, ok. 5,5 cm, jak u czernicy.', 'Webbed print, about 5.5 cm, like a tufted duck’s.')],
    },
    signs: [t('Duże stada na morzu, często razem z czernicami.', 'Large flocks at sea, often mixed with tufted ducks.')],
    photos: [{ file: '2017-03-24 Aythya marila, male, Killingworth Lake, Northumberland 20.jpg', caption: t('Kaczor ogorzałki', 'Scaup drake') }],
    sources: [PROTECTION_ACT, ...wiki('Ogorzałka zwyczajna', 'Greater scaup')],
  },
  {
    slug: 'kszyk',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['slonka'],
    name: t('Kszyk', 'Common snipe'),
    latin: 'Gallinago gallinago',
    terms: t('Ptak siewkowy z długim dziobem, krewny słonki, ale żyjący na mokradłach.', 'A long-billed wader related to the woodcock, but living on wetlands.'),
    facts: [
      [F.weight, t('ok. 0,1 kg', 'about 0.1 kg')],
      [F.breeding, t('Kwiecień – czerwiec, 4 jaja na ziemi', 'April – June, 4 eggs on the ground')],
      [F.where, t('Podmokłe łąki, torfowiska, brzegi wód', 'Wet meadows, bogs, waterside mud')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od słonki:</b> kszyk jest trzy razy lżejszy i smuklejszy, ma <b>podłużne</b> jasne pasy na głowie i grzbiecie (słonka ma poprzeczne prążki na tyle głowy). Żyje na otwartych mokradłach, nie w lesie.',
        '<b>Telling it from the woodcock:</b> a snipe is three times lighter and slimmer, with <b>lengthwise</b> pale stripes on the head and back (a woodcock has crosswise bars on the back of the head). It lives on open wetlands, not in woodland.',
      ),
      t('Spłoszony zrywa się z ostrym, chrapliwym głosem i leci zygzakiem.', 'When flushed it rises with a harsh call and flies off in a zigzag.'),
    ],
    sex: [t('Płci nie da się odróżnić.', 'The sexes look alike.')],
    track: {
      print: { kind: 'bird', len: 3.8, width: 3.5, feet: 'game', hind: 'short' },
      text: [t('Ślad ok. 3,5–4 cm, cienkie palce; obok dziurki po dziobie w błocie.', 'Print about 3.5–4 cm with thin toes; bill holes in the mud beside it.')],
    },
    signs: [t('Wiosną <b>beczenie</b>: w locie tokowym samiec opada, a sterówki ogona wydają dźwięk podobny do beczenia kozy.', 'In spring <b>drumming</b>: in its display flight the male dives and its outer tail feathers make a bleating sound.')],
    photos: [{ file: 'Gallinago gallinago a1.JPG', caption: t('Kszyk', 'Snipe') }],
    sources: [PROTECTION_ACT, ...wiki('Kszyk', 'Common snipe')],
  },
  {
    slug: 'siniak',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['grzywacz'],
    name: t('Siniak', 'Stock dove'),
    latin: 'Columba oenas',
    terms: t('Leśny gołąb, który gniazduje w dziuplach starych drzew.', 'A woodland pigeon that nests in holes in old trees.'),
    facts: [
      [F.weight, t('0,25–0,35 kg', '0.25–0.35 kg')],
      [F.breeding, t('Kwiecień – sierpień, w dziuplach, 2 jaja', 'April – August, in tree holes, 2 eggs')],
      [F.where, t('Stare lasy, zwłaszcza bukowe, z dziuplami po dzięciole czarnym', 'Old forests, especially beech, with black woodpecker holes')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od grzywacza:</b> siniak jest mniejszy i nie ma <b>białej plamy na szyi</b> ani <b>białego pasa na skrzydle</b>, które grzywacz pokazuje w locie. Na skrzydle ma dwie krótkie czarne pręgi.',
        '<b>Telling it from the woodpigeon:</b> a stock dove is smaller and has no <b>white neck patch</b> and no <b>white wing band</b>, which a woodpigeon shows in flight. It has two short black bars on the wing.',
      ),
      t('Często miesza się ze stadami grzywaczy na polach.', 'It often mixes with woodpigeon flocks on fields.'),
    ],
    sex: [t('Płci nie da się odróżnić.', 'The sexes look alike.')],
    track: {
      print: { kind: 'bird', len: 3.5, width: 3, feet: 'game', hind: 'long' },
      text: [t('Ślad ok. 3,5 cm, z długim tylnym palcem, mniejszy niż grzywacza.', 'Print about 3.5 cm with a long hind toe, smaller than a woodpigeon’s.')],
    },
    signs: [t('Wiosną głuche, dwusylabowe „u-u” z dziupli.', 'In spring a deep two-note “oo-oo” from a tree hole.')],
    photos: [{ file: '2025-03-24 Columba oenas, Jesmond Dene 6.jpg', caption: t('Siniak – bez białej plamy na szyi', 'Stock dove: no white neck patch') }],
    sources: [PROTECTION_ACT, ...wiki('Siniak', 'Stock dove')],
  },
  {
    slug: 'przepiorka',
    group: GROUPS.protected,
    protection: 'strict',
    lookalikes: ['kuropatwa'],
    name: t('Przepiórka', 'Common quail'),
    latin: 'Coturnix coturnix',
    terms: t('Najmniejszy krajowy kurak; ptak wędrowny, u nas od maja do września.', 'Our smallest galliform; a migrant, here from May to September.'),
    facts: [
      [F.weight, t('0,08–0,13 kg', '0.08–0.13 kg')],
      [F.breeding, t('Maj – lipiec, 8–13 jaj w zbożu', 'May – July, 8–13 eggs in crops')],
      [F.where, t('Pola zbóż, łąki', 'Cereal fields, meadows')],
    ],
    identify: [
      t(
        '<b>Jak odróżnić od kuropatwy:</b> przepiórka jest trzy–cztery razy mniejsza, wielkości szpaka, nie ma rdzawej podkowy na piersi ani rdzawego ogona. Głowa w podłużne jasne pasy.',
        '<b>Telling it from the grey partridge:</b> a quail is three to four times smaller, starling-sized, with no chestnut horseshoe on the breast and no rufous tail. Its head has lengthwise pale stripes.',
      ),
      t('Zrywa się pojedynczo, nie stadkiem, i szybko zapada w zboże. Kuropatwy zrywają się całym stadkiem.', 'It flushes singly, not in a covey, and soon drops back into the crop. Partridges rise as a whole covey.'),
    ],
    sex: [t('Samiec ma ciemny wzór na gardle, samica płowe, nakrapiane gardło.', 'The male has a dark throat pattern, the female a buff, speckled throat.')],
    track: {
      print: { kind: 'bird', len: 2.5, width: 2.5, feet: 'game', hind: 'short' },
      text: [t('Ślad ok. 2,5 cm, o połowę mniejszy niż kuropatwy.', 'Print about 2.5 cm, half the size of a partridge’s.')],
    },
    signs: [t('Częściej słyszana niż widziana: trzysylabowe „pódź-pó-dziom” samca z łanu zboża.', 'Heard more than seen: the male’s three-note “whit-wi-whit” from a cereal field.')],
    photos: [{ file: 'Coturnix coturnix, Fraunberg, Bayern, Deutschland 2, Ausschnitt.jpg', caption: t('Przepiórka', 'Quail') }],
    sources: [PROTECTION_ACT, ...wiki('Przepiórka zwyczajna', 'Common quail')],
  },
];
