// First aid on a hunt ("Wypadek"): what to do, step by step, until the ambulance comes.
//
// Written in Polish for laypeople, in our own words, from the European Resuscitation Council
// Guidelines 2025 (First Aid, Basic Life Support, Special Circumstances; Polish terms from the
// Polska Rada Resuscytacji translation). Where ERC 2025 no longer covers a topic (fractures,
// frostbite, rabies) the card names the source it follows instead. Each step that does not come
// straight from ERC 2025 is listed in REVIEW_NOTES for the medical reviewer.
//
// Nothing here diagnoses or replaces a course: every card starts with safety and a call to 112.
// All of it is part of the app bundle, so it works without internet from the first start.

export type AidArt =
  | 'safety'
  | 'press'
  | 'pack'
  | 'tourniquet'
  | 'chest'
  | 'airway'
  | 'breathing'
  | 'cpr'
  | 'recovery'
  | 'head'
  | 'splint'
  | 'cold'
  | 'heart'
  | 'face'
  | 'pen'
  | 'snake'
  | 'sugar'
  | 'frost'
  | 'ice'
  | 'phone';

/** Where a "Tak / Nie" answer leads: the id of a later step in the card, or `card:<slug>`. */
export type AidGo = string;

export interface AidStep {
  /** What to do, as an order ("Uciśnij ranę…"). */
  t: string;
  /** One or two short sentences. */
  d?: string;
  art?: AidArt;
  /** Target of `ask` answers. */
  id?: string;
  /** A question instead of "Dalej". */
  ask?: { q: string; yes: AidGo; no: AidGo };
  /** A tool on the step: the tourniquet clock, the CPR metronome, or "note the time". */
  tool?: 'tq' | 'cpr' | 'time';
  /** "Dalej" after this step goes to the end of the card (the end of a branch). */
  last?: boolean;
}

export type AidSource = 'ercFa' | 'ercBls' | 'ercSc' | 'prr' | 'erc21' | 'wmsFrost' | 'wmsHypo' | 'who';

export const SOURCES: Record<AidSource, { label: string; url: string }> = {
  ercFa: {
    label: 'Wytyczne ERC 2025: Pierwsza pomoc (Djärv T. i in., Resuscitation 2025;215:110752)',
    url: 'https://doi.org/10.1016/j.resuscitation.2025.110752',
  },
  ercBls: {
    label: 'Wytyczne ERC 2025: Podstawowe zabiegi resuscytacyjne u dorosłych (Smyth M.A. i in., Resuscitation 2025;215:110771)',
    url: 'https://doi.org/10.1016/j.resuscitation.2025.110771',
  },
  ercSc: {
    label: 'Wytyczne ERC 2025: Resuscytacja w szczególnych okolicznościach (Lott C. i in., Resuscitation 2025;215:110753)',
    url: 'https://doi.org/10.1016/j.resuscitation.2025.110753',
  },
  prr: {
    label: 'Resuscytacja dla każdego według Wytycznych ERC 2025, tłum. Polska Rada Resuscytacji',
    url: 'https://www.prc.krakow.pl/wp-content/uploads/2026/04/Broszura-ERC-2025-i.pdf',
  },
  erc21: {
    label: 'Wytyczne ERC 2021: Pierwsza pomoc (Zideman D.A. i in., Resuscitation 2021;161:270-290)',
    url: 'https://doi.org/10.1016/j.resuscitation.2021.02.013',
  },
  wmsFrost: {
    label: 'Wilderness Medical Society: zapobieganie i leczenie odmrożeń, aktualizacja 2024 (Wilderness Environ Med 2024;35:183-197)',
    url: 'https://doi.org/10.1177/10806032231222359',
  },
  wmsHypo: {
    label: 'Wilderness Medical Society: hipotermia przypadkowa poza szpitalem, aktualizacja 2019 (Wilderness Environ Med 2019;30:S47-S69)',
    url: 'https://doi.org/10.1016/j.wem.2019.10.002',
  },
  who: {
    label: 'Światowa Organizacja Zdrowia: wścieklizna, postępowanie po narażeniu',
    url: 'https://www.who.int/news-room/fact-sheets/detail/rabies',
  },
};

export interface AidCard {
  slug: string;
  title: string;
  /** Short label for a big tile on the emergency screen; cards without it are listed below. */
  tile?: string;
  art: AidArt;
  /** How to recognise it. */
  when: string[];
  steps: AidStep[];
  /** Extra boxes after the steps ("Gdy coś zostało odcięte"). */
  extra?: { h: string; items: string[] }[];
  /** What not to do. */
  dont: string[];
  src: AidSource[];
}

/** Said before every card: the hunt stops, guns are unloaded, someone calls 112. */
export const FIRST: AidStep[] = [
  {
    t: 'Wstrzymaj polowanie',
    d: 'Krzyknij głośno „Wypadek! Przerwać polowanie!”. Prowadzący ogłasza przerwę. Nikt nie strzela, dopóki ranny nie jest bezpieczny.',
    art: 'safety',
  },
  {
    t: 'Rozładuj broń',
    d: 'Swoją i rannego, jeśli leży obok. Odłóż ją lufą w bezpieczną stronę, tak żeby nikt się o nią nie potknął.',
    art: 'safety',
  },
  {
    t: 'Dzwoń 112 albo poproś o to kogoś obok',
    d: 'Włącz głośnik i nie rozłączaj się pierwszy. Dyspozytor powie Ci, co robić. Współrzędne do podania są na ekranie „Wypadek”.',
    art: 'phone',
  },
];

