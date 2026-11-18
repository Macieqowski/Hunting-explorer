# Aplikacja na iPhone'a (iOS)

Ta sama aplikacja co na Androidzie (Capacitor 8, kod z `src/`), zbudowana w Xcode na Macu.
Projekt Xcode jest w `ios/` (Swift Package Manager, bez CocoaPods).

## Czego trzeba

- Mac z **Xcode 26** lub nowszym (App Store), uruchomionym raz, z zaakceptowaną licencją i pobraną platformą iOS.
- **Node.js 22** lub nowszy (`brew install node` albo instalator z nodejs.org) i git.
- iPhone z iOS 15 lub nowszym, kabel USB.
- Apple ID. Darmowe konto wystarcza do instalacji na własnym telefonie (szczegóły niżej).

## Budowanie

```sh
git clone https://github.com/Macieqowski/Hunting-explorer.git
cd Hunting-explorer
npm ci
npm run ios:sync      # buduje dist/app i kopiuje do ios/
npm run ios:open      # otwiera projekt w Xcode
```

W Xcode:

1. **Xcode → Settings → Accounts → +** i dodaj swoje Apple ID.
2. Po lewej kliknij projekt **App**, target **App**, karta **Signing & Capabilities**:
   zaznacz *Automatically manage signing*, w **Team** wybierz swoje konto („Personal Team”).
   Jeśli Xcode zgłosi, że `org.polowanie.app` jest zajęty, zmień **Bundle Identifier** np. na
   `org.polowanie.app.test` (tylko lokalnie, nie zapisuj tego w repozytorium).
3. Podłącz iPhone'a kablem, odblokuj go i stuknij **Ufaj temu komputerowi**.
4. Na iPhonie: **Ustawienia → Prywatność i ochrona → Tryb dewelopera** → włącz, telefon się uruchomi ponownie.
5. W Xcode u góry wybierz swojego iPhone'a jako cel i naciśnij **▶ (Run)**.
6. Przy pierwszym uruchomieniu iPhone zablokuje aplikację: **Ustawienia → Ogólne → VPN i urządzenia →**
   Twoje Apple ID → **Ufaj**. Potem uruchom ją jeszcze raz.

Po zmianach w kodzie: `git pull`, `npm run ios:sync` i znowu **▶** w Xcode.

## Darmowe a płatne konto Apple

| | Darmowe Apple ID | Apple Developer Program (99 USD rocznie) |
|---|---|---|
| Instalacja na własnym iPhonie z Xcode | tak | tak |
| Jak długo działa | **7 dni**, potem ponownie ▶ z Xcode | rok |
| Inni testerzy | nie | TestFlight (do 10 000 osób) |
| App Store | nie | tak |
| Linki www.polowanie.org otwierają aplikację | nie | tak (po dodaniu apple-app-site-association) |

## Pozycja przy zablokowanym ekranie

Jest (`ios/App/App/BackgroundLocationPlugin.swift` + `PositionPublisher.swift`, odpowiedniki
`LocationService` i `PositionPublisher` z Androida). iOS usypia stronę po zablokowaniu ekranu, więc
pozycję do bazy polowania wysyła sama aplikacja przez REST API Firebase. Wystarczy zgoda „Podczas
używania aplikacji”: udostępnianie włączone przy odblokowanym ekranie trwa dalej po zablokowaniu,
a w pasku stanu widać niebieski wskaźnik lokalizacji. Nie ma liczby satelitów (iOS jej nie podaje)
ani powiadomienia z przyciskiem Stop: zatrzymuje się w aplikacji.

## Pozostałe wtyczki natywne

Wszystkie wtyczki z Androida mają odpowiedniki w Swifcie w `ios/App/App/` (te same nazwy i zdarzenia,
więc kod w `src/` ich nie rozróżnia), zarejestrowane w `ViewController.swift`:

| Wtyczka | iPhone | Różnice względem Androida |
|---|---|---|
| Alerts | Core Haptics + powiadomienia | wibracja w tle tylko jako powiadomienie (dźwięk/wibracja wg ustawień telefonu) |
| Compass | CLHeading | — |
| Printer | systemowe okno drukowania (też „Zapisz do Plików” jako PDF) | — |
| Speech | rozpoznawanie mowy Apple (pl-PL) | prosi o zgodę na mikrofon i rozpoznawanie mowy |
| Voice | AVSpeechSynthesizer | czyta też w trybie cichym |
| Bars | styl paska stanu | iPhone nie ma dolnego paska nawigacji |
| TileDownload | port TileDownloadService + Puwg92 | patrz niżej |
| Gps | brak (niepotrzebny) | iOS ma A-GPS, lokalizacja z WebView łapie pozycję szybko |

**Zapis map offline:** podczas zapisu ekran sam nie gaśnie. Po zablokowaniu telefonu iOS 26 kontynuuje
zapis jako zadanie w tle z postępem na ekranie blokady (można je tam zatrzymać). Starszy iOS daje
aplikacji tylko około pół minuty: zapis się wstrzyma i wznowi po otwarciu aplikacji.

**Alarmy przy zablokowanym ekranie:** powiadomienia wysyła strona, a iOS może ją uśpić w tle.
Trzeba to sprawdzić na telefonie; pewne rozwiązanie to powiadomienia push (płatne konto Apple).

**Aktualizacje:** aplikacja nie sprawdza wydań APK na GitHubie; nową wersję instaluje się z Xcode.
