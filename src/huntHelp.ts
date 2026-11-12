// Guides for the group hunt (polowanie zbiorowe), one per role: the leader, a hunter, a beater.
// Written in Polish, the language of the clubs using the app; in English the page says so.
//
// [[Label]] marks a button or label exactly as it reads in the app. It is shown as a button-like
// chip, and huntHelp.test.ts checks that every such label still exists in the app's code, so the
// guide notices when a button is renamed.

import { getLang } from './i18n';
import { roleIcon } from './huntIcons';
import { ic } from './icons';
import { GUIDE_ROLES, GUIDE_SLUG, type GuideRole } from './nav';

export type GuideSection = {
  id: string;
  title: string;
  /** Where in the app, as a path of labels: tab › box › button. */
  where?: string[];
  text?: string[];
  steps?: string[];
  tips?: string[];
};

export type Guide = { role: GuideRole; title: string; short: string; intro: string; sections: GuideSection[] };

// ---------------------------------------------------------------- shared pieces

const SIGN_UP = (role: 'Myśliwy' | 'Naganiacz'): GuideSection => ({
  id: 'zapis',
  title: 'Zapisz się na polowanie',
  steps: [
    'Otwórz link albo zeskanuj kod QR od prowadzącego. Link zaproszenia nie wymaga hasła koła; zwykły link dla członków koła wymaga hasła, które zna prowadzący.',
    `W formularzu wybierz rolę [[${role}]].`,
    'Wpisz imię i nazwisko: tak zobaczą Cię inni uczestnicy.',
    'Telefon jest opcjonalny. Podaj go, jeśli prowadzący albo transport tusz ma mieć jak do Ciebie zadzwonić; widzą go tylko potwierdzeni uczestnicy, przez 7 dni po polowaniu.',
    'Dotknij [[Zapisz się]]. Do czasu potwierdzenia przez prowadzącego zobaczysz napis [[czeka na potwierdzenie]], a mapa i pokot będą ukryte.',
  ],
  tips: [
    'Polowanie trafia na listę [[Twoje polowania]] na tym urządzeniu i w tej przeglądarce. W aplikacji na Androida i w przeglądarce telefonu to dwa osobne konta, więc zapisz się tam, gdzie będziesz korzystać z polowania.',
    'Jeśli nie możesz przyjechać, wejdź w zakładkę [[Uczestnicy]] i dotknij [[Wypisz się]].',
  ],
});

const BEFORE = (beater: boolean): GuideSection => ({
  id: 'przed',
  title: 'Przed polowaniem',
  where: ['Informacje'],
  text: [
    'W zakładce [[Informacje]] są data, godziny, miejsce zbiórki, obwód i uwagi prowadzącego. Przycisk [[Nawiguj na zbiórkę]] otwiera nawigację w mapach telefonu.',
    `W zakładce [[Teren]] zobaczysz mapę z miotami${beater ? '' : ' oraz zwyżkami i ambonami koła'}. Jeśli w lesie bywa słaby zasięg, dotknij pod mapą [[Zapisz mapę offline]] jeszcze w domu, na Wi-Fi.`,
    'Swój numer telefonu zmienisz w zakładce [[Uczestnicy]] przyciskiem [[Zmień]] albo [[Dodaj numer]].',
  ],
});

const SHARE = (beater: boolean): GuideSection => ({
  id: 'lokalizacja',
  title: 'Udostępnij swoją lokalizację',
  where: ['Teren', 'Udostępniaj moją lokalizację'],
  text: [
    `Gdy prowadzący rozpocznie polowanie, w zakładce [[Teren]] pojawi się przycisk [[Udostępniaj moją lokalizację]]. Dzięki niemu prowadzący i inni uczestnicy widzą Cię na mapie${beater ? ', co w naganie jest najważniejsze dla bezpieczeństwa' : ''}. Twoje położenie widzą tylko potwierdzeni uczestnicy i tylko w czasie polowania; po 7 dniach jest usuwane.`,
  ],
  steps: [
    'Dotknij [[Udostępniaj moją lokalizację]] i zezwól na dostęp do lokalizacji.',
    'W aplikacji na Androida możesz zgasić ekran i schować telefon: położenie jest wysyłane w tle, dopóki widać powiadomienie aplikacji.',
    'W przeglądarce ekran musi zostać włączony. Dotknij [[Kieszeń]] (tryb kieszeni): ekran robi się czarny, nie reaguje na przypadkowe dotknięcia, a telefon dalej wysyła położenie. Aby wrócić, przesuń palcem po ekranie.',
    'Udostępnianie wyłączysz przyciskiem [[Zatrzymaj]].',
  ],
  tips: ['Położenie może mieć kilka minut i kilkadziesiąt metrów błędu. Aplikacja nie zastępuje odprawy, sygnałów ani zasad bezpieczeństwa.'],
});

