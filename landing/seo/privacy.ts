/**
 * "Polityka prywatności": what the website and the apps collect, who sees it, how long it is
 * kept and how to have it deleted. Google Play and the App Store both ask for the address of
 * this page, and the app links to it from "Więcej" and "O aplikacji" (PRIVACY_URL in
 * src/platform.ts).
 *
 * Every statement here describes what the code does. When a feature starts sending or storing
 * something new, or a service is added or replaced, change this page in the same pull request
 * and move UPDATED forward. docs/store-review.md lists the store forms that repeat these facts.
 */
import type { Page } from './layout';

export const PRIVACY_PATH = '/prywatnosc/';
/** The day the text last changed. */
export const UPDATED = '2026-11-18';
const CONTACT = 'kontakt@polowanie.org';
/** The data controller (GDPR art. 4(7)): the person who runs the app and the services behind it. */
const CONTROLLER = 'Maciej Palicki';

const mail = `<a href="mailto:${CONTACT}">${CONTACT}</a>`;
const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
/** "2026-11-18" → "18 listopada 2026 r." */
const plDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)} r.`;

export function privacyPage(): Page {
  return {
    path: PRIVACY_PATH,
    title: 'Polityka prywatności – Polowanie',
    description:
      'Jakie dane zbiera aplikacja Polowanie i strona polowanie.org, kto je widzi, jak długo są przechowywane i jak je usunąć. Bez kont, reklam i śledzenia.',
    crumbs: [{ name: 'Polityka prywatności', path: PRIVACY_PATH }],
    priority: 0.3,
    body: `<article class="prose">
<h1>Polityka prywatności</h1>
<p class="lead">Dotyczy strony www.polowanie.org oraz aplikacji Polowanie na Androida i iPhone’a (identyfikator <code>org.polowanie.app</code>). Obowiązuje od ${plDate(UPDATED)}</p>

<h2>W skrócie</h2>
<ul>
<li>Nie ma kont, haseł użytkowników, reklam ani śledzenia między aplikacjami i stronami. Nie sprzedajemy danych.</li>
<li>Większość tego, co robisz w aplikacji (postępy w egzaminach, zapisane mapy, miejsca pogody, ustawienia), zostaje wyłącznie na Twoim urządzeniu.</li>
<li>Dane trafiają na serwer tylko wtedy, gdy bierzesz udział w polowaniu zbiorowym albo wysyłasz odpowiedź z egzaminu ustnego do oceny przez AI. W obu przypadkach aplikacja najpierw mówi, co wyśle, i czeka na Twoją zgodę.</li>
<li>Swoje dane możesz usunąć sam w aplikacji albo pisząc na ${mail}.</li>
</ul>

<h2>Kto odpowiada za dane</h2>
<p>Administratorem danych jest ${CONTROLLER}, twórca aplikacji Polowanie. Kontakt we wszystkich sprawach dotyczących danych: ${mail}.</p>
<p>Polowanie zbiorowe organizuje koło łowieckie albo prowadzący. To prowadzący decyduje, kto bierze w nim udział, i może usunąć polowanie razem z danymi uczestników.</p>

<h2>Dane, które zostają na Twoim urządzeniu</h2>
<p>Te dane nie są nigdzie wysyłane. Usuniesz je, czyszcząc dane strony w przeglądarce albo odinstalowując aplikację.</p>
<ul>
<li>postępy i wyniki egzaminów, historia odpowiedzi,</li>
<li>zapisane miejsca pogody, wybrane województwo, język, wygląd i inne ustawienia,</li>
<li>mapy zapisane do pracy bez internetu,</li>
<li>lista polowań, w których brałeś udział na tym urządzeniu, oraz Twoje imię wpisane przy zapisie,</li>
<li>godziny zapisane na ekranie „Wypadek” (na przykład założenia opaski uciskowej).</li>
</ul>

