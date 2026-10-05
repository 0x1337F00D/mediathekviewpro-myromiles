const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 7000;

app.use(express.static(__dirname));

// Fängt den Root-Aufruf ab und leitet informativ weiter
app.get("/", (req, res) => {
    res.send('MediathekView DE Stremio Add-on läuft! Füge <a href="/manifest.json">/manifest.json</a> in Stremio ein.');
});

const CATEGORY_MAP = {
    "Filme": "Film",
    "Serien": "Serie",
    "Krimi & Tatort": "Tatort",
    "Dokumentation": "Doku",
    "Natur & Wissen": "Natur",
    "Geschichte": "Geschichte",
    "Wissenschaft": "Wissenschaft",
    "Kultur & Kunst": "Kultur",
    "Sport": "Sport",
    "Talk & Show": "Talk",
    "Comedy & Satire": "Satire",
    "Nachrichten": "Nachrichten",
    "Tagesschau": "Tagesschau"
};

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
});

function parseAdvancedQuery(searchQuery, defaultGenre, defaultChannel) {
    let queries = [];

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
        const searchTerm = (defaultGenre && CATEGORY_MAP[defaultGenre]) ? CATEGORY_MAP[defaultGenre] : "";
        if (searchTerm) {
            if (defaultGenre === "Krimi & Tatort") {
                queries.push({ fields: ["title", "topic"], query: "Tatort" });
            } else {
                queries.push({ fields: ["title", "topic"], query: searchTerm });
            }
        }
    }

    if (defaultChannel && defaultChannel !== "all") {
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
            size: 100
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 10000
        });
        
        let results = res.data?.result?.results || [];

        results = results.filter(i => {
            const url = (i.url_video_hd || i.url_video || "").toLowerCase();
            if (i.channel && i.channel.toLowerCase() === "arte" && (url.includes("arte.fr") || url.includes("/fr/"))) {
                return false;
            }
            return true;
        });

        return results;
    } catch (e) {
        console.error("Mediathek API Fehler:", e.message);
        return [];
    }
}

app.get("/manifest.json", (req, res) => {
    const host = req.get("host");
    const protocol = req.protocol;
    const iconUrl = `${protocol}://${host}/icon.svg`;

    res.json({
        id: "org.mediathek.deutschland",
        version: "1.2.3",
        name: "MediathekView DE (Erweitert)",
        description: "Alle deutschen ÖR-Sender mit erhöhter Anzahl an Inhalten",
        icon: iconUrl,
        contactEmail: "myesil1978@gmail.com",
        stremioAddonsConfig: {
            issuer: "https://stremio-addons.net",
            signature: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..PH19_69BDe7Tr2hNz8J__g.ykkMo5Yvf3xVF0r11phJQj8PJYH0fupwL99BEP1kYbDDCbn8CNIl1BHUjVRaJNjZqRmii-COG5zyZWakYqx47XNAeDluvpF8oFAhz2lS5WRXa2RrjfMEa_nqcJvLMQ70.5LGu9u7qwCCHxuZQ7pEdZQ"
        },
        resources: ["catalog", "meta", "stream"],
        types: ["movie"],
        catalogs: [
            { 
                type: "movie", 
                id: "de_search", 
                name: "🔍 Mediathek: Erweiterte Suche", 
                extra: [{ name: "search", isRequired: true }] 
            },
            { type: "movie", id: "de_ard", name: "ARD: Neueste Beiträge" },
            { type: "movie", id: "de_zdf", name: "ZDF: Neueste Beiträge" },
            { type: "movie", id: "de_arte", name: "ARTE (DE): Neueste Beiträge" },
            { type: "movie", id: "de_3sat", name: "3sat" },
            { type: "movie", id: "de_phoenix", name: "Phoenix Neueste Beiträge" },
            { type: "movie", id: "de_wdr", name: "WDR Neueste Beiträge" },
            { type: "movie", id: "de_ndr", name: "NDR Neueste Beiträge" },
            { type: "movie", id: "de_swr", name: "SWR Neueste Beiträge" },
            { type: "movie", id: "de_mdr", name: "MDR Neueste Beiträge" },
            { type: "movie", id: "de_br", name: "BR Neueste Beiträge" },
            { type: "movie", id: "de_hr", name: "HR Neueste Beiträge" },
            { type: "movie", id: "de_rbb", name: "RBB Neueste Beiträge" },
            { type: "movie", id: "de_radiobremen", name: "Radio Bremen" },
            { type: "movie", id: "de_zdfinfo", name: "ZDFinfo Neueste Beiträge" },
            { type: "movie", id: "de_zdfneo", name: "ZDFneo Neueste Beiträge" },
            { type: "movie", id: "de_kika", name: "KiKA Neueste Beiträge" },
            { type: "movie", id: "cat_filme", name: "🎬 Filme" },
            { type: "movie", id: "cat_serien", name: "📺 Serien" },
            { type: "movie", id: "cat_krimi", name: "🔫 Krimi & Tatort" },
            { type: "movie", id: "cat_doku", name: "🌍 Dokumentation" },
            { type: "movie", id: "cat_natur", name: "🌿 Natur & Wissen" },
            { type: "movie", id: "cat_geschichte", name: "📜 Geschichte" },
            { type: "movie", id: "cat_wissenschaft", name: "🔬 Wissenschaft" },
            { type: "movie", id: "cat_kultur", name: "🎨 Kultur & Kunst" },
            { type: "movie", id: "cat_sport", name: "⚽ Sport" },
            { type: "movie", id: "cat_talk", name: "💬 Talk & Show" },
            { type: "movie", id: "cat_comedy", name: "🎤 Comedy & Satire" },
            { type: "movie", id: "cat_nachrichten", name: "📰 Nachrichten & Tagesschau" }
        ]
    });
});