const FIELD = (beater: boolean): GuideSection => ({
  id: 'teren',
  title: 'Tryb terenowy na czas miotu',
  where: ['Teren', 'Tryb terenowy'],
  text: [
    'Gdy polowanie trwa, dotknij [[Tryb terenowy]]. Mapa wypełnia ekran, a przyciski są duże, żeby dało się ich używać w rękawiczkach.',
    `Na górze widać nazwę miotu i jego czas, ${beater ? 'czy masz wyznaczoną trasę' : 'Twoje stanowisko'}, numer miotu (np. 2/5) i czy Twoja lokalizacja jest wysyłana. Na dole są przyciski [[Zwierzyna]]${beater ? '' : ', [[Strzał]]'} i [[Wiadomości]], a pod nimi listy [[Uczestnicy]], [[Mioty]] i [[Pokot]], które wysuwają się na mapę.`,
    'Z trybu terenowego wychodzisz strzałką w lewym górnym rogu (albo przyciskiem Wstecz w telefonie).',
  ],
  tips: beater
    ? []
    : ['Jeśli stanowiska mają numery, pod mapą widać, kto stoi na sąsiednich numerach. Przydaje się przy ustalaniu kątów strzału.'],
});

const SIGHTING: GuideSection = {
  id: 'zwierzyna',
  title: 'Zgłoś zwierzynę',
  where: ['Teren', 'Zwierzyna'],
  text: ['Każdy uczestnik może zgłosić zwierzynę, którą widzi. Zgłoszenie od razu pojawia się na mapie wszystkich jako strzałka pokazująca, dokąd poszła.'],
  steps: [
    'Dotknij [[Zwierzyna]].',
    'Wybierz gatunek: [[Jelenie]], [[Dziki]], [[Sarny]] albo [[Drapieżniki]], i ile sztuk.',
    'Skieruj telefon tam, dokąd poszła zwierzyna (tyłem telefonu albo górną krawędzią), i dotknij [[Tam poszły]]. Bez kompasu wybierz kierunek przyciskiem; góra to północ.',
    'Pomyłkę cofniesz przez kilka sekund przyciskiem [[Cofnij]].',
  ],
  tips: [
    'Myśliwi, w których stronę idzie zwierzyna (do 500 m), dostają alarm z wibracją. Zgłoszenie jest wyraźne przez 5 minut, potem blednie do końca miotu.',
    'Jeśli kompas pokazuje bzdury, zatocz telefonem w powietrzu ósemkę.',
  ],
};

const MESSAGES_IN: GuideSection = {
  id: 'wiadomosci',
  title: 'Wiadomości od prowadzącego',
  where: ['Teren', 'Wiadomości'],
  text: [
    'Prowadzący może wysłać wiadomość do wszystkich, do myśliwych, do naganiaczy albo do Ciebie. Gdy aplikacja jest otwarta (także w trybie kieszeni), wiadomość wyskakuje na ekranie, a telefon wibruje.',
    'Dotknij [[Przyjąłem]], żeby prowadzący wiedział, że ją przeczytałeś. [[Później]] zamyka okno; wiadomość czeka wtedy w [[Wiadomości]].',
  ],
  tips: ['Wiadomość nie dotrze do telefonu z zamkniętą aplikacją. Nie zastępuje sygnałów rogiem ani radia.'],
};

const CARRIER: GuideSection = {
  id: 'transport',
  title: 'Jeśli zbierasz tusze',
  where: ['Teren', 'Tusze do zabrania'],
  text: [
    'Prowadzący może wyznaczyć Cię do transportu dzików albo zwierzyny płowej (jeleń, daniel, muflon, sarna). Zobaczysz wtedy napis [[Zbierasz tusze:]] i listę [[Tusze do zabrania]] tylko ze swoją zwierzyną.',
    'Tusze pojawiają się po zakończeniu miotu, najbliższe na górze, z odległością i kierunkiem. Telefon wibruje, gdy na liście pojawi się nowa.',
  ],
  steps: [
    '[[Prowadź mnie]] pokazuje strzałkę i odległość do tuszy; [[Nawiguj]] otwiera nawigację w mapach telefonu; [[Mapa]] pokazuje tuszę na mapie polowania.',
    'Po załadowaniu dotknij [[Zabrane]]. Pomyłkę cofniesz przyciskiem [[Cofnij]].',
  ],
};

// ---------------------------------------------------------------- leader