<h2>Polowanie zbiorowe</h2>
<p>Gdy tworzysz polowanie albo zapisujesz się na nie, aplikacja nadaje temu urządzeniu losowy, anonimowy identyfikator (bez adresu e-mail i hasła) i zapisuje w bazie danych:</p>
<ul>
<li><b>imię lub pseudonim</b>, które wpisujesz, oraz rolę (prowadzący, myśliwy, naganiacz, transport); naganiacz może zaznaczyć, że idzie z psem,</li>
<li><b>numer telefonu</b>, tylko jeśli sam go podasz,</li>
<li><b>położenie</b> i ślad trasy, tylko gdy włączysz udostępnianie lokalizacji i tylko gdy polowanie trwa,</li>
<li>to, co zgłaszasz w trakcie: zauważoną zwierzynę, strzały i ich wynik (pokot), stanowisko, potwierdzenia odczytania wiadomości, alarm o wypadku z pozycją, informację o noszonej apteczce,</li>
<li>jeśli jesteś prowadzącym: dane polowania (nazwa, termin, miejsce, notatki, mioty, trasy, zwyżki), wiadomości do uczestników i przydziały.</li>
</ul>
<p><b>Kto to widzi.</b> Listę uczestników, numery telefonów, położenia i zgłoszenia widzą tylko uczestnicy potwierdzeni przez prowadzącego tego polowania oraz prowadzący i jego zastępcy. Nazwę, termin, miejsce i notatki polowania oraz imię prowadzącego może odczytać każdy, kto ma link do polowania.</p>
<p><b>Jak długo.</b> Położenia, ślady tras, zgłoszenia zwierzyny i miejsca strzałów są usuwane 7 dni po zakończeniu polowania (robi to aplikacja prowadzącego przy najbliższym otwarciu). Pozostałe dane polowania zostają do chwili, gdy prowadzący usunie polowanie.</p>

<h2>Lokalizacja</h2>
<ul>
<li><b>Mapa i pogoda.</b> „Gdzie jestem?”, pogoda dla miejsca, w którym jesteś, i pomiary na mapie używają położenia tylko na ekranie telefonu. Do prognozy pogody wysyłane są współrzędne miejsca (usługa Open-Meteo), bez żadnego identyfikatora.</li>
<li><b>Udostępnianie na polowaniu zbiorowym.</b> Włączasz je sam przyciskiem „Udostępniaj moją lokalizację”. Od tej chwili aplikacja wysyła położenie do bazy danych także w tle: przy zgaszonym ekranie i wtedy, gdy korzystasz z innej aplikacji. Na Androidzie widać wtedy stałe powiadomienie, a na iPhonie niebieski znacznik lokalizacji. Udostępnianie kończy przycisk „Zatrzymaj”, zakończenie polowania przez prowadzącego albo zamknięcie aplikacji.</li>
<li><b>Ekran „Wypadek”.</b> Pokazuje Twoje współrzędne do przeczytania dyspozytorowi 112. Alarm do prowadzącego wysyła je tylko wtedy, gdy sam go nadasz.</li>
</ul>
<p>Aplikacja nie zbiera położenia, gdy nie udostępniasz go na polowaniu, i nie używa go do reklam ani profilowania.</p>

<h2>Egzamin ustny: mikrofon i ocena AI</h2>
<ul>
<li><b>Mikrofon.</b> Mowę na tekst zamienia usługa rozpoznawania mowy Twojego telefonu lub przeglądarki (Apple na iPhonie, zwykle Google na Androidzie i w Chrome), więc dźwięk może trafić na jej serwery. Aplikacja niczego nie nagrywa i nie przechowuje dźwięku. Odpowiedź możesz też wpisać.</li>
<li><b>Ocena AI.</b> Jeśli wybierzesz „Oceń z AI”, tekst Twojej odpowiedzi trafia przez naszą usługę (Cloudflare Workers) do modelu AI firmy OpenAI albo Anthropic, który porównuje go z odpowiedzią wzorcową. Nie zapisujemy treści odpowiedzi. W dzienniku usługi zostają tylko numer pytania, nazwa modelu, czas i ocena. Do pilnowania dziennego limitu służą jednokierunkowe skróty anonimowego identyfikatora i adresu sieciowego, które zmieniają się co dzień i są kasowane następnego dnia. Bez oceny AI oceniasz odpowiedź samodzielnie i nic nie jest wysyłane.</li>
</ul>

<h2>Uprawnienia w aplikacji</h2>
<ul>
<li><b>Lokalizacja</b>: mapa, pogoda, ekran „Wypadek”, udostępnianie położenia na polowaniu zbiorowym.</li>
<li><b>Powiadomienia</b>: stałe powiadomienie podczas udostępniania położenia i zapisywania map, wiadomości i sygnały prowadzącego, alarm o wypadku. Powstają w telefonie; aplikacja nie używa powiadomień wysyłanych z serwera.</li>
<li><b>Mikrofon i rozpoznawanie mowy</b>: tylko odpowiedzi głosowe na egzaminie ustnym, po dotknięciu przycisku mikrofonu.</li>
</ul>
<p>Każdego uprawnienia możesz odmówić albo je cofnąć w ustawieniach telefonu. Pozostałe części aplikacji działają dalej.</p>

