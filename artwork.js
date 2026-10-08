const axios = require('axios');
const sharp = require('sharp');
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');
const path = require('node:path');
const { resolveArtwork } = require('./posters');
sharp.cache({ memory: 8, files: 0, items: 16 });
sharp.concurrency(1);
const hosts = ['zdf.de', 'ardmediathek.de', 'ard.de', 'arte.tv', '3sat.de', 'tagesschau.de', 'sportschau.de', 'daserste.de', 'wdr.de', 'ndr.de', 'swr.de', 'mdr.de', 'br.de', 'hr.de', 'rbb-online.de', 'radiobremen.de', 'kika.de', 'phoenix.de'];
function safeImage(value) {
    try {
        const u = new URL(value);
        return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
    } catch { return false; }
}
function publicAddress(ip) {
    if (net.isIP(ip) !== 4) return false; // IPv4 only; reject mapped/private IPv6 too.
    const [a, b] = ip.split('.').map(Number);
    return ![0, 10, 127].includes(a) && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0)) && !(a === 198 && [18, 19].includes(b)) && a < 224;
}
const agent = new https.Agent({ keepAlive: true, maxSockets: 4, lookup(hostname, options, callback) {
    dns.lookup(hostname, { family: 4, all: true }, (error, addresses) => {
        if (error) return callback(error);
        if (!addresses.length || addresses.some(x => !publicAddress(x.address))) return callback(new Error('Non-public image host'));
        if (options.all) callback(null, addresses); else callback(null, addresses[0].address, 4);
    });
} });
async function download(url) {
    for (let i = 0; i < 4; i++) {
        if (!safeImage(url)) throw new Error('Untrusted image URL');
        const r = await axios.get(url, { httpsAgent: agent, proxy: false, timeout: 4000, maxRedirects: 0, maxContentLength: 5 * 1024 * 1024, responseType: 'arraybuffer', validateStatus: s => s === 200 || [301, 302, 303, 307, 308].includes(s) });
        if (r.status === 200) return Buffer.from(r.data);
        url = new URL(r.headers.location, url).href;
    }
    throw new Error('Image redirect limit');
}
const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function lines(title) {
    const result = [''];
    for (const word of String(title).slice(0, 160).split(/\s+/)) {
        if (result.at(-1).length + word.length > 24) result.push(word);
        else result[result.length - 1] += (result.at(-1) ? ' ' : '') + word;
    }
    return result.slice(0, 4);
}
async function badge(channel) {
    const name = String(channel).slice(0, 24).toLowerCase();
    const base = Buffer.from('<svg width="108" height="56" xmlns="http://www.w3.org/2000/svg"><rect width="108" height="56" rx="10" fill="#fff" fill-opacity=".94"/></svg>');
    if (['zdf', '3sat'].includes(name)) {
        const logo = await sharp(path.join(__dirname, 'logos', name + '.svg')).resize(86, 42, { fit: 'inside' }).png().toBuffer();
        return sharp(base).composite([{ input: logo, gravity: 'centre' }]).png().toBuffer();
    }
    return sharp(Buffer.from(`<svg width="108" height="56" xmlns="http://www.w3.org/2000/svg"><rect width="108" height="56" rx="10" fill="#fff" fill-opacity=".94"/><text x="54" y="34" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${name.length > 9 ? 12 : 19}" fill="#14243d">${xml(name.toUpperCase())}</text></svg>`)).png().toBuffer();
}
async function compose(image, portrait, title, channel, format) {
    const cover = format === 'cover';
    const width = cover ? 400 : 1280, height = cover ? 600 : 720;
    const overlays = [];
    let canvas = sharp({ create: { width, height, channels: 3, background: '#14243d' } });
    const options = { limitInputPixels: 16000000, animated: false };
    if (image) {
        if (!cover || portrait) {
            const photo = await sharp(image, options).rotate().resize(width, cover ? 450 : height, { fit: 'cover' }).toBuffer();
            overlays.push({ input: photo, left: 0, top: 0 });
        } else {
            // Preserve the complete landscape frame, rather than cut off faces.
            const backdrop = await sharp(image, options).rotate().resize(width, height, { fit: 'cover' }).blur(18).modulate({ brightness: 0.45 }).toBuffer();
            overlays.push({ input: backdrop, left: 0, top: 0 });
            const photo = await sharp(image, options).rotate().resize(width, 280, { fit: 'inside' }).toBuffer();
            const size = await sharp(photo).metadata();
            overlays.push({ input: photo, left: Math.round((width - size.width) / 2), top: 120 });
        }
    }
    if (cover) {
        const text = `<svg width="400" height="160" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="160" fill="#14243d" fill-opacity=".95"/><text font-family="sans-serif" font-size="23" font-weight="bold" fill="white">${lines(title).map((l, i) => `<tspan x="22" y="${35 + i * 29}">${xml(l)}</tspan>`).join('')}</text></svg>`;
        overlays.push({ input: Buffer.from(text), left: 0, top: 440 });
    }
    overlays.push({ input: await badge(channel), left: width - 124, top: 16 });
    return canvas.composite(overlays).jpeg({ quality: cover ? 82 : 80, mozjpeg: true }).toBuffer();
}
const cache = new Map(), pending = new Map();
let bytes = 0, active = 0;
const waiters = [];
async function acquire() {
    if (active < 2) { active++; return true; }
    if (waiters.length >= 100) return false;
    return new Promise(resolve => {
        const entry = { resolve, timer: null };
        entry.timer = setTimeout(() => { const index = waiters.indexOf(entry); if (index >= 0) waiters.splice(index, 1); resolve(false); }, 20000);
        waiters.push(entry);
    });
}
function release() {
    const next = waiters.shift();
    if (next) { clearTimeout(next.timer); next.resolve(true); } else active--;
}
async function renderArtwork(page, title, channel, format) {
    const key = JSON.stringify([page, title, channel, format]);
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.buffer;
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
        // Bounded queue and two native image tasks protect the small production VM.
        if (!await acquire()) return null;
        try {
        const art = await resolveArtwork(page);
        let portrait = format === 'cover' && art?.portrait;
        let image = null;
        try {
            if (portrait || art?.landscape) {
                const source = portrait || art.landscape;
                image = await download(source.replace(/~1920x1080/, '~1280x720'));
            }
        } catch {
            if (portrait && art?.landscape) {
                portrait = false;
                try { image = await download(art.landscape.replace(/~1920x1080/, '~1280x720')); } catch {}
            }
        }
        const buffer = await compose(image, Boolean(portrait && image), title, channel, format);
        if (hit) { bytes -= hit.buffer.length; cache.delete(key); }
        while (cache.size && bytes + buffer.length > 24 * 1024 * 1024) {
            const first = cache.keys().next().value;
            bytes -= cache.get(first).buffer.length; cache.delete(first);
        }
        cache.set(key, { buffer, until: Date.now() + (image ? 86400000 : 60000) }); bytes += buffer.length;
        return buffer;
        } finally { release(); }
    })().finally(() => { pending.delete(key); });
    pending.set(key, job);
    return job;
}
module.exports = { renderArtwork, compose, safeImage, publicAddress };