const LEADER: Guide = {
  role: 'leader',
  title: 'Instrukcja prowadzącego',
  short: 'Prowadzący',
  intro:
    'Prowadzący tworzy polowanie, zaprasza i potwierdza uczestników, przygotowuje mioty, trasy naganiaczy i transport tusz, a w dniu polowania rozpoczyna i kończy mioty, wysyła wiadomości i zatwierdza pokot. Zastępca prowadzącego ma te same prawa.',
  sections: [
    {
      id: 'start',
      title: 'Zanim zaczniesz',
      text: [
        'Polowanie możesz przygotować na komputerze, a prowadzić z telefonu (zob. „Prowadzenie z telefonu i zastępcy”). Najlepiej prowadzić z aplikacji na Androida: wysyła położenie także przy zgaszonym ekranie.',
        'Do utworzenia polowania potrzebne jest hasło koła. Aplikacja zapamiętuje Twoje polowania na tym urządzeniu i w tej przeglądarce.',
      ],
    },
    {
      id: 'nowe',
      title: 'Utwórz polowanie',
      where: ['Polowanie', '+ Nowe polowanie'],
      steps: [
        'Dotknij [[+ Nowe polowanie]].',
        'Wpisz [[Nazwa polowania]], [[Data]], godziny ([[Początek]], [[Koniec]]) i [[Miejsce zbiórki]].',
        'W polu [[Obwód łowiecki]] wpisz numer obwodu, nazwę koła albo nadleśnictwa, albo dotknij [[Obwód, w którym jestem]]. Mapa polowania pokaże wtedy granice obwodu, a uczestnicy mogą zapisać mapę offline.',
        'W [[Informacje dla uczestników]] wpisz to, co zwykle mówisz na odprawie (np. kamizelki obowiązkowe, odprawa o 7:45).',
        'Wpisz swoje imię i nazwisko oraz [[Hasło koła]] i dotknij [[Utwórz polowanie]].',
      ],
      tips: ['Szczegóły zmienisz później w zakładce [[Informacje]] przyciskiem [[Edytuj szczegóły]].'],
    },
    {
      id: 'zbiorka',
      title: 'Zaznacz zbiórkę na mapie',
      where: ['Informacje', 'Wskaż zbiórkę na mapie'],
      steps: [
        'W zakładce [[Informacje]] dotknij [[Wskaż zbiórkę na mapie]].',
        'Dotknij mapy w miejscu zbiórki. Uczestnicy dostaną przycisk [[Nawiguj na zbiórkę]], który otwiera nawigację w ich telefonie.',
      ],
      tips: ['Zbiórkę przesuniesz przyciskiem [[Przesuń zbiórkę]], a usuniesz przyciskiem [[Usuń z mapy]].'],
    },
    {
      id: 'zaproszenia',
      title: 'Zaproś uczestników',
      where: ['Uczestnicy', 'Zaproś uczestników'],
      steps: [
        'W zakładce [[Uczestnicy]] dotknij [[Utwórz link zaproszenia]].',
        'Wyślij link przyciskiem [[Udostępnij link]] (np. na grupę koła) albo [[Kopiuj link]]. Na zbiórce pokaż [[Kod QR]]: goście skanują go aparatem telefonu.',
        'Link zaproszenia działa bez hasła koła, do końca dnia polowania. Godzinę wygaśnięcia widać pod linkiem.',
      ],
      tips: [
        '[[Nowy link]] i [[Unieważnij link]] wyłączają poprzedni link; osoby już zapisane zostają.',
        'Członkowie koła mogą też zapisać się zwykłym linkiem z hasłem koła: [[Link dla członków koła (zapis z hasłem koła)]].',
      ],
    },
    {
      id: 'potwierdzanie',
      title: 'Potwierdź uczestników',
      where: ['Uczestnicy'],
      text: [
        'Każda zapisana osoba czeka na potwierdzenie. Liczba oczekujących świeci się przy zakładce [[Uczestnicy]]. Dopiero po potwierdzeniu uczestnik widzi mapę, zwyżki, telefony innych i pokot.',
      ],
      steps: [
        'Przy osobie dotknij [[Potwierdź]].',
        'Jeśli ktoś zapisał się w złej roli, zmień ją przyciskiem [[→ myśliwy]] albo [[→ naganiacz]].',
        'Osobę, która nie przyjedzie, usuniesz przyciskiem [[Usuń]].',
        'Gdy lista jest kompletna, w zakładce [[Informacje]] dotknij [[Zamknij zapisy]]. Zapisy otworzysz ponownie przyciskiem [[Otwórz zapisy]].',
      ],
    },
    {
      id: 'zwyzki',
      title: 'Zwyżki i ambony',
      where: ['Teren', 'Zwyżki i ambony'],
      text: [
        'Zwyżki i ambony widzą na mapie tylko potwierdzeni uczestnicy polowania. Nie są publikowane w ogólnej mapie aplikacji.',
      ],
      steps: [
        'Jeśli koło ma już zapisane zwyżki, pokażą się same. Jeśli nie, dotknij [[Wczytaj z pliku KMZ/KML]] i wybierz plik z Google Earth albo Moich Map Google.',
        'Wczytane punkty dotyczą tylko tego polowania. [[Zapisz jako zwyżki koła]] zapisze je na stałe, dla wszystkich kolejnych polowań koła.',
        'Przyciskiem [[Edytuj]] dodasz zwyżkę dotknięciem mapy (albo [[Dodaj w mojej lokalizacji]], stojąc pod nią), przesuniesz ją przeciągnięciem, zmienisz nazwę, rodzaj, współrzędne albo oznaczysz jako [[Powalona / uszkodzona]]. Na końcu dotknij [[Zapisz zmiany]].',
      ],
      tips: ['Jeśli na tym urządzeniu zwyżki koła są ukryte, wpisz hasło koła i dotknij [[Pokaż]].'],
    },
    {
      id: 'mioty',
      title: 'Zaplanuj mioty',
      where: ['Teren', 'Mioty', '+ Miot'],
      steps: [
        'W zakładce [[Teren]] dotknij [[+ Miot]].',
        'Wpisz nazwę i planowane godziny ([[Początek]], [[Koniec]]).',
        'Dotykaj mapy w narożnikach miotu (co najmniej 3). Narożniki można przeciągać; ostatni usuniesz przyciskiem [[Cofnij narożnik]].',
        'Dotknij [[Zapisz miot]]. Powtórz dla kolejnych miotów; kolejność ustala się według godzin.',
      ],
      tips: [
        'Miot poprawisz przyciskiem [[Edytuj]] przy jego nazwie, a usuniesz krzyżykiem.',
        'Na mapie widać wiatr na godzinę najbliższego miotu. Krawędzie miotu są pokolorowane według wiatru, co pomaga ustawić linię myśliwych tak, żeby zwierzyna ich nie wiatrowała.',
      ],
    },
    {
      id: 'trasy',
      title: 'Wyznacz trasy naganiaczy i zbiórkę po miocie',
      where: ['Teren', 'Mioty', 'Trasy'],
      text: ['Trasa to linia, którą naganiacz ma przejść: pierwszy punkt to start, ostatni to koniec (przy linii myśliwych). Naganiacz zobaczy ją na mapie i może włączyć prowadzenie ze strzałką i wibracjami.'],
      steps: [
        'Przy miocie dotknij [[Trasy]].',
        'Szybki sposób: dotknij [[Rozłóż tyralierę]], zaznacz naganiaczy, a potem stuknij na mapie 2 końce linii startu i 2 końce linii końca. Aplikacja rozłoży trasy równo.',
        'Dokładny sposób: wybierz naganiacza z listy i stukaj mapę od startu do końca. Punkty można przeciągać; [[Cofnij punkt]] usuwa ostatni, [[Usuń trasę]] całą trasę.',
        'Dotknij [[Zbiórka po miocie]] i wskaż na mapie, gdzie wszyscy spotykają się po tym miocie.',
        'Dotknij [[Zapisz trasy]].',
      ],
      tips: ['Trasy można wyznaczyć tylko naganiaczom, którzy już się zapisali.'],
    },
    {
      id: 'stanowiska',
      title: 'Stanowiska myśliwych',
      where: ['Teren', 'Stanowiska myśliwych'],
      text: [
        'Losowanie stanowisk zostaje na papierze; aplikacja niczego nie losuje. Każdy myśliwy wpisuje numer z wylosowanej kartki do miotu, który trwa albo jest następny, i widzi go na mapie.',
        'W polu [[Stanowiska myśliwych]] widzisz, kto ma wpisane stanowisko i ilu brakuje. Możesz wpisać lub poprawić numery za myśliwych i dotknąć [[Zapisz stanowiska]].',
      ],
      tips: ['Jeśli numer stanowiska jest nazwą zwyżki koła, stanowisko pokaże się na mapie dokładnie w miejscu zwyżki.'],
    },
    {
      id: 'transport-tusz',
      title: 'Wyznacz transport tusz',
      where: ['Informacje', 'Transport tusz', 'Wyznacz'],
      steps: [
        'W zakładce [[Informacje]] przy [[Transport tusz]] dotknij [[Wyznacz]].',
        'Wybierz osobę do dzików i osobę do zwierzyny płowej (jeleń, daniel, muflon, sarna). Każda zobaczy tylko swoje tusze.',
        'Jeśli transport robi ktoś bez aplikacji, wybierz [[Osoba spoza aplikacji…]] i wpisz jej imię i telefon. Po miocie wyślesz jej listę tusz przyciskiem [[SMS z listą]].',
        'Dotknij [[Zapisz]].',
      ],
      tips: ['Tusza trafia na listę, gdy myśliwy zapisze strzał jako [[Zwierzyna leży]], i staje się gotowa do zabrania po zakończeniu miotu. Postrzałów nie ma na liście.'],
    },
    {
      id: 'telefon',
      title: 'Prowadzenie z telefonu i zastępcy',
      where: ['Informacje', 'Prowadzenie z telefonu'],
      text: ['Polowanie przygotowane na komputerze poprowadzisz z telefonu. Telefon dostaje prawa prowadzącego i to on jest prowadzącym na mapie (pozycja, strzały); komputer zachowuje swoje prawa.'],
      steps: [
        'Na komputerze w zakładce [[Informacje]] otwórz [[Prowadzenie z telefonu]] i dotknij [[Pokaż kod QR dla telefonu]].',
        'Zeskanuj kod aparatem telefonu i na telefonie dotknij [[Potwierdź]]. Kod jest jednorazowy i ważny 10 minut.',
        'Jeśli chcesz wrócić do prowadzenia z innego swojego urządzenia, dotknij na nim [[To urządzenie jest w terenie]].',
        'Zastępcę wyznaczysz na liście uczestników przyciskiem [[+ zastępca]]. Zastępca ma te same prawa co prowadzący, np. gdy Twój telefon się rozładuje. [[Odbierz zastępstwo]] cofa to.',
      ],
    },
    {
      id: 'start-polowania',
      title: 'Rozpocznij polowanie',
      where: ['Teren', 'Rozpocznij polowanie'],
      steps: [
        'Na zbiórce dotknij [[Rozpocznij polowanie]]. Od tej chwili uczestnicy mogą udostępniać lokalizację, zgłaszać zwierzynę i zapisywać strzały.',
        'Sam też dotknij [[Udostępniaj moją lokalizację]], żeby uczestnicy widzieli prowadzącego.',
        'Sprawdź pod mapą, ile osób jest widocznych na mapie. [[Pokaż wszystkich]] dopasowuje mapę do wszystkich uczestników.',
      ],
      tips: ['W czasie miotu wygodny jest [[Tryb terenowy]]: mapa na cały ekran i duże przyciski.'],
    },
    {
      id: 'mioty-na-zywo',
      title: 'Prowadź mioty',
      where: ['Teren', 'Mioty'],
      steps: [
        'Gdy linia myśliwych stoi, dotknij [[Rozpocznij miot]] przy miocie. Wszyscy uczestnicy dostają powiadomienie z wibracją.',
        'Po sygnale końca dotknij [[Zakończ miot]]. Wtedy tusze z tego miotu stają się gotowe do zabrania.',
        'Postrzał zapisany przez myśliwego wywołuje alarm u wszystkich, z nazwą zwierzyny, strzelcem i miotem.',
      ],
    },
    {
      id: 'wiadomosci-wysylanie',
      title: 'Wysyłaj wiadomości',
      where: ['Teren', 'Wiadomości'],
      steps: [
        'W polu [[Wiadomości]] wybierz, do kogo: [[Wszyscy]], [[Myśliwi]], [[Naganiacze]], [[Transport tusz]] albo jedna osoba.',
        'Wybierz gotową wiadomość (np. „STOP! Wstrzymać nagankę.”, „Koniec miotu. Rozładować broń.”) albo wpisz własną i dotknij [[Wyślij]].',
        'Przy wysłanej wiadomości widać, ile osób dotknęło [[Przyjąłem]], a niżej, kto jeszcze nie potwierdził.',
      ],
      tips: ['Wiadomość dociera tylko do telefonów z otwartą aplikacją (także w trybie kieszeni). Nie zastępuje sygnałów rogiem ani radia.'],
    },
    {
      id: 'tusze',
      title: 'Tusze po miocie',
      where: ['Teren', 'Tusze do zabrania'],
      text: [
        'Lista [[Tusze do zabrania]] pokazuje strzeloną grubą zwierzynę, najbliższą na górze. Miejsce tuszy to miejsce zaznaczone przez strzelca, a jeśli go nie ma, miejsce strzału albo stanowisko strzelca.',
      ],
      steps: [
        'Strzelec albo Ty poprawiasz miejsce przyciskiem [[Leży tutaj]] (stojąc przy tuszy) albo [[Wskaż na mapie]].',
        'Transport widzi swoje tusze sam. Osobie spoza aplikacji wyślij listę przyciskiem [[SMS z listą]].',
        'Zabraną tuszę oznacza się przyciskiem [[Zabrane]].',
      ],
    },
    {
      id: 'koniec-pokot',
      title: 'Zakończ polowanie i zatwierdź pokot',
      where: ['Pokot'],
      text: [
        'Pokot tworzy się na bieżąco ze strzałów zapisanych przez myśliwych; każdy uczestnik widzi go na żywo.',
      ],
      steps: [
        'W zakładce [[Informacje]] dotknij [[Zakończ polowanie]].',
        'W zakładce [[Pokot]] przejrzyj strzały. [[Popraw]] zmienia efekt, zwierzynę, miot, strzelca albo uwagi; [[+ Dodaj zwierzynę]] dopisuje np. sztukę znalezioną po dochodzeniu.',
        'Zaznacz [[Pokaż króla polowania i pudłarza]], jeśli koło tak chce.',
        'Dotknij [[Zatwierdź pokot]]. Od tej chwili nikt nie zmieni strzałów; [[Odblokuj do poprawek]] cofa zatwierdzenie.',
        'Dotknij [[Pobierz pokot (PDF)]] i w oknie drukowania wybierz „Zapisz jako PDF”. PDF ma miejsce na podpis prowadzącego.',
      ],
      tips: [
        'Dla każdego strzelonego dzika pokot ma współrzędne do dokumentów ASF. Pobierz PDF w ciągu 7 dni: potem miejsca strzałów, tusz i ślady są usuwane, a sam pokot zostaje.',
        'Ślady wszystkich uczestników pobierzesz pod mapą przyciskiem [[Pobierz ślady (GPX)]].',
      ],
    },
    {
      id: 'przekazanie',
      title: 'Przekaż prowadzenie',
      where: ['Uczestnicy', 'Przekaż prowadzenie'],
      text: ['Gdy musisz zejść z polowania albo ktoś inny ma je dalej prowadzić, przekaż mu prowadzenie. Nowy prowadzący dostaje wszystkie prawa i jest prowadzącym na mapie i w pokocie.'],
      steps: [
        'W zakładce [[Uczestnicy]] przy potwierdzonej osobie dotknij [[Przekaż prowadzenie]].',
        'Wybierz [[Przekaż, zostaję zastępcą]], jeśli chcesz zachować prawa prowadzącego, albo [[Przekaż]]: zostaniesz wtedy na liście jako myśliwy.',
      ],
      tips: ['Twoje inne urządzenia (np. komputer) tracą prawa prowadzącego. Stanowiska, strzały i telefony zostają bez zmian.'],
    },
    {
      id: 'zarzadzanie',
      title: 'Zmiany i usuwanie polowania',
      where: ['Informacje', 'Zarządzanie'],
      text: [
        'W zakładce [[Informacje]], w części [[Zarządzanie]], zmienisz status polowania, szczegóły ([[Edytuj szczegóły]]) albo usuniesz polowanie razem z listą uczestników ([[Usuń polowanie]]).',
        'Położenie uczestników, ślady i telefony są przechowywane 7 dni po zakończeniu polowania, potem są usuwane.',
      ],
    },
  ],
};