export const CARDS: AidCard[] = [
  {
    slug: 'krwotok',
    title: 'Silny krwotok, postrzał ręki lub nogi',
    tile: 'Krwotok',
    art: 'press',
    when: [
      'krew wypływa strumieniem albo pulsuje',
      'krew szybko przesiąka przez ubranie, pod rannym rośnie kałuża',
      'po postrzale rana może być mała, a krwotok duży: obejrzyj całą kończynę',
    ],
    steps: [
      {
        t: 'Uciśnij ranę dłonią, całym ciężarem ciała',
        d: 'Od razu, mocno i bez przerwy. Rękawiczki załóż tylko wtedy, gdy masz je pod ręką.',
        art: 'press',
      },
      {
        t: 'Włóż opatrunek w ranę i uciskaj na nim',
        d: 'Najlepiej opatrunek hemostatyczny (tamujący krew) z apteczki, inaczej zwykły opatrunek albo czysty materiał. Głęboką ranę wypełnij nim do końca, potem znów uciskaj.',
        art: 'pack',
      },
      {
        t: 'Czy krwawienie ustało?',
        ask: { q: 'Czy krwawienie ustało pod uciskiem?', yes: 'opatrunek', no: 'opaska' },
      },
      {
        id: 'opatrunek',
        t: 'Załóż opatrunek uciskowy',
        d: 'Owiń ranę mocno bandażem na opatrunku. Jeśli krew znów przesiąka, wróć do ucisku i załóż opaskę uciskową.',
        art: 'pack',
        last: true,
      },
      {
        id: 'opaska',
        t: 'Załóż opaskę uciskową 5–7 cm powyżej rany',
        d: 'Nie na stawie. Dokręcaj, aż krwawienie zwolni i ustanie. To boli, tak ma być. Najlepiej opaska fabryczna z krętlikiem.',
        art: 'tourniquet',
      },
      {
        t: 'Zapisz godzinę założenia',
        d: 'Na opasce (pisakiem) i w telefonie: przycisk poniżej zapamięta godzinę i pokaże, ile minęło. Przekaż ją ratownikom.',
        tool: 'tq',
        art: 'tourniquet',
      },
      {
        t: 'Czy krew nadal płynie?',
        ask: { q: 'Czy krew nadal płynie mimo dokręconej opaski?', yes: 'druga', no: 'ciepło' },
      },
      {
        id: 'druga',
        t: 'Załóż drugą opaskę tuż powyżej pierwszej',
        d: 'Pierwszej nie zdejmuj. Gdy nie masz drugiej opaski, uciskaj ranę dalej.',
        art: 'tourniquet',
      },
      {
        id: 'ciepło',
        t: 'Połóż rannego i chroń go przed zimnem',
        d: 'Utrata krwi i zimno szybko się sumują. Podłóż coś pod plecy, okryj folią NRC albo kurtką. Gdy nogi nie są ranne, możesz je unieść, aż przyjadą ratownicy.',
        art: 'cold',
      },
    ],
    extra: [
      {
        h: 'Gdy nie masz opaski uciskowej',
        items: [
          'Uciskaj ranę bez przerwy do przyjazdu ratowników. Zmieniajcie się, gdy zabraknie Ci sił, bez puszczania ucisku.',
          'Opaska zrobiona z paska albo chusty zwykle nie zatrzymuje krwotoku z tętnicy tak dobrze jak fabryczna (ERC 2025). Dobrze uciskana rana jest lepsza niż źle założona opaska.',
        ],
      },
      {
        h: 'Gdy coś zostało odcięte (np. palec)',
        items: [
          'Najpierw zatamuj krwotok.',
          'Odciętą część owiń jałowym opatrunkiem lub czystą tkaniną zwilżoną wodą i włóż do szczelnego woreczka.',
          'Ten woreczek włóż do drugiego, z lodem i wodą. Część nie może dotykać lodu ani zamarznąć.',
          'Opisz woreczek: imię rannego i godzina. Ma jechać z rannym do tego samego szpitala.',
        ],
      },
    ],
    dont: [
      'Nie luzuj i nie zdejmuj opaski uciskowej. Zrobi to lekarz albo ratownik.',
      'Nie uciskaj „punktów uciskowych” zamiast rany: uciskaj samą ranę.',
      'Nie zaglądaj co chwilę pod opatrunek: każde puszczenie ucisku to nowa utrata krwi.',
    ],
    src: ['ercFa'],
  },
  {
    slug: 'postrzal-tulowia',
    title: 'Postrzał tułowia, szyi lub głowy',
    tile: 'Postrzał tułowia',
    art: 'chest',
    when: [
      'rana na klatce piersiowej, brzuchu, plecach, szyi lub głowie',
      'duszność, kaszel z krwią, świst lub bulgotanie przy ranie klatki piersiowej',
      'na tułowiu opaski uciskowej nie da się założyć: zostaje ucisk',
    ],
    steps: [
      {
        t: 'Uciśnij miejsce, które mocno krwawi',
        d: 'Dłonią przez opatrunek albo czysty materiał. Na szyi uciskaj tylko ranę, nigdy obu stron szyi naraz.',
        art: 'press',
      },
      {
        t: 'Ranę klatki piersiowej zostaw otwartą',
        d: 'Nie zaklejaj jej i nie przykrywaj szczelnie: powietrze musi mieć ujście. Jeśli z niej krwawi, uciskaj obok, a nie zatykaj otworu. Specjalny opatrunek z zastawką zakłada tylko ktoś przeszkolony.',
        art: 'chest',
      },
      {
        t: 'Nie wyjmuj tego, co tkwi w ranie',
        d: 'Wbity przedmiot zostaw i obłóż go opatrunkami, żeby się nie ruszał. Ranę brzucha z wydostającymi się narządami przykryj czystym, wilgotnym materiałem, nie wpychaj ich z powrotem.',
        art: 'pack',
      },
      {
        t: 'Czy ranny jest przytomny?',
        ask: { q: 'Czy ranny jest przytomny i odpowiada?', yes: 'przytomny', no: 'nieprzytomny' },
      },
      {
        id: 'przytomny',
        t: 'Pozwól mu przyjąć pozycję, w której łatwiej oddycha',
        d: 'Zwykle półsiedzącą, z oparciem. Mów do niego spokojnie, nie zostawiaj go samego.',
        art: 'breathing',
      },
      {
        t: 'Chroń przed zimnem i obserwuj oddech',
        d: 'Okryj go, podłóż coś pod spód. Niczego nie dawaj do picia ani jedzenia. Gdy straci przytomność, sprawdź oddech.',
        art: 'cold',
        last: true,
      },
      {
        id: 'nieprzytomny',
        t: 'Sprawdź oddech przez 10 sekund',
        d: 'Nie układaj rannego w pozycji bocznej: po urazie zostaw go tak, jak leży, chyba że jest w niebezpieczeństwie.',
        art: 'breathing',
        ask: { q: 'Czy oddycha prawidłowo?', yes: 'obserwuj', no: 'card:rko' },
      },
      {
        id: 'obserwuj',
        t: 'Chroń przed zimnem i sprawdzaj oddech co minutę',
        d: 'Gdy przestanie oddychać prawidłowo, zacznij RKO.',
        art: 'cold',
      },
    ],
    dont: [
      'Nie zaklejaj szczelnie rany klatki piersiowej (folią, taśmą).',
      'Nie wyjmuj wbitych przedmiotów i nie wpychaj narządów do brzucha.',
      'Nie podawaj nic do picia ani jedzenia.',
    ],
    src: ['ercFa'],
  },
  {
    slug: 'rko',
    title: 'Nie reaguje i nie oddycha (RKO)',
    tile: 'Nie oddycha',
    art: 'cpr',
    when: [
      'nie reaguje na głos ani potrząsanie za ramiona',
      'nie oddycha albo tylko z rzadka łapie powietrze (to nie jest prawidłowy oddech)',
    ],
    steps: [
      {
        t: 'Sprawdź, czy reaguje',
        d: 'Potrząśnij delikatnie za ramiona i zapytaj głośno: „Czy wszystko w porządku?”.',
        art: 'head',
      },
      {
        t: 'Udrożnij drogi oddechowe',
        d: 'Jedną dłoń połóż na czole, palcami drugiej unieś brodę i delikatnie odchyl głowę do tyłu.',
        art: 'airway',
      },
      {
        t: 'Sprawdź oddech przez 10 sekund',
        d: 'Patrz na klatkę piersiową, słuchaj, poczuj oddech na policzku.',
        art: 'breathing',
        ask: { q: 'Czy oddycha prawidłowo?', yes: 'card:nieprzytomny-oddycha', no: 'uciski' },
      },
      {
        id: 'uciski',
        t: 'Dzwoń 112 i włącz głośnik',
        d: 'Jeśli ktoś jest obok, niech dzwoni on, a Ty zaczynaj. Gdy ktoś wie, gdzie jest defibrylator AED, niech biegnie po niego.',
        art: 'phone',
      },
      {
        t: 'Uciskaj środek klatki piersiowej 30 razy',
        d: 'Nasada dłoni na dolnej połowie mostka, druga dłoń na niej, ręce proste. Wciskaj na 5–6 cm, 100–120 razy na minutę, i pozwól klatce wrócić. Metronom poniżej podaje tempo.',
        art: 'cpr',
        tool: 'cpr',
      },
      {
        t: 'Daj 2 oddechy ratownicze',
        d: 'Zatkaj nos, obejmij ustami usta rannego, wdmuchuj powietrze przez około sekundę, aż klatka się uniesie. Jeśli nie umiesz albo nie chcesz, uciskaj bez przerwy.',
        art: 'airway',
      },
      {
        t: 'Powtarzaj 30 uciśnięć i 2 oddechy',
        d: 'Nie przerywaj na dłużej niż 10 sekund. Co 2 minuty zmieniajcie się przy uciskaniu. Przestań, gdy przejmą ratownicy, ranny zacznie oddychać albo opadniesz z sił.',
        art: 'cpr',
        tool: 'cpr',
      },
    ],
    extra: [
      {
        h: 'Gdy jest defibrylator AED',
        items: ['Włącz go i rób to, co mówi. Elektrody przyklej na odsłoniętą, suchą klatkę piersiową. Nie przerywaj uciśnięć dłużej, niż każe AED.'],
      },
      {
        h: 'Po wyciągnięciu z wody',
        items: ['Zacznij od 5 oddechów ratowniczych, potem 30 uciśnięć i 2 oddechy. Przed AED osusz klatkę piersiową.'],
      },
      {
        h: 'Gdy ranny jest wychłodzony',
        items: ['Uciskaj bez przerw aż do przyjazdu ratowników, nawet długo. Po wychłodzeniu szanse na przeżycie są duże.'],
      },
    ],
    dont: [
      'Nie czekaj z uciskaniem na pewność: lepiej zacząć niepotrzebnie, niż nie zacząć.',
      'Nie bój się złamać żeber: przy uciskaniu to się zdarza i nie jest groźne w porównaniu z brakiem RKO.',
    ],
    src: ['ercBls', 'prr', 'ercSc'],
  },
  {
    slug: 'nieprzytomny-oddycha',
    title: 'Nie reaguje, ale oddycha',
    tile: 'Nieprzytomny',
    art: 'recovery',
    when: ['nie reaguje na głos ani potrząsanie', 'oddycha prawidłowo, spokojnie i regularnie'],
    steps: [
      {
        t: 'Czy to może być uraz?',
        d: 'Upadek z wysokości, postrzał, uderzenie drzewem, wypadek samochodowy.',
        ask: { q: 'Czy doszło do urazu (upadek, postrzał, uderzenie)?', yes: 'uraz', no: 'boczna' },
      },
      {
        id: 'boczna',
        t: 'Ułóż go w pozycji bocznej',
        d: 'Na boku, z ugiętą nogą i ręką, głowa lekko odchylona, tak żeby treść z ust mogła wypłynąć.',
        art: 'recovery',
      },
      {
        t: 'Chroń przed zimnem i sprawdzaj oddech co minutę',
        d: 'Podłóż coś pod spód, okryj. Gdy przestanie oddychać prawidłowo, połóż go na plecach i zacznij RKO. Jeśli to cukrzyk, nie podawaj mu nic do ust.',
        art: 'cold',
        last: true,
      },
      {
        id: 'uraz',
        t: 'Zostaw go tak, jak leży',
        d: 'Po urazie nie układaj w pozycji bocznej. Trzymaj głowę nieruchomo w osi ciała, jak w karcie „Upadek z ambony”.',
        art: 'head',
      },
      {
        t: 'Chroń przed zimnem i sprawdzaj oddech co minutę',
        d: 'Gdy przestanie oddychać prawidłowo, zacznij RKO.',
        art: 'cold',
      },
    ],
    dont: ['Nie podawaj nic do picia ani do ust.', 'Nie układaj w pozycji bocznej po urazie ani przy nieprawidłowym oddechu.'],
    src: ['ercFa', 'prr'],
  },
  {
    slug: 'bol-w-klatce',
    title: 'Ból w klatce piersiowej (zawał)',
    tile: 'Ból w klatce',
    art: 'heart',
    when: [
      'ucisk, gniecenie lub pieczenie w klatce piersiowej',
      'ból promieniuje do szyi, żuchwy lub lewej ręki',
      'duszność, poty, bladość, nudności, lęk',
    ],
    steps: [
      {
        t: 'Przerwij wysiłek, posadź go wygodnie',
        d: 'Albo połóż, jak mu wygodniej. Uspokój go. Nie pozwól mu iść do samochodu ani na ambonę.',
        art: 'heart',
      },
      {
        t: 'Dzwoń 112',
        d: 'Powiedz, że podejrzewasz zawał. Podaj wiek i godzinę początku bólu.',
        art: 'phone',
      },
      {
        t: 'Pomóż mu rozgryźć aspirynę (150–500 mg)',
        d: 'Jedną tabletkę kwasu acetylosalicylowego do rozgryzienia i rozpuszczenia w ustach, jeśli jest przytomny i połyka. Nie podawaj, gdy jest uczulony na aspirynę albo ból wiąże się z urazem.',
        art: 'heart',
      },
      {
        t: 'Jeśli ma swoją nitroglicerynę, pomóż mu ją przyjąć',
        d: 'Dotyczy osób z rozpoznaną chorobą wieńcową, które mają lek przy sobie.',
        art: 'heart',
      },
      {
        t: 'Zostań z nim i obserwuj',
        d: 'Gdy przestanie reagować i nie oddycha prawidłowo, zacznij RKO.',
        art: 'breathing',
      },
    ],
    dont: ['Nie każ mu chodzić ani nic dźwigać.', 'Nie podawaj aspiryny przy uczuleniu na nią ani po urazie.'],
    src: ['ercFa', 'prr'],
  },
  {
    slug: 'upadek',
    title: 'Upadek z ambony, uraz głowy lub kręgosłupa',
    tile: 'Upadek z ambony',
    art: 'head',
    when: [
      'upadek z ambony, drabiny lub zwyżki, przygniecenie drzewem',
      'ból szyi lub pleców, mrowienie albo brak czucia w rękach lub nogach',
      'po uderzeniu w głowę: ból głowy, wymioty, splątanie, senność',
    ],
    steps: [
      {
        t: 'Czy ranny jest przytomny?',
        ask: { q: 'Czy ranny jest przytomny i odpowiada?', yes: 'przytomny', no: 'nieprzytomny' },
      },
      {
        id: 'przytomny',
        t: 'Poproś, żeby się nie ruszał',
        d: 'Niech sam trzyma głowę i szyję w wygodnej, stabilnej pozycji. Nie zmuszaj go do żadnej pozycji, nie sadzaj i nie podnoś.',
        art: 'head',
      },
      {
        t: 'Nie przenoś go, chyba że grozi mu niebezpieczeństwo',
        d: 'Na ambonie lub pod nią zostaw go do przyjazdu ratowników i straży, mają nosze i sprzęt. Chroń przed zimnem, podkładając coś pod spód, jeśli da się to zrobić bez ruszania.',
        art: 'cold',
      },
      {
        t: 'Obserwuj przytomność i oddech',
        d: 'Gdy zacznie wymiotować, z pomocą innych obróćcie go na bok razem, „jak kłodę”, z głową w osi ciała.',
        art: 'breathing',
        last: true,
      },
      {
        id: 'nieprzytomny',
        t: 'Unieruchom głowę dłońmi',
        d: 'Uklęknij za głową rannego leżącego na plecach i obejmij ją dłońmi po bokach, trzymając w osi ciała. Jeśli trzeba udrożnić drogi oddechowe, wysuń żuchwę palcami do przodu, bez odchylania głowy.',
        art: 'head',
      },
      {
        t: 'Sprawdź oddech przez 10 sekund',
        d: 'Gdy leży na brzuchu i trzeba go obrócić, róbcie to w kilka osób, całe ciało naraz, z głową w osi.',
        art: 'breathing',
        ask: { q: 'Czy oddycha prawidłowo?', yes: 'trzymaj', no: 'card:rko' },
      },
      {
        id: 'trzymaj',
        t: 'Trzymaj głowę i sprawdzaj oddech co minutę',
        d: 'Zmieniajcie się przy głowie. Okryjcie rannego.',
        art: 'head',
      },
    ],
    extra: [
      {
        h: 'Wstrząśnienie mózgu',
        items: [
          'Gdy po uderzeniu w głowę pojawia się ból głowy, zawroty, nudności, wymioty, zaburzenia widzenia, senność albo splątanie, polowanie dla niego się kończy.',
          'Nie może sam prowadzić samochodu. Musi go obejrzeć lekarz.',
        ],
      },
    ],
    dont: [
      'Nie podnoś, nie sadzaj i nie prowadź rannego po upadku z wysokości.',
      'Nie zdejmuj go z ambony na siłę, jeśli nic mu tam nie grozi.',
    ],
    src: ['ercFa'],
  },
  {
    slug: 'zlamanie',
    title: 'Złamanie lub zwichnięcie',
    art: 'splint',
    when: ['silny ból, obrzęk, kończyna wygięta nienaturalnie', 'nie może ruszać kończyną ani na niej stanąć', 'w ranie widać kość (złamanie otwarte)'],
    steps: [
      {
        t: 'Najpierw zatamuj krwotok',
        d: 'Przy złamaniu otwartym uciskaj obok kości, nie na nią. Przy silnym krwotoku przejdź do karty „Silny krwotok”.',
        art: 'press',
      },
      {
        t: 'Nie prostuj kończyny',
        d: 'Zostaw ją w pozycji, w jakiej ją zastałeś. Ranę przykryj czystym opatrunkiem, nie wpychaj kości.',
        art: 'splint',
      },
      {
        t: 'Unieruchom kończynę',
        d: 'Podeprzyj ją zwiniętą kurtką lub plecakiem. Szynę z kija albo deski przywiąż tak, żeby obejmowała staw powyżej i poniżej złamania. Rękę możesz podwiesić na chuście.',
        art: 'splint',
      },
      {
        t: 'Sprawdź palce poniżej złamania',
        d: 'Czy są ciepłe, różowe i ranny je czuje. Gdy bandaż uciska za mocno, poluzuj go.',
        art: 'splint',
      },
      {
        t: 'Przy złamaniu uda lub miednicy dzwoń 112 i nie ruszaj rannego',
        d: 'Te złamania krwawią do środka. Połóż go, okryj i chroń przed zimnem.',
        art: 'cold',
      },
    ],
    dont: ['Nie nastawiaj i nie prostuj złamań ani zwichnięć.', 'Nie każ iść komuś ze złamaną nogą.'],
    src: ['erc21', 'ercFa'],
  },
  {
    slug: 'wychlodzenie',
    title: 'Wychłodzenie (hipotermia)',
    tile: 'Wychłodzenie',
    art: 'cold',
    when: [
      'silne dreszcze, zimna skóra, niezdarność, bełkotliwa mowa',
      'senność, splątanie, apatia',
      'brak dreszczy u kogoś bardzo zmarzniętego to zły znak',
      'szczególnie po wielu godzinach na stanowisku, po zmoczeniu albo wpadnięciu do wody',
    ],
    steps: [
      {
        t: 'Osłoń go od wiatru',
        d: 'Przenieś w osłonięte miejsce: do samochodu, za ścianę lasu, za płachtę.',
        art: 'cold',
      },
      {
        t: 'Odizoluj od ziemi',
        d: 'Podłóż karimatę, plecak, kurtki albo gałęzie. Ziemia wyciąga ciepło szybciej niż powietrze.',
        art: 'cold',
      },
      {
        t: 'Zdejmij mokre ubrania, załóż suche',
        d: 'Delikatnie. Okryj kocem, śpiworem albo folią NRC, załóż czapkę. Ogrzewacze chemiczne możesz przyłożyć na tułów, przez ubranie.',
        art: 'cold',
      },
      {
        t: 'Czy jest przytomny i może połykać?',
        ask: { q: 'Czy jest przytomny i może sam połykać?', yes: 'napoj', no: 'nieprzytomny' },
      },
      {
        id: 'napoj',
        t: 'Daj ciepły, słodki napój',
        d: 'Herbata z cukrem, kakao. Bez alkoholu. Gdy jest splątany albo nie może iść, dzwoń 112.',
        art: 'sugar',
      },
      {
        t: 'Ruszaj go delikatnie, najlepiej na leżąco',
        d: 'Nie każ mu chodzić ani się rozgrzewać ćwiczeniami, gdy jest mocno wychłodzony.',
        art: 'cold',
        last: true,
      },
      {
        id: 'nieprzytomny',
        t: 'Dzwoń 112 i sprawdzaj oddech do 1 minuty',
        d: 'U wychłodzonego oddech bywa bardzo wolny i płytki, więc patrz dłużej niż zwykle.',
        art: 'breathing',
        ask: { q: 'Czy oddycha?', yes: 'lezy', no: 'card:rko' },
      },
      {
        id: 'lezy',
        t: 'Połóż go poziomo i chroń przed zimnem',
        d: 'Nic nie podawaj do ust. Przenoś bardzo delikatnie. Sprawdzaj oddech.',
        art: 'cold',
      },
    ],
    dont: [
      'Nie podawaj alkoholu.',
      'Nie nacieraj skóry śniegiem ani nie masuj.',
      'Nie wkładaj wychłodzonego do gorącej wody.',
    ],
    src: ['ercFa', 'ercSc', 'wmsHypo'],
  },
  {
    slug: 'udar',
    title: 'Udar mózgu',
    art: 'face',
    when: [
      'twarz: opadnięty kącik ust, nierówny uśmiech',
      'ręka: nie utrzyma obu rąk uniesionych, jedna opada',
      'mowa: bełkotliwa, niezrozumiała, nie rozumie, co mówisz',
      'nagłe zaburzenia widzenia, zawroty głowy, bardzo silny ból głowy',
    ],
    steps: [
      {
        t: 'Sprawdź twarz, ręce i mowę',
        d: 'Poproś, żeby się uśmiechnął, uniósł obie ręce i powtórzył proste zdanie.',
        art: 'face',
      },
      {
        t: 'Zapisz godzinę pierwszych objawów',
        d: 'Od niej zależy leczenie w szpitalu. Przycisk poniżej zapisze godzinę.',
        tool: 'time',
        art: 'face',
      },
      {
        t: 'Dzwoń 112 od razu',
        d: 'Powiedz, że podejrzewasz udar i od kiedy są objawy.',
        art: 'phone',
      },
      {
        t: 'Połóż go lub posadź wygodnie i zostań z nim',
        d: 'Gdy straci przytomność, a oddycha, ułóż go w pozycji bocznej. Gdy przestanie oddychać, zacznij RKO.',
        art: 'recovery',
      },
    ],
    dont: ['Nie podawaj nic do picia, jedzenia ani leków (także aspiryny).', 'Nie czekaj, aż „przejdzie”.'],
    src: ['ercFa', 'prr'],
  },
  {
    slug: 'anafilaksja',
    title: 'Ciężka reakcja alergiczna (np. po użądleniu)',
    art: 'pen',
    when: [
      'duszność, świszczący oddech, chrypka, obrzęk języka lub gardła',
      'pokrzywka, zaczerwienienie, zimna i wilgotna skóra, osłabienie',
      'ból brzucha, wymioty',
      'zaraz po użądleniu osy lub pszczoły albo po zjedzeniu czegoś, na co jest uczulony',
    ],
    steps: [
      { t: 'Dzwoń 112', d: 'Powiedz, że podejrzewasz wstrząs anafilaktyczny.', art: 'phone' },
      {
        t: 'Niech siedzi albo leży',
        d: 'Nie pozwól mu wstawać ani chodzić. Gdy ma duszność, zwykle łatwiej mu na siedząco.',
        art: 'breathing',
      },
      {
        t: 'Podaj adrenalinę z autostrzykawki w udo',
        d: 'W zewnętrzną część uda, może być przez spodnie. Najlepiej jego własną: wielu uczulonych ma ją przy sobie. Dawka dla dorosłego 0,5 mg, dla dziecka 6–12 lat 0,3 mg.',
        art: 'pen',
        tool: 'time',
      },
      {
        t: 'Po 5 minutach bez poprawy podaj drugą dawkę',
        d: 'Jeśli jest druga autostrzykawka. Gdy przestanie oddychać prawidłowo, zacznij RKO.',
        art: 'pen',
      },
    ],
    dont: ['Nie każ mu wstawać ani iść.', 'Nie czekaj z adrenaliną, aż objawy się nasilą.'],
    src: ['ercFa', 'prr'],
  },
  {
    slug: 'ukaszenie',
    title: 'Ukąszenie żmii, pogryzienie przez psa lub zwierzę',
    art: 'snake',
    when: ['dwa małe ślady po zębach, ból i obrzęk narastający w miejscu ukąszenia (żmija)', 'rana szarpana lub kąsana od psa, lisa, dzika albo innego zwierzęcia'],
    steps: [
      {
        t: 'Czy to ukąszenie żmii?',
        ask: { q: 'Czy ukąsiła go żmija?', yes: 'zmija', no: 'zwierze' },
      },
      { id: 'zmija', t: 'Dzwoń 112 i uspokój go', d: 'Niech leży lub siedzi spokojnie: ruch przyspiesza rozchodzenie się jadu.', art: 'phone' },
      {
        t: 'Unieruchom ukąszoną kończynę',
        d: 'Jak przy złamaniu. Zdejmij obrączki, zegarek, ciasne ubranie, zanim pojawi się obrzęk.',
        art: 'snake',
      },
      {
        t: 'Czekaj na ratowników albo jedźcie do szpitala',
        d: 'Tak, jak zdecyduje dyspozytor. Ranny nie może iść sam ani prowadzić.',
        art: 'snake',
        last: true,
      },
      {
        id: 'zwierze',
        t: 'Zatamuj krwotok',
        d: 'Przy silnym krwawieniu przejdź do karty „Silny krwotok”.',
        art: 'press',
      },
      {
        t: 'Myj ranę wodą z mydłem przez 15 minut',
        d: 'Dokładnie, dużą ilością wody. Potem przykryj ją czystym opatrunkiem.',
        art: 'pack',
      },
      {
        t: 'Jeszcze dziś do lekarza',
        d: 'Lekarz zdecyduje o szczepieniu przeciw wściekliźnie i tężcowi. Zapamiętaj, jakie to było zwierzę i czyje.',
        art: 'phone',
      },
    ],
    dont: [
      'Przy ukąszeniu żmii: nie zakładaj opaski uciskowej ani opatrunku uciskowego, nie przykładaj lodu ani ciepła.',
      'Nie nacinaj rany i nie wysysaj jadu.',
    ],
    src: ['ercFa', 'who'],
  },
  {
    slug: 'hipoglikemia',
    title: 'Niski cukier (cukrzyk)',
    art: 'sugar',
    when: ['cukrzyk albo ktoś, kto długo nic nie jadł', 'nagle zachowuje się dziwnie, jest splątany, drażliwy, poci się, drży'],
    steps: [
      {
        t: 'Czy jest przytomny i może połykać?',
        ask: { q: 'Czy jest przytomny i może sam połykać?', yes: 'cukier', no: 'nieprzytomny' },
      },
      {
        id: 'cukier',
        t: 'Podaj 15–20 g cukru',
        d: 'Tabletki z glukozą, a gdy ich nie ma: garść słodkich cukierków albo pół szklanki (50–100 ml) soku lub słodzonego napoju.',
        art: 'sugar',
        tool: 'time',
      },
      {
        t: 'Po 15 minutach bez poprawy podaj cukier jeszcze raz',
        d: 'Gdy ma glukometr, zmierz cukier. Gdy się nie poprawia, dzwoń 112.',
        art: 'sugar',
      },
      {
        t: 'Gdy mu się poprawi, niech coś zje',
        d: 'Kanapkę albo batonik. Nie wraca od razu na stanowisko sam.',
        art: 'sugar',
        last: true,
      },
      {
        id: 'nieprzytomny',
        t: 'Dzwoń 112, nic nie podawaj do ust',
        d: 'Nieprzytomny może się zachłysnąć. Gdy oddycha i nie było urazu, ułóż go w pozycji bocznej. Jeśli ma glukagon, poda go ktoś przeszkolony.',
        art: 'recovery',
      },
    ],
    dont: ['Nie wlewaj nic do ust nieprzytomnemu.'],
    src: ['ercFa'],
  },
  {
    slug: 'odmrozenie',
    title: 'Odmrożenie',
    art: 'frost',
    when: [
      'palce, stopy, nos, uszy lub policzki blade, woskowe, twarde i bez czucia',
      'po ogrzaniu: ból, zaczerwienienie lub sinienie, pęcherze',
    ],
    steps: [
      {
        t: 'Najpierw sprawdź, czy nie jest wychłodzony',
        d: 'Wychłodzenie całego ciała jest groźniejsze niż odmrożone palce. Jeśli tak, zacznij od karty „Wychłodzenie”.',
        art: 'cold',
      },
      {
        t: 'Zdejmij obrączki i ciasne rzeczy',
        d: 'Mokre rękawiczki i skarpety zamień na suche.',
        art: 'frost',
      },
      {
        t: 'Ogrzewaj tylko wtedy, gdy nie zmarznie znowu',
        d: 'Odmrożenie, które się rozmrozi i znów zamarznie, jest gorsze. Jeśli do ciepła jeszcze daleko, tylko osłoń miejsce.',
        art: 'frost',
      },
      {
        t: 'Ogrzej ciepłem ciała albo w ciepłej wodzie',
        d: 'Dłonie pod pachę, stopy na brzuch drugiej osoby. Albo w wodzie 37–39°C, takiej, w której Twoja ręka wytrzyma bez problemu.',
        art: 'frost',
      },
      {
        t: 'Przykryj luźnym, suchym opatrunkiem i jedźcie do lekarza',
        d: 'Między odmrożone palce włóż gazę. Po ogrzaniu ranny nie powinien chodzić na odmrożonych stopach.',
        art: 'pack',
      },
    ],
    dont: [
      'Nie nacieraj śniegiem i nie masuj.',
      'Nie ogrzewaj przy ognisku, piecyku ani suszarką: odmrożona skóra nie czuje oparzenia.',
      'Nie przekłuwaj pęcherzy.',
    ],
    src: ['wmsFrost'],
  },
  {
    slug: 'woda-lod',
    title: 'Załamanie lodu, wyciągnięcie z wody',
    art: 'ice',
    when: ['ktoś wpadł do wody lub pod lód, na przykład przy polowaniu na kaczki albo za psem'],
    steps: [
      {
        t: 'Nie wchodź sam do wody ani na lód',
        d: 'Wołaj o pomoc i niech ktoś dzwoni 112. Nie spuszczaj tonącego z oczu.',
        art: 'ice',
      },
      {
        t: 'Podaj coś z brzegu',
        d: 'Długą gałąź, dryl, linkę, smycz, pas albo coś, co pływa. Na lodzie podchodź tylko na leżąco, rozkładając ciężar, i podawaj przedmiot z daleka.',
        art: 'ice',
      },
      {
        t: 'Czy po wyciągnięciu oddycha?',
        ask: { q: 'Czy po wyciągnięciu z wody oddycha prawidłowo?', yes: 'oddycha', no: 'card:rko' },
      },
      {
        id: 'oddycha',
        t: 'Ułóż go w pozycji bocznej i chroń przed zimnem',
        d: 'Zdejmij mokre ubrania, okryj. Dalej postępuj jak przy wychłodzeniu. Nawet gdy czuje się dobrze, musi go obejrzeć lekarz.',
        art: 'recovery',
      },
    ],
    dont: ['Nie wchodź do wody ani na lód bez przeszkolenia i sprzętu.', 'Nie skacz do wody za psem.'],
    src: ['ercFa', 'prr'],
  },
];

