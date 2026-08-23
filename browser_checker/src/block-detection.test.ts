import assert from 'node:assert/strict';
import { isBotBlocked, hasChallengeMarker, describeBlock } from './block-detection';

// Plain successful pages are not blocks.
assert.equal(isBotBlocked({ status: 200, title: 'GitHub', bodyText: 'Where the world builds software' }), false);
assert.equal(isBotBlocked({ status: 301, title: '' }), false);
assert.equal(isBotBlocked({ status: 500, title: 'Internal Server Error' }), false);
assert.equal(isBotBlocked({ status: 503, title: 'Service Unavailable', bodyText: 'We will be back soon' }), false);

// Status-only blocks.
assert.equal(isBotBlocked({ status: 403 }), true);
assert.equal(isBotBlocked({ status: 429, title: 'Too Many Requests' }), true);

// 503 only counts with a marker (Cloudflare's challenge is a 503).
assert.equal(isBotBlocked({ status: 503, title: 'Just a moment...' }), true);

// Marker-only blocks (challenges served with HTTP 200).
assert.equal(isBotBlocked({ status: 200, title: 'Attention Required! | Cloudflare' }), true);
assert.equal(isBotBlocked({ status: 200, title: 'Google', bodyText: 'Our systems have detected unusual traffic from your computer network.' }), true);
assert.equal(isBotBlocked({ status: 200, title: 'Access Denied' }), true);
assert.equal(isBotBlocked({ status: 200, bodyText: 'Pardon Our Interruption... As you were browsing something about your browser made us think you were a bot.' }), true);
assert.equal(isBotBlocked({ status: 200, bodyText: 'Reference #18.2f3a1b4c.1700000000.abcdef' }), true);
assert.equal(isBotBlocked({ status: 200, bodyText: 'Request blocked. We can\'t connect to the server for this app or website at this time.' }), true);
assert.equal(isBotBlocked({ status: 200, bodyText: 'Please complete the CAPTCHA below' }), true);

// Word boundary: "captcha" inside an unrelated word does not fire.
assert.equal(hasChallengeMarker('recaptchaless'), false);

assert.equal(describeBlock(403), 'Bot challenge (HTTP 403)');
assert.equal(describeBlock(), 'Bot challenge');

console.log('block-detection: all assertions passed');