// ---------------------------------------------------------------- hunter

const HUNTER: Guide = {
  role: 'hunter',
  title: 'Instrukcja myśliwego',
  short: 'Myśliwy',
  intro:
    'Jako myśliwy zapisujesz się na polowanie, wpisujesz swoje stanowisko, udostępniasz położenie, zgłaszasz zwierzynę i zapisujesz strzały. Z tych strzałów powstaje pokot.',
  sections: [
    SIGN_UP('Myśliwy'),
    BEFORE(false),
    {
      id: 'stanowisko',
      title: 'Wpisz swoje stanowisko',
      where: ['Teren', 'Twoje stanowisko'],
      steps: [
        'Po losowaniu w zakładce [[Teren]] znajdź pole [[Twoje stanowisko]] w miocie, który trwa albo jest następny.',
        'Wpisz numer z wylosowanej kartki albo wybierz zwyżkę z podpowiedzi i dotknij [[Zapisz]].',
        'Przed każdym kolejnym miotem wpisz nowe stanowisko. Pomyłkę poprawisz przyciskiem [[Zmień]].',
      ],
      tips: ['Prowadzący widzi, kto nie wpisał stanowiska, i może je poprawić.'],
    },
    SHARE(false),
    FIELD(false),
    SIGHTING,
    {
      id: 'strzal',
      title: 'Zapisz strzał',
      where: ['Teren', 'Strzał'],
      text: ['Strzał zapisuj od razu po oddaniu: aplikacja zapamiętuje godzinę, miot i miejsce, w którym stoisz. Efekt możesz opisać od razu albo później.'],
      steps: [
        'Dotknij [[Strzał]]. Strzał jest zapisany już w tej chwili.',
        'Wybierz efekt: [[Zwierzyna leży]], [[Postrzał]] albo [[Pudło]], a przy trafieniu także gatunek. Gatunki poza okresem polowań są oznaczone.',
        'Jeśli nie wiesz jeszcze, co się stało, dotknij [[Uzupełnię później]] i popraw strzał w zakładce [[Pokot]] przyciskiem [[Popraw]].',
        'Strzał zapisany przez pomyłkę cofniesz przez 30 sekund przyciskiem [[Cofnij]].',
      ],
      tips: [
        'Postrzał wywołuje alarm u wszystkich uczestników, żeby można było zorganizować dochodzenie.',
        'Gdy strzelisz grubą zwierzynę, po miocie zaznacz, gdzie leży tusza: w [[Tusze do zabrania]] dotknij [[Leży tutaj]] (stojąc przy niej) albo [[Wskaż na mapie]]. Transport pojedzie prosto do niej, a przy dziku te współrzędne trafią do dokumentów ASF.',
      ],
    },
    MESSAGES_IN,
    {
      id: 'mapa',
      title: 'Co widać na mapie',
      where: ['Teren'],
      text: [
        'Na mapie są uczestnicy (ikony ról), mioty, zwyżki i ambony, trasy naganiaczy, zgłoszona zwierzyna i strzały. Dotknij znacznika, żeby zobaczyć szczegóły, np. jak dawno ktoś wysłał położenie i jak daleko jest od Ciebie.',
        'W rogu mapy zmienisz podkład (mapa, topograficzna, ortofotomapa) i włączysz warstwy, np. [[Strzałki wiatru]] czy [[Oddziały leśne]]. Odznaka wiatru pokazuje wiatr na godzinę najbliższego miotu, a stożek od Twojej pozycji pokazuje, dokąd niesie się Twój zapach.',
        'Pod mapą: [[Moje położenie]], [[Pokaż wszystkich]], [[Pokaż ślady]] i [[Pobierz ślady (GPX)]].',
      ],
    },
    {
      id: 'pokot',
      title: 'Pokot',
      where: ['Pokot'],
      text: [
        'W zakładce [[Pokot]] widać na żywo wszystkie strzały i strzeloną zwierzynę, z podziałem na mioty, oraz tabelę strzałów każdego myśliwego.',
        'Swoje strzały możesz poprawiać przyciskiem [[Popraw]], dopóki prowadzący nie zatwierdzi pokotu. [[Pobierz pokot (PDF)]] zapisuje pokot jako PDF.',
      ],
    },
    CARRIER,
  ],
};