/** The flow behind "Nie wiesz, od czego zacząć?": the ERC order (bleeding, response, breathing). */
export const TRIAGE: AidStep[] = [
  {
    t: 'Czy widzisz silny krwotok?',
    d: 'Krew wypływa strumieniem, pulsuje albo szybko przesiąka przez ubranie.',
    art: 'press',
    ask: { q: 'Czy widzisz silny krwotok?', yes: 'card:krwotok', no: 'reaguje' },
  },
  {
    id: 'reaguje',
    t: 'Czy ranny reaguje?',
    d: 'Potrząśnij delikatnie za ramiona i zapytaj głośno: „Czy wszystko w porządku?”.',
    art: 'head',
    ask: { q: 'Czy reaguje na głos lub dotyk?', yes: 'wybierz', no: 'oddech' },
  },
  {
    id: 'oddech',
    t: 'Czy oddycha prawidłowo?',
    d: 'Udrożnij drogi oddechowe i patrz, słuchaj, wyczuwaj przez 10 sekund.',
    art: 'breathing',
    ask: { q: 'Czy oddycha prawidłowo?', yes: 'card:nieprzytomny-oddycha', no: 'card:rko' },
  },
  {
    id: 'wybierz',
    t: 'Zapytaj, co się stało i co go boli',
    d: 'Obejrzyj całe ciało: głowę, szyję, tułów, ręce i nogi. Potem wybierz kartę z listy poniżej.',
    art: 'head',
  },
];