app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
    const host = req.get("host");
    const protocol = req.protocol;
    const fallbackPoster = `${protocol}://${host}/background.jpg`;

    const catalogId = req.params.id;
    let channel = "all";
    let genre = "";

    if (catalogId === "de_ard") channel = "ard";
    else if (catalogId === "de_zdf") channel = "zdf";
    else if (catalogId === "de_arte") channel = "arte";
    else if (catalogId === "de_3sat") channel = "3sat";
    else if (catalogId === "de_phoenix") channel = "phoenix";
    else if (catalogId === "de_wdr") channel = "wdr";
    else if (catalogId === "de_ndr") channel = "ndr";
    else if (catalogId === "de_swr") channel = "swr";
    else if (catalogId === "de_mdr") channel = "mdr";
    else if (catalogId === "de_br") channel = "br";
    else if (catalogId === "de_hr") channel = "hr";
    else if (catalogId === "de_rbb") channel = "rbb";
    else if (catalogId === "de_radiobremen") channel = "radio bremen";
    else if (catalogId === "de_zdfinfo") channel = "zdfinfo";
    else if (catalogId === "de_zdfneo") channel = "zdfneo";
    else if (catalogId === "de_kika") channel = "kika";

    if (catalogId.includes("filme")) genre = "Filme";
    else if (catalogId.includes("serien")) genre = "Serien";
    else if (catalogId.includes("krimi")) genre = "Krimi & Tatort";
    else if (catalogId.includes("doku")) genre = "Dokumentation";
    else if (catalogId.includes("natur")) genre = "Natur & Wissen";
    else if (catalogId.includes("geschichte")) genre = "Geschichte";
    else if (catalogId.includes("wissenschaft")) genre = "Wissenschaft";
    else if (catalogId.includes("kultur")) genre = "Kultur & Kunst";
    else if (catalogId.includes("sport")) genre = "Sport";
    else if (catalogId.includes("talk")) genre = "Talk & Show";
    else if (catalogId.includes("comedy")) genre = "Comedy & Satire";
    else if (catalogId.includes("nachrichten")) genre = "Nachrichten";

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

    if (!genre && req.query.genre) {
        genre = decodeURIComponent(req.query.genre);
    }

    const items = await fetchItems(genre, channel, searchQuery);

    const metas = items.map(i => {
        const videoUrl = i.url_video_hd || i.url_video || "";
        
        let poster = i.preview_image_url || "";
        if (poster.startsWith("//")) poster = "https:" + poster;

        if (!poster) {
            poster = fallbackPoster;
        }

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
    });

    res.json({ metas });
});

app.get("/meta/:type/:id.json", (req, res) => {
    const host = req.get("host");
    const protocol = req.protocol;
    const fallbackPoster = `${protocol}://${host}/background.jpg`;

    try {
        const cleanId = req.params.id.replace("mvw:", "").replace(".json", "");
        const decoded = JSON.parse(Buffer.from(cleanId, "base64url").toString("utf-8"));
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
        res.json({ meta: { id: req.params.id, type: "movie", name: "Mediathek Stream", poster: fallbackPoster } });
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

app.listen(PORT, () => console.log(`Server "MediathekView DE" läuft auf Port ${PORT}`));
