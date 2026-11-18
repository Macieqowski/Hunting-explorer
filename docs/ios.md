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

## Co na iPhonie jeszcze nie działa

Wtyczki natywne są na razie tylko na Androida (`android/app/src/main/java/org/polowanie/app/`).
Na iPhonie aplikacja używa wtedy tego, co daje przeglądarka (WKWebView):

- **Pozycja przy zablokowanym ekranie** (BackgroundLocation): naganiacze i myśliwi wysyłają pozycję
  tylko z włączonym ekranem, jak na stronie. To najważniejsza brakująca rzecz.
- **Zapisywanie map offline w tle** (TileDownload): zapis działa, ale tylko z otwartą aplikacją.
- **Alarmy w kieszeni** (Alerts): brak powiadomień i wibracji przy wiadomościach i alarmach.
- **Kompas** (Compass): kompas z przeglądarki, bez informacji o kalibracji.
- **Odpowiedzi głosem na egzaminie ustnym** (Speech): niedostępne.
- **Drukowanie i PDF pokotu** (Printer): może nie działać.
- **Aktualizacje**: aplikacja nie sprawdza wydań APK na GitHubie; nową wersję instaluje się z Xcode.

Działa: mapa, egzaminy, pogoda, okresy, atlas, polowanie zbiorowe z włączonym ekranem, GPS (z Wi-Fi i A-GPS
iPhone'a łapie pozycję szybko), mapy offline, udostępnianie, schowek.