/** What a hunter (or the club's kit) should carry, from ERC 2025 "First aid kits". */
export const KIT: { h: string; items: string[] } = {
  h: 'Co mieć w apteczce na polowaniu',
  items: [
    'opaska uciskowa (fabryczna, z krętlikiem) i opatrunek hemostatyczny: ERC zaleca je tam, gdzie łatwo o groźny krwotok, jak przy pracy w lesie',
    'opatrunki różnej wielkości, bandaże, chusta trójkątna, plaster, agrafki',
    'rękawiczki jednorazowe i maseczka lub osłona do oddechów ratowniczych',
    'nożyczki ratownicze, które przetną ubranie',
    'folia NRC (koc ratunkowy), latarka i gwizdek',
    'coś do unieruchomienia (szyna lub zwykły kij i bandaż)',
    'tabletki z glukozą lub słodycze, pisak do zapisania godziny na opasce',
  ],
};

/**
 * Who checked the content, and when. While `date` is null the app says "Wersja robocza" on every
 * card and the website keeps the first-aid pages out of search engines.
 *
 * A medical reviewer checked all cards in November 2026 and asked for no changes (Maciej,
 * 2026-11-18). `by` is for the reviewer's name and title, once they agree to be named.
 * After any change to the steps of a card, set `date` back to null until it is checked again.
 */
