const { test } = require('node:test');
const assert = require('node:assert/strict');
const { safePage, extractImage, extractArtwork, titleCard } = require('./posters');
const { compose, safeImage, publicAddress } = require('./artwork');
const sharp = require('sharp');
test('only HTTPS broadcaster pages, no internal URLs or credentials', () => {
    assert.ok(safePage('https://www.zdf.de/video/foo'));
    for (const url of ['http://www.zdf.de/a', 'https://127.0.0.1/a', 'https://zdf.de.evil.com/a', 'https://evilzdf.de/a', 'https://user:pw@zdf.de/a', 'https://zdf.de:8443/a']) assert.equal(safePage(url), false, url);
});
test('only the primary ZDF image supplies portrait variants', () => {
    const page = 'https://www.zdf.de/video/a';
    const html = '<meta property="og:image" content="https://www.zdf.de/assets/main~1920x1080?cb=1"><img src="https://www.zdf.de/assets/main~640x720?cb=1"><img src="https://www.zdf.de/assets/unrelated~600x900?cb=2">';
    assert.deepEqual(extractArtwork(html, page), { landscape: 'https://www.zdf.de/assets/main~1920x1080?cb=1', portrait: 'https://www.zdf.de/assets/main~640x720?cb=1' });
    assert.equal(extractArtwork('<meta property="og:image" content="https://www.zdf.de/assets/main~1920x1080">', page).portrait, null);
});
test('image downloads only allow public broadcaster destinations', () => {
    assert.ok(safeImage('https://api-cdn.arte.tv/img/a'));
    for (const url of ['http://zdf.de/a', 'https://evil.com/a', 'https://zdf.de.evil.com/a', 'https://user@zdf.de/a', 'https://zdf.de:7000/a']) assert.equal(safeImage(url), false);
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.31.53.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(publicAddress(ip), false);
    assert.ok(publicAddress('8.8.8.8'));
});
test('cover and background are separate bounded JPEGs with station badges', async () => {
    const image = await sharp({ create: { width: 800, height: 450, channels: 3, background: '#ff0000' } }).png().toBuffer();
    for (const channel of ['ZDF', '3sat', '<evil>']) {
        const cover = await compose(image, false, 'Eine Sendung & ein Test', channel, 'cover');
        const background = await compose(image, false, 'Eine Sendung', channel, 'background');
        const c = await sharp(cover).metadata(), b = await sharp(background).metadata();
        assert.deepEqual([c.width, c.height, c.format], [400, 600, 'jpeg']);
        assert.deepEqual([b.width, b.height, b.format], [1280, 720, 'jpeg']);
        assert.ok(cover.length < 100000); assert.ok(background.length < 500000);
    }
});
test('OpenGraph supports attribute order, entities and relative URLs', () => {
    assert.equal(extractImage('<meta content="/image.jpg?a=1&amp;b=2" property="og:image"/>', 'https://www.zdf.de/a'), 'https://www.zdf.de/image.jpg?a=1&b=2');
    assert.equal(extractImage("<meta name='twitter:image' content='https://images.arte.tv/foo.jpg'>", 'https://arte.tv'), 'https://images.arte.tv/foo.jpg');
    assert.equal(extractImage('<meta property="og:image" content="javascript:alert(1)">', 'https://zdf.de'), null);
});
test('fallback is readable and escapes untrusted text', () => {
    const svg = titleCard('<script> & "test"', 'ZDF');
    assert.ok(svg.includes('&lt;script&gt;')); assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('ZDF'));
});
