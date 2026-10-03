const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 7000;

// Statische Dateien (wie icon.svg) aus dem aktuellen Verzeichnis ausliefern
app.use(express.static(__dirname));

// Erweiterte Kategorie-Mappings
const CATEGORY_MAP = {
    "Krimi & Tatort": "Tatort",
    "Dokumentation": "Doku",
    "Natur & Wissen": "Natur",
    "Geschichte": "Geschichte",
    "Wissenschaft": "Wissenschaft",
    "Kultur & Kunst": "Kultur",
    "Filme & Serien": "Film",
    "Sport": "Sport",
    "Talk & Show": "Lanz",
    "Comedy & Satire": "heute-show"
};

// Fallback Poster, falls ein Beitrag kein Bild liefert
const FALLBACK_POSTER = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjAiIGZpbGw9IiMwZjE3MmEiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLCAxMCkgZmlsbD0iIzIyYzU1ZSI+PHBhdGggZD0iTTI1Niw2MCBDMjcwLDE0MCAzMTAsMjEwIDM4MCwyNDAgQzMxMCwyNTAgMjg1LDI5MCAyNzUsMzYwIEMyNjUsMzEwIDI2MCwyOTAgMjM3LDM2MCBDMjI3LDI5MCAyMDIsMjUwIDEzMjLDI0MCBDMjAyLDIxMCAyNDIsMTQwIDI1Niw2MCBaIj48L2c+PC9zdmc=";

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
});

// Hilfsfunktion: Erkennt Selektoren wie !sender, #thema, >dauer im Suchtext
function parseAdvancedQuery(searchQuery, defaultGenre, defaultChannel) {
    let queries = [];
    let cleanTerms = [];

    if (searchQuery && searchQuery.trim() !== "") {
        const parts = searchQuery.trim().split(/\s+/);
        
        let currentField = ["title", "description", "topic"];
        let currentText = [];

        for (let part of parts) {
            if (part.startsWith("!")) {
                if (currentText.length > 0) {
                    queries.push({ fields: currentField, query: currentText.join(" ") });
                    currentText = [];
                }
                queries.push({ fields: ["channel"], query: part.substring(1).toLowerCase() });
            } else if (part.startsWith("#")) {
                if (currentText.length > 0) {
                    queries.push({ fields: currentField, query: currentText.join(" ") });
                    currentText = [];
                }
                queries.push({ fields: ["topic"], query: part.substring(1) });
            } else if (part.startsWith("+")) {
                if (currentText.length > 0) {
                    queries.push({ fields: currentField, query: currentText.join(" ") });
                    currentText = [];
                }
                queries.push({ fields: ["title"], query: part.substring(1) });
            } else if (part.startsWith("*")) {
                if (currentText.length > 0) {
                    queries.push({ fields: currentField, query: currentText.join(" ") });
                    currentText = [];
                }
                queries.push({ fields: ["description"], query: part.substring(1) });
            } else {
                currentText.push(part);
            }
        }
        if (currentText.length > 0) {
            queries.push({ fields: ["title", "description", "topic"], query: currentText.join(" ") });
        }
    } else {
        // Fallback über Genre-Mapping oder Standard
        const searchTerm = (defaultGenre && CATEGORY_MAP[defaultGenre]) ? CATEGORY_MAP[defaultGenre] : "";
        if (searchTerm) {
            queries.push({ fields: ["title", "topic"], query: searchTerm });
        }
    }

    // Sender aus dem Katalog-Kontext hinzufügen, falls nicht per ! überschrieben
    if (defaultChannel && defaultChannel !== "all" && defaultChannel !== "neueste") {
        const hasChannelQuery = queries.some(q => q.fields.includes("channel"));
        if (!hasChannelQuery) {
            queries.push({ fields: ["channel"], query: defaultChannel.toLowerCase() });
        }
    }

    if (queries.length === 0) {
        queries.push({ fields: ["title"], query: "a" });
    }

    return queries;
}

async function fetchItems(genre, channel, searchQuery) {
    const queries = parseAdvancedQuery(searchQuery, genre, channel);

    try {
        const res = await axios.post("https://mediathekviewweb.de/api/query", {
            queries: queries,
            sortBy: "timestamp",
            sortOrder: "desc",
            size: 60
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 8000
        });
        
        return res.data?.result?.results || [];
    } catch (e) {
        console.error("Mediathek API Fehler:", e.message);
        return [];
    }
}

