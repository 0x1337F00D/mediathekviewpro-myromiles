# MediathekView Pro (my-robot Dev)

## Sackfloete fork: real programme thumbnails

This fork fixes the repeated broadcaster collage: the MediathekViewWeb API does
not provide `preview_image_url`. Programme artwork is resolved lazily from each
broadcaster's OpenGraph/Twitter metadata, with landscape cards, a bounded 24-hour
cache, request coalescing and 12 concurrent lookups. Missing/deleted pages get a
readable SVG card with the title and channel, not the same generic poster.

Page requests accept HTTPS broadcaster domains only; redirects are revalidated,
requests time out and response sizes are capped. No account credentials are used.
The unused SDK and vulnerable dependencies were removed/updated. `npm test` runs
the parser, URL-policy and SVG-escaping checks.

Run `npm ci && npm start`. Set `PUBLIC_BASE_URL` to the externally reachable base
URL behind a reverse proxy. `compose.sackfloete.yaml` deploys an unprivileged,
read-only, resource-limited container with no published host ports. Configure
Caddy `handle_path /mediathek/* { reverse_proxy mediathek-addon:7000 }` inside the
existing site's route, then install `/mediathek/manifest.json` in Stremio. The fork
uses a distinct addon ID; remove the upstream addon to avoid duplicate catalogues.

Known limitation: a deleted broadcaster page cannot supply its original artwork.
No video extraction, video re-encoding, third-party image generation or extra
metadata service is involved. Live ARD, ZDF and ARTE image resolution was verified.

Ein leistungsstarkes, selbstgehostetes Stremio-Add-on zur Wiedergabe und Durchsuchung von öffentlich-rechtlichen Mediathek-Inhalten (ARD, ZDF, ARTE u. a.) basierend auf der offiziellen MediathekViewWeb-API.

## 🚀 Features & Funktionen

- **Echte API-Anbindung**: Greift direkt auf die MediathekViewWeb-Datenbank zu statt auf statische Hardcoded-Streams.
- **Erweiterte Selektoren-Suche**: Unterstützt direkte Filter direkt in der Stremio-Suche (z. B. Sender oder Themen).
- **Kategorien & Genres**: Vorkonfigurierte Filter für Krimis, Dokumentationen, Natur & Wissen, Geschichte, Wissenschaft, Kultur, Filme/Serien und Sport.
- **Spezifische Sender-Kataloge**: Separate Reiter für Mediathek gesamt sowie dedizierte Feeds für ARD, ZDF und ARTE.
- **Robuste Stream-Auflösung**: Nutzt sicheres Base64URL-Encoding für dynamische Video-IDs und liefert hochauflösende HD-Direktstreams (`url_video_hd` / `url_video`).
- **Intelligente Fallbacks**: Automatische Poster-Erkennung mit Fallback-Bildern, falls ein Beitrag kein eigenes Vorschaubild liefert.

---

## 🛠️ Technische Architektur (`server.js`)

- **Framework**: Node.js mit Express
- **HTTP-Client**: Axios (für asynchrone API-Abfragen an `https://mediathekviewweb.de/api/query`)
- **Port**: Standardmäßig `7000` (konfigurierbar über `process.env.PORT`)
- **CORS-Unterstützung**: Vollständig aktiviert für den reibungslosen Betrieb in der Stremio Desktop-/Mobile-App.

### Wichtigste Routen:
1. `GET /manifest.json` – Add-on-Metadaten, Typen (`movie`) und definierte Kataloge samt Genre-Optionen.
2. `GET /catalog/:type/:id/:extra?.json` – Verarbeitet Katalogabfragen, liest Suchparameter und Genre-Filter aus und ruft die Mediathek-API ab.
3. `GET /meta/:type/:id.json` – Decodiert die Metadaten (Titel, Beschreibung, Poster) aus der Base64-ID.
4. `GET /stream/:type/:id.json` – Extrahiert den direkten Stream-Link und leitet ihn an den Stremio-Player weiter.

---

## 🔍 Erweiterte Such-Selektoren

In der Stremio-Suchleiste kannst du gezielte Filterzeichen verwenden, um die Ergebnisse einzuschränken:

- `!sender` -> Filtert nach Sender (z. B. `!ard`, `!zdf`, `!arte`).
- `#thema` -> Filtert nach Thema / Sendereihe (z. B. `#Tatort`, `#Lanz`).
- `+titel` -> Sucht gezielt im Titel.
- `*beschreibung` -> Durchsucht den Beschreibungstext.

*Beispiel für die Suche*: `#Tatort !ard` (Sucht nach Tatort-Episoden direkt auf ARD).

---

## 📂 Verfügbare Kategorien (`CATEGORY_MAP`)

- Krimi & Tatort
- Dokumentation
- Natur & Wissen
- Geschichte
- Wissenschaft
- Kultur & Kunst
- Filme & Serien
- Sport
- Talk & Show
- Comedy & Satire
- Nachrichten & Tagesschau

---

## 🚀 Installation & Start
Sackfloete fork: https://sackfloete.duckdns.org/mediathek/manifest.json

### Artwork (1.4.0)

- `poster`: 400×600 JPEG cover; `background`: separate 1280×720 JPEG.
- Official ZDF portrait variants are selected only for the primary programme image.
  These are broadcaster-authored crops, not necessarily dedicated movie posters.
- Without a portrait variant, the full landscape frame is retained inside a readable
  portrait layout; no arbitrary recommendation posters or face-cutting crop.
- Official ZDF/3sat corner logos; other stations use neutral text badges.
  Logo sources and trademark attribution: `logos/SOURCES.txt`.
- Lazy image processing, two simultaneous jobs, bounded 20-second wait queue,
  24 MiB output cache, 5 MiB download limit and 16 MP decode limit.
  HTTPS broadcaster allowlist, redirect revalidation and public IPv4 DNS pinning
  protect the image downloader against SSRF. Failed artwork uses a title card.
- Existing 1.3.0 item IDs and direct video streams remain compatible.

Design references (independent implementation, no copied Kodi code):
https://github.com/Nigel1992/NLZiet-Kodi-Addon/releases (aspect-ratio-aware artwork)
https://github.com/rols1/Kodi-Addon-ARDundZDF (broadcaster-specific image fields)
https://github.com/stremio/stremio-addon-sdk/blob/master/docs/api/responses/meta.md
