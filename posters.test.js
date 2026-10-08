const { test } = require('node:test');
const assert = require('node:assert/strict');
const { safePage, extractImage, titleCard } = require('./posters');
test('only HTTPS broadcaster pages, no internal URLs or credentials', () => {
    assert.ok(safePage('https://www.zdf.de/video/foo'));
    for (const url of ['http://www.zdf.de/a', 'https://127.0.0.1/a', 'https://zdf.de.evil.com/a', 'https://evilzdf.de/a', 'https://user:pw@zdf.de/a', 'https://zdf.de:8443/a']) assert.equal(safePage(url), false, url);
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