export const REVIEW: { by: string | null; date: string | null } = { by: null, date: 'listopad 2026' };

/** The sentence shown under the cards' sources; null while the content is a draft. */
export function reviewLine(r: { by: string | null; date: string | null } = REVIEW): string | null {
  if (!r.date) return null;
  return r.by ? `Treść sprawdził(a): ${r.by}, ${r.date}.` : `Przegląd medyczny treści: ${r.date}.`;
}

/**
 * Steps a medical reviewer should look at with extra care: they do not come straight from ERC 2025
 * First Aid (which no longer covers fractures, frostbite or bites), or they go a little further
 * than its words. Listed in the review document, not in the app.
 */
export const REVIEW_NOTES: { card: string; note: string }[] = [
  { card: 'krwotok', note: 'Uniesienie nóg przy wstrząsie: ERC 2025 Tabela 3 („passive leg raising as a temporising measure”); dodano warunek „gdy nogi nie są ranne”.' },
  { card: 'postrzal-tulowia', note: 'Wbite przedmioty i rana brzucha z narządami: ogólnie przyjęte zasady, nie ma ich w ERC 2025.' },
  { card: 'postrzal-tulowia', note: 'Szyja: „nie uciskaj obu stron szyi naraz”: dopisek bezpieczeństwa spoza ERC.' },
  { card: 'bol-w-klatce', note: 'Aspiryna 150–500 mg do rozgryzienia (ERC 2025). Dodano przeciwwskazanie „ból po urazie” spoza ERC (ERC wymienia tylko uczulenie).' },
  { card: 'zlamanie', note: 'ERC 2025 nie obejmuje już złamań; „nie prostuj, unieruchom” wg ERC 2021. Szyna przez dwa stawy i kontrola krążenia: ogólnie przyjęte zasady.' },
  { card: 'wychlodzenie', note: 'Ciepły słodki napój u przytomnego i ostrożne przenoszenie w poziomie: WMS 2019. Ogrzewacze na tułów przez ubranie: WMS 2019.' },
  { card: 'udar', note: '„Nie podawaj aspiryny”: zasada spoza ERC 2025 (udar może być krwotoczny).' },
  { card: 'ukaszenie', note: 'Mycie rany po pogryzieniu 15 min wodą z mydłem i lekarz w sprawie wścieklizny: WHO.' },
  { card: 'odmrozenie', note: 'Cała karta wg WMS 2024 (ERC 2025 nie obejmuje odmrożeń).' },
  { card: 'woda-lod', note: 'Podchodzenie na lód na leżąco: ogólna zasada ratownictwa lodowego, spoza ERC.' },
];