// ---------------------------------------------------------------- beater

const BEATER: Guide = {
  role: 'beater',
  title: 'Instrukcja naganiacza',
  short: 'Naganiacz',
  intro:
    'Jako naganiacz zapisujesz się na polowanie, udostępniasz położenie, żeby prowadzący i myśliwi wiedzieli, gdzie jesteś, idziesz wyznaczoną trasą z pomocą strzałki i zgłaszasz zwierzynę, którą ruszysz.',
  sections: [
    SIGN_UP('Naganiacz'),
    BEFORE(true),
    SHARE(true),
    {
      id: 'trasa',
      title: 'Idź swoją trasą',
      where: ['Teren', 'Twoja trasa', 'Prowadź mnie'],
      text: [
        'Jeśli prowadzący wyznaczył Ci trasę, przed miotem zobaczysz pole [[Twoja trasa]] z nazwą miotu i odległością do startu. Trasa jest też na mapie, a obok niej miejsce zbiórki po miocie.',
      ],
      steps: [
        'Dotknij [[Prowadź mnie]]. Strzałka pokazuje kierunek, a napis: [[Idź na start trasy]], potem [[Na trasie · do końca]] z odległością.',
        'Dotknij [[Włącz kompas]], żeby strzałka obracała się razem z telefonem. Bez kompasu strzałka pokazuje kierunek względem północy (góra to północ).',
        'Gdy zejdziesz z trasy o więcej niż 50 m, telefon zawibruje i pokaże, w którą stronę wrócić.',
        'Na 100 m przed końcem trasy zobaczysz ostrzeżenie [[Uwaga: linia myśliwych za]]: zbliżasz się do linii myśliwych.',
        'Na końcu pojawi się [[Koniec trasy]]. Prowadzenie wyłączysz przyciskiem [[Wyłącz]].',
      ],
      tips: [
        'Prowadzenie działa też w trybie kieszeni, więc telefon może być w kieszeni: wibracje powiedzą, gdy zejdziesz z trasy.',
        'GPS w lesie myli się o 5–20 m, a kompas telefonu o kilkanaście stopni. Trasa to pomoc, nie zastępuje poleceń prowadzącego. Na iPhonie w przeglądarce nie ma wibracji.',
        'Jeśli kompas pokazuje bzdury, zatocz telefonem w powietrzu ósemkę.',
      ],
    },
    FIELD(true),
    SIGHTING,
    MESSAGES_IN,
    {
      id: 'po-miocie',
      title: 'Po miocie',
      where: ['Teren'],
      text: [
        'Gdy prowadzący zakończy miot, dostaniesz powiadomienie. Idź na zbiórkę po miocie zaznaczoną na mapie flagą. Przed następnym miotem zobaczysz nową trasę.',
        'Strzały oddane w miocie i pokot widać w liście [[Pokot]].',
      ],
    },
    CARRIER,
  ],
};