app.get("/manifest.json", (req, res) => {
    res.json({
        id: "org.mediathek.myrobotdev",
        version: "2.2.0",
        name: "MediathekView Pro (my-robot Dev)",
        description: "Öffentlich-rechtliche Mediatheken mit erweiterten Selektoren (!Sender, #Thema)",
        icon: "http://localhost:7000/icon.svg",
        resources: ["catalog", "meta", "stream"],
        types: ["movie"],
        catalogs: [
            { 
                type: "movie", 
                id: "mediathek_search", 
                name: "🔍 Mediathek: Erweiterte Suche", 
                extra: [
                    { name: "search", isRequired: true }
                ] 
            },
            { 
                type: "movie", 
                id: "mediathek_neueste", 
                name: "Mediathek: Neueste Inhalte", 
                extra: [
                    { name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }
                ] 
            },
            { 
                type: "movie", 
                id: "mediathek_ard", 
                name: "ARD: Neueste Beiträge", 
                extra: [
                    { name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }
                ] 
            },
            { 
                type: "movie", 
                id: "mediathek_zdf", 
                name: "ZDF: Neueste Beiträge", 
                extra: [
                    { name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }
                ] 
            },
            { 
                type: "movie", 
                id: "mediathek_arte", 
                name: "ARTE: Neueste Beiträge", 
                extra: [
                    { name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }
                ] 
            }
        ]
    });
});

app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
    const catalogId = req.params.id;
    let channel = "all";
    if (catalogId.includes("ard")) channel = "ard";
    else if (catalogId.includes("zdf")) channel = "zdf";
    else if (catalogId.includes("arte")) channel = "arte";

    let searchQuery = "";
    const extraPath = req.params.extra || "";
    
    if (extraPath.includes("search=")) {
        const parts = extraPath.split("&");
        for (const part of parts) {
            if (part.startsWith("search=")) {
                searchQuery = decodeURIComponent(part.replace("search=", ""));
            }
        }
    }
    
    if (!searchQuery && req.query.search) {
        searchQuery = decodeURIComponent(req.query.search);
    }

    if (!searchQuery && req.url.includes("search=")) {
        const match = req.url.match(/search=([^&]+)/);
        if (match) {
            searchQuery = decodeURIComponent(match[1].replace(".json", ""));
        }
    }

    const genre = req.query.genre ? decodeURIComponent(req.query.genre) : "";
    const items = await fetchItems(genre, channel, searchQuery);

    res.json({
        metas: items.map(i => {
            const videoUrl = i.url_video_hd || i.url_video || "";
            let imgUrl = i.preview_image_url || i.thumbnailUrl || i.small_thumbnail_url || "";
            if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl;
            const poster = imgUrl || FALLBACK_POSTER;

            const encodedId = Buffer.from(JSON.stringify({
                url: videoUrl,
                title: i.title || "Unbekannter Titel",
                description: `[${i.channel}] ${i.topic}\n\n${i.description || "Keine Beschreibung verfügbar."}`,
                poster: poster
            })).toString("base64url");

            return {
                id: "mvw:" + encodedId,
                type: "movie",
                name: i.title || "Unbekannter Titel",
                poster: poster,
                background: poster,
                description: `[${i.channel}] ${i.topic}\n\n${i.description || "Keine Beschreibung verfügbar."}`
            };
        })
    });
});

app.get("/meta/:type/:id.json", (req, res) => {
    try {
        const cleanId = req.params.id.name ? req.params.id : req.params.id.replace("mvw:", "").replace(".json", "");
        // Fallback robust decoding
        const decoded = JSON.parse(Buffer.from(req.params.id.replace("mvw:", "").replace(".json", ""), "base64url").toString("utf-8"));
        res.json({
            meta: {
                id: req.params.id,
                type: "movie",
                name: decoded.title,
                poster: decoded.poster,
                background: decoded.poster,
                description: decoded.description
            }
        });
    } catch (e) {
        res.json({ meta: { id: req.params.id, type: "movie", name: "Mediathek Stream", poster: FALLBACK_POSTER } });
    }
});

app.get("/stream/:type/:id.json", (req, res) => {
    try {
        const cleanId = req.params.id.replace("mvw:", "").replace(".json", "");
        const decoded = JSON.parse(Buffer.from(cleanId, "base64url").toString("utf-8"));
        res.json({ streams: [{ url: decoded.url, title: "Direktstream (HD)" }] });
    } catch (e) {
        res.json({ streams: [] });
    }
});

app.listen(PORT, () => console.log(`Server "my-robot Dev" läuft auf Port ${PORT}`));