/** Practice questions for "Wiedza › Pierwsza pomoc". `a` is the index of the right answer. */
export interface AidQuestion {
  q: string;
  opts: string[];
  a: number;
  why: string;
  card: string;
}

export const QUIZ: AidQuestion[] = [
  {
    q: 'Na polowaniu ktoś został postrzelony. Co robisz najpierw?',
    opts: ['Biegnę do rannego z bronią w ręku', 'Wstrzymuję polowanie i rozładowuję broń, potem pomagam', 'Czekam na prowadzącego'],
    a: 1,
    why: 'Najpierw bezpieczeństwo: nikt nie strzela, broń rozładowana. Dopiero potem pomoc rannemu i 112.',
    card: 'krwotok',
  },
  {
    q: 'Krew z rany uda wypływa strumieniem i nie ustaje mimo mocnego ucisku. Co dalej?',
    opts: ['Opaska uciskowa 5–7 cm powyżej rany', 'Opaska tuż na kolanie', 'Uniesienie nogi i czekanie'],
    a: 0,
    why: 'ERC 2025: opaskę zakłada się jak najszybciej, 5–7 cm powyżej rany, nie na stawie.',
    card: 'krwotok',
  },
  {
    q: 'Kto i kiedy może zdjąć założoną opaskę uciskową?',
    opts: ['Ja, po 2 godzinach', 'Ranny, gdy przestanie boleć', 'Tylko lekarz lub ratownik'],
    a: 2,
    why: 'Opaski się nie luzuje. Zapisz godzinę założenia i przekaż ją ratownikom.',
    card: 'krwotok',
  },
  {
    q: 'Z rany na klatce piersiowej słychać syk powietrza. Co z raną?',
    opts: ['Szczelnie zakleić folią', 'Zostawić otwartą, krwawienie uciskać obok', 'Zatkać palcem'],
    a: 1,
    why: 'ERC 2025: ranę klatki piersiowej zostawia się otwartą; zaklejenie może utrudnić oddychanie.',
    card: 'postrzal-tulowia',
  },
  {
    q: 'W jakim tempie uciska się klatkę piersiową przy RKO?',
    opts: ['60–80 razy na minutę', '100–120 razy na minutę', '150 razy na minutę'],
    a: 1,
    why: 'ERC 2025: 100–120 uciśnięć na minutę, na głębokość 5–6 cm.',
    card: 'rko',
  },
  {
    q: 'Myśliwy spadł z ambony, jest przytomny i boli go szyja. Co robisz?',
    opts: ['Sadzam go i podaję wodę', 'Proszę, żeby się nie ruszał, i trzymam głowę stabilnie', 'Prowadzę go do samochodu'],
    a: 1,
    why: 'Po upadku z wysokości podejrzewa się uraz kręgosłupa: ranny się nie rusza, nikt go nie podnosi.',
    card: 'upadek',
  },
  {
    q: 'Naganiacz po kilku godzinach w mokrym ubraniu silnie drży i bełkocze. Czego NIE robisz?',
    opts: ['Daję mu łyk wódki na rozgrzewkę', 'Osłaniam od wiatru i izoluję od ziemi', 'Zamieniam mokre ubranie na suche'],
    a: 0,
    why: 'Alkohol przyspiesza utratę ciepła. Pomaga osłona od wiatru, izolacja od ziemi, suche ubranie i ciepły słodki napój.',
    card: 'wychlodzenie',
  },
  {
    q: 'Kolegę ukąsiła żmija w łydkę. Co jest właściwe?',
    opts: ['Opaska uciskowa powyżej ukąszenia', 'Nacięcie i wyssanie jadu', 'Spokój, unieruchomienie nogi i 112'],
    a: 2,
    why: 'ERC 2025: przy ukąszeniu żmii nie zakłada się opaski ani opatrunku uciskowego, nie nacina się rany.',
    card: 'ukaszenie',
  },
  {
    q: 'Starszy myśliwy czuje gniecenie w klatce piersiowej promieniujące do ręki. Nie jest uczulony na aspirynę. Co mu podać?',
    opts: ['Aspirynę 150–500 mg do rozgryzienia', 'Gorącą kawę', 'Nic, niech się przejdzie'],
    a: 0,
    why: 'ERC 2025: przy bólu w klatce piersiowej pochodzenia sercowego pomóż przyjąć aspirynę do żucia, wezwij 112.',
    card: 'bol-w-klatce',
  },
  {
    q: 'Cukrzyk jest splątany, ale przytomny i połyka. Co podać?',
    opts: ['15–20 g cukru: glukozę, cukierki lub słodki sok', 'Insulinę', 'Nic, tylko obserwować'],
    a: 0,
    why: 'ERC 2025: 15–20 g glukozy doustnie, po 15 minutach bez poprawy jeszcze raz.',
    card: 'hipoglikemia',
  },
];

/** Pages of the section that are not cards (#/wypadek/<page>): no card may take these slugs. */
export const AID_PAGES = ['start', 'sprawdzian', 'o-instrukcjach'] as const;

export const cardBySlug = (slug: string | null | undefined): AidCard | undefined => CARDS.find((c) => c.slug === slug);

/** Index of the step a "Tak/Nie" target points at in a list of steps, or -1. */
export function stepIndex(steps: AidStep[], id: string): number {
  return steps.findIndex((s) => s.id === id);
}

/**
 * Where to go from step `i` after an answer (or "Dalej"): another step, another card, or the end.
 * `answer` is true/false for a question, undefined for "Dalej".
 */
export function nextStep(steps: AidStep[], i: number, answer?: boolean): { step: number } | { card: string } | { end: true } {
  const s = steps[i];
  if (s?.ask && answer !== undefined) {
    const go = answer ? s.ask.yes : s.ask.no;
    if (go.startsWith('card:')) return { card: go.slice(5) };
    const j = stepIndex(steps, go);
    return j >= 0 ? { step: j } : { end: true };
  }
  if (!s || s.last || i + 1 >= steps.length) return { end: true };
  return { step: i + 1 };
}