export const GUIDES: Record<GuideRole, Guide> = { leader: LEADER, hunter: HUNTER, beater: BEATER };

// ---------------------------------------------------------------- rendering

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Every [[Label]] in a text. */
export const uiLabels = (s: string): string[] => [...s.matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1]);

/** Escaped text with [[Label]] shown as a button-like chip. */
export const fmt = (s: string) => esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="hg-ui">$1</span>');

function section(s: GuideSection, i: number): string {
  const where = s.where?.length
    ? `<p class="hg-where"><span class="muted">Gdzie:</span> ${s.where.map((w) => `<span class="hg-ui">${esc(w)}</span>`).join('<span class="hg-sep" aria-hidden="true">›</span>')}</p>`
    : '';
  const text = (s.text ?? []).map((p) => `<p>${fmt(p)}</p>`).join('');
  const steps = s.steps?.length ? `<ol class="hg-steps">${s.steps.map((p) => `<li>${fmt(p)}</li>`).join('')}</ol>` : '';
  const tips = (s.tips ?? []).map((p) => `<p class="hg-tip">${ic('info', 16)}<span>${fmt(p)}</span></p>`).join('');
  return `<section class="hg-sec card" id="hg-${s.id}" aria-labelledby="hg-${s.id}-h">
    <h3 id="hg-${s.id}-h"><span class="hg-num">${i + 1}</span>${esc(s.title)}</h3>${where}${text}${steps}${tips}</section>`;
}

