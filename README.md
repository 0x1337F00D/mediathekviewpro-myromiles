# MediathekView Pro (my-robot Dev)

Ein leistungsstarkes, selbstgehostetes Stremio-Addon zur Wiedergabe und Durchsuchung von öffentlich-rechtlichen Mediathek-Inhalten (ARD, ZDF, ARTE u. a.) basierend auf der offiziellen MediathekViewWeb-API.

## 🚀 Features & Funktionen

* **Echte API-Anbindung:** Greift direkt auf die MediathekViewWeb-Datenbank zu statt auf statische Hardcoded-Streams.
* **Erweiterte Selektoren-Suche:** Unterstützt direkte Filter direkt in der Stremio-Suche (z. B. Sender oder Themen).
* **Kategorien & Genres:** Vorkonfigurierte Filter für Krimis, Dokumentationen, Natur & Wissen, Geschichte, Wissenschaft, Kultur, Filme/Serien und Sport.
* **Spezifische Sender-Kataloge:** Separate Reiter für Mediathek gesamt sowie dedizierte Feeds für ARD, ZDF und ARTE.
* **Robuste Stream-Auflösung:** Nutzt sicheres Base64URL-Encoding für dynamische Video-IDs und liefert hochauflösende HD-Direktstreams (`url_video_hd` / `url_video`).
* **Intelligente Fallbacks:** Automatische Poster-Erkennung mit Base64-SVG-Fallbacks, falls ein Beitrag kein eigenes Vorschaubild liefert.

---

## 🛠️ Technische Architektur (`server.js`)

* **Framework:** Node.js mit Express
* **HTTP-Client:** Axios (für asynchrone API-Abfragen an `https://mediathekviewweb.de/api/query`)
* **Port:** Standardmäßig `7000` (konfigurierbar über `process.env.PORT`)
* **CORS-Unterstützung:** Vollständig aktiviert für den reibungslosen Betrieb in der Stremio Desktop-/Mobile-App.

### Wichtigste Routen:
1. `GET /manifest.json` – Addon-Metadaten, Typen (`movie`) und definierte Kataloge samt Genre-Optionen.
2. `GET /catalog/:type/:id/:extra?.json` – Verarbeitet Katalogabfragen, liest Suchparameter und Genre-Filter aus und ruft die Mediathek-API ab.
3. `GET /meta/:type/:id.json` – Decodiert die Metadaten (Titel, Beschreibung, Poster) aus der Base64-ID.
4. `GET /stream/:type/:id.json` – Extrahiert den direkten Stream-Link und leitet ihn an den Stremio-Player weiter.

---

## 🔍 Erweiterte Such-Selektoren

In der Stremio-Suchleiste kannst du gezielte Filterzeichen verwenden, um die Ergebnisse einzuschränken:

* **`!sender`** $\rightarrow$ Filtert nach Sender (z. B. `!ard`, `!zdf`, `!arte`).
* **`#thema`** $\rightarrow$ Filtert nach Thema / Sendereihe (z. B. `#Tatort`, `#Lanz`).
* **`+titel`** $\rightarrow$ Sucht gezielt im Titel.
* **`*beschreibung`** $\rightarrow$ Durchsucht den Beschreibungstext.

*Beispiel für die Suche:* `#Tatort !ard` (Sucht nach Tatort-Epochen direkt auf ARD).

---

## 📂 Verfügbare Kategorien (`CATEGORY_MAP`)

* Krimi & Tatort
* Dokumentation
* Natur & Wissen
* Geschichte
* Wissenschaft
* Kultur & Kunst
* Filme & Serien
* Sport
* Talk & Show
* Comedy & Satire

---

## 🚀 Installation & Start

1. Stelle sicher, dass Node.js und die benötigten Pakete (`express`, `axios`) installiert sind:
   ```bash
   npm install express axios