<h2>Usługi, z których korzystamy</h2>
<p>Każda z nich, jak każdy serwer w internecie, widzi adres sieciowy (IP) urządzenia, które się z nią łączy.</p>
<ul>
<li><b>Google Firebase</b> (Google Ireland Ltd): anonimowy identyfikator urządzenia oraz baza danych polowań zbiorowych, przechowywana w Unii Europejskiej (Belgia).</li>
<li><b>Cloudflare</b>: usługa oceny egzaminu ustnego oraz statystyki odwiedzin strony www.polowanie.org (Cloudflare Web Analytics, bez plików cookie i bez identyfikowania osób). Statystyk nie ma w aplikacji na telefon.</li>
<li><b>OpenAI</b> i <b>Anthropic</b>: ocena odpowiedzi z egzaminu ustnego, tylko na Twoje żądanie. Firmy te mają siedziby w USA.</li>
<li><b>Open-Meteo</b>: prognoza pogody i wyszukiwanie miejscowości (współrzędne albo wpisana nazwa).</li>
<li><b>Geoportal (GUGiK)</b>, <b>Bank Danych o Lasach (Lasy Państwowe)</b>, <b>OpenStreetMap</b> i <b>OpenTopoMap</b>: mapy i granice obwodów. Serwery map widzą, który fragment mapy pobierasz.</li>
<li><b>GitHub</b>: hosting strony (aplikacja pobiera z niej aktualną listę obwodów i filmy instruktażowe), a w aplikacji na Androida instalowanej z pliku APK także sprawdzanie, czy jest nowsza wersja.</li>
</ul>
<p>Zdjęcia w atlasie zwierzyny, pytania egzaminacyjne i instrukcje pierwszej pomocy są częścią aplikacji i nie są pobierane z zewnętrznych serwerów.</p>

<h2>Podstawa prawna</h2>
<ul>
<li>udostępnianie położenia i wysłanie odpowiedzi do oceny AI: Twoja zgoda (art. 6 ust. 1 lit. a RODO), którą możesz w każdej chwili cofnąć, zatrzymując udostępnianie albo nie korzystając z oceny AI,</li>
<li>pozostałe dane polowania zbiorowego: działanie funkcji, z której korzystasz (art. 6 ust. 1 lit. b RODO),</li>
<li>statystyki odwiedzin strony i ochrona usług przed nadużyciami: uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO).</li>
</ul>

<h2>Jak usunąć swoje dane</h2>
<ul>
<li><b>Dane na urządzeniu</b>: odinstaluj aplikację albo wyczyść dane strony w przeglądarce.</li>
<li><b>Udział w polowaniu</b>: przycisk „Wypisz się” usuwa Twój zapis na polowanie razem z położeniem i śladem trasy, a „Usuń numer” Twój numer telefonu. Zatrzymanie udostępniania usuwa Twoje bieżące położenie z mapy. Swoje zgłoszenia zwierzyny możesz usunąć sam. Prowadzący może usunąć każdego uczestnika.</li>
<li><b>Całe polowanie</b>: prowadzący usuwa je przyciskiem „Usuń polowanie”. Znikają wtedy wszystkie dane uczestników tego polowania.</li>
<li><b>Na żądanie</b>: napisz na ${mail}, podając nazwę i datę polowania oraz imię, pod którym się zapisałeś. Usuniemy Twoje dane w ciągu 30 dni. Nie trzeba mieć zainstalowanej aplikacji.</li>
</ul>

<h2>Twoje prawa</h2>
<p>Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia oraz sprzeciwu, a także prawo cofnięcia zgody. Wystarczy wiadomość na ${mail}. Możesz też wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (<a href="https://uodo.gov.pl/" rel="noopener">uodo.gov.pl</a>).</p>

<h2>Dzieci</h2>
<p>Aplikacja jest przeznaczona dla osób dorosłych: myśliwych, kandydatów na myśliwych i uczestników polowań. Nie jest kierowana do dzieci i nie zbieramy świadomie ich danych.</p>

<h2>Zmiany</h2>
<p>Gdy aplikacja zacznie zbierać coś nowego albo korzystać z nowej usługi, zmienimy tę stronę i datę na górze. Ostatnia zmiana: ${plDate(UPDATED)}</p>
</article>`,
  };
}