/** The guide page: role switcher, contents, then the sections. */
export function renderGuide(role: GuideRole | null): string {
  const g = role ? GUIDES[role] : null;
  const pick = GUIDE_ROLES.map(
    (r) =>
      `<a href="#/instrukcja/${GUIDE_SLUG[r]}" data-nav="guide" data-role="${r}" role="tab" aria-selected="${r === role}"${r === role ? ' aria-current="page"' : ''}>${roleIcon(r, 22)}<span>${GUIDES[r].short}</span></a>`,
  ).join('');
  const back = `<a class="btn ghost back" href="#/polowanie" data-nav="tab" data-tab="hunt">${ic('back', 18)} ${getLang() === 'pl' ? 'Polowanie zbiorowe' : 'Group hunts'}</a>`;
  const en = getLang() === 'pl' ? '' : `<p class="notice small">This guide is available in Polish only.</p>`;
  const head = `${back}<h2>${g ? esc(g.title) : 'Instrukcje polowania zbiorowego'}</h2>${en}
    <nav class="hg-roles" role="tablist" aria-label="Instrukcja dla">${pick}</nav>`;
  if (!g)
    return `<div class="hguide">${head}<p>Wybierz swoją rolę w polowaniu. Każda instrukcja opisuje krok po kroku wszystko, co ta rola może zrobić w aplikacji.</p>
      <ul class="hg-pick">${GUIDE_ROLES.map((r) => `<li><a href="#/instrukcja/${GUIDE_SLUG[r]}" data-nav="guide" data-role="${r}">${roleIcon(r, 28)}<span><strong>${GUIDES[r].short}</strong><small class="muted">${esc(GUIDES[r].intro)}</small></span>${ic('chevron', 20)}</a></li>`).join('')}</ul></div>`;
  const toc = `<details class="hg-toc card" open><summary><strong>Spis treści</strong></summary><ol>${g.sections
    .map((s, i) => `<li><button type="button" data-action="guideJump" data-target="hg-${s.id}"><span class="hg-tocn">${i + 1}.</span><span>${esc(s.title)}</span></button></li>`)
    .join('')}</ol></details>`;
  return `<div class="hguide">${head}<p class="hg-intro">${esc(g.intro)}</p>${toc}${g.sections.map(section).join('')}
    <p class="muted small">Coś się nie zgadza albo czegoś brakuje? Powiedz prowadzącemu albo autorowi aplikacji.</p></div>`;
}
