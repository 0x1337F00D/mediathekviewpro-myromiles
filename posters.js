const axios = require('axios');
const ALLOWED = ['zdf.de', 'ardmediathek.de', 'arte.tv', '3sat.de', 'phoenix.de', 'wdr.de', 'ndr.de', 'swr.de', 'mdr.de', 'br.de', 'hr.de', 'rbb-online.de', 'radiobremen.de', 'kika.de', 'tagesschau.de', 'sportschau.de', 'daserste.de'];
const cache = new Map();
const pending = new Map();
let active = 0;
const waiters = [];

function safePage(value) {
    try {
        const u = new URL(value);
        return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && ALLOWED.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
    } catch { return false; }
}
function unescape(value) {
    return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : '');
}
function extractImage(html, page) {
    for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
        const attrs = {};
        for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)) attrs[m[1].toLowerCase()] = unescape(m[3]);
        if (!['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes((attrs.property || attrs.name || '').toLowerCase()) || !attrs.content) continue;
        try {
            const image = new URL(attrs.content, page);
            if (image.protocol === 'https:' && !image.username && !image.password) return image.href;
        } catch {}
    }
    return null;
}
async function fetchImage(page) {
    for (let i = 0; i < 4; i++) {
        if (!safePage(page)) return null;
        const r = await axios.get(page, { timeout: 4000, maxRedirects: 0, maxContentLength: 2 * 1024 * 1024, responseType: 'text', proxy: false, validateStatus: s => s === 200 || [301, 302, 303, 307, 308].includes(s), headers: { 'User-Agent': 'MediathekView-Sackfloete/1.3 (+https://github.com/0x1337F00D/mediathekviewpro-myromiles)', Accept: 'text/html' } });
        if (r.status === 200) return extractImage(r.data, page);
        page = new URL(r.headers.location, page).href;
    }
    return null;
}
async function resolveImage(page) {
    if (!safePage(page)) return null;
    const hit = cache.get(page);
    if (hit && hit.until > Date.now()) return hit.image;
    if (pending.has(page)) return pending.get(page);
    // Bound outgoing requests; a cold catalog must not overwhelm broadcasters.
    if (active >= 12 && waiters.length >= 128) return null;
    const slot = active < 12 ? (active++, Promise.resolve()) : new Promise(resolve => waiters.push(resolve));
    const request = slot.then(() => fetchImage(page)).catch(() => null).then(image => {
        if (cache.size >= 2000) cache.delete(cache.keys().next().value);
        cache.set(page, { image, until: Date.now() + (image ? 86400000 : 60000) });
        return image;
    }).finally(() => {
        const next = waiters.shift();
        if (next) next(); else active--;
        pending.delete(page);
    });
    pending.set(page, request);
    return request;
}
const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function titleCard(title, channel) {
    const lines = [];
    for (const word of String(title).slice(0, 240).split(/\s+/)) {
        if (!lines.length || (lines.at(-1).length + word.length > 32)) lines.push(word);
        else lines[lines.length - 1] += ' ' + word;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" rx="18" fill="#14243d"/><rect x="32" y="34" width="6" height="40" fill="#28c8e0"/><text x="54" y="62" font-family="sans-serif" font-size="24" fill="#28c8e0">${xml(String(channel).slice(0, 40))}</text><text font-family="sans-serif" font-size="28" font-weight="bold" fill="white">${lines.slice(0, 5).map((s, i) => `<tspan x="36" y="${122 + i * 39}">${xml(s)}</tspan>`).join('')}</text></svg>`;
}
module.exports = { safePage, extractImage, resolveImage, titleCard };
