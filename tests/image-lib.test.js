'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/image-lib.js');

test('checkFile: accepts PNG, JPEG, WebP within the size limit', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) assert.deepEqual(I.checkFile({ type, size: 1000, name: 'a' }), { ok: true });
});

test('checkFile: rejects SVG, GIF, other types, empty and oversized files', () => {
  assert.equal(I.checkFile({ type: 'image/svg+xml', size: 100, name: 'a.svg' }).ok, false);
  assert.equal(I.checkFile({ type: '', size: 100, name: 'sneaky.svg' }).ok, false);
  assert.equal(I.checkFile({ type: 'image/png', size: 100, name: 'actually.svg' }).ok, false);
  assert.equal(I.checkFile({ type: 'image/gif', size: 100, name: 'a.gif' }).ok, false);
  assert.equal(I.checkFile({ type: 'application/pdf', size: 100, name: 'a.pdf' }).ok, false);
  assert.equal(I.checkFile({ type: 'image/png', size: 0, name: 'a.png' }).ok, false);
  assert.equal(I.checkFile({ type: 'image/png', size: I.LIMITS.maxBytes + 1, name: 'a.png' }).ok, false);
  assert.equal(I.checkFile({ type: 'image/png', size: I.LIMITS.maxBytes, name: 'a.png' }).ok, true);
  assert.equal(I.checkFile(null).ok, false);
  assert.match(I.checkFile({ type: 'image/gif', size: 1, name: 'a' }).error, /PNG, JPEG or WebP/);
});

test('checkDimensions: bounds, integers and the pixel cap', () => {
  assert.equal(I.checkDimensions(512, 512).ok, true);
  assert.equal(I.checkDimensions(127, 500).ok, false);
  assert.equal(I.checkDimensions(500, 127).ok, false);
  assert.equal(I.checkDimensions(0, 0).ok, false);
  assert.equal(I.checkDimensions(-5, 500).ok, false);
  assert.equal(I.checkDimensions(NaN, 500).ok, false);
  assert.equal(I.checkDimensions(10000, 5000).ok, true);      // exactly 50 MP
  assert.equal(I.checkDimensions(10001, 5000).ok, false);
});

test('cropSquare: centred square from landscape, portrait and square sources', () => {
  assert.deepEqual(I.cropSquare(1000, 500), { sx: 250, sy: 0, side: 500 });
  assert.deepEqual(I.cropSquare(500, 1000), { sx: 0, sy: 250, side: 500 });
  assert.deepEqual(I.cropSquare(640, 640), { sx: 0, sy: 0, side: 640 });
  assert.deepEqual(I.cropSquare(1001, 500), { sx: 250, sy: 0, side: 500 });   // odd difference rounds down
});

test('dataUrlToBase64: only a JPEG data URL is accepted', () => {
  assert.equal(I.dataUrlToBase64('data:image/jpeg;base64,/9j/AAAA'), '/9j/AAAA');
  assert.equal(I.dataUrlToBase64('data:image/png;base64,AAAA'), null);
  assert.equal(I.dataUrlToBase64('data:text/html;base64,PHNjcmlwdD4='), null);
  assert.equal(I.dataUrlToBase64('https://x/y.jpg'), null);
  assert.equal(I.dataUrlToBase64('data:image/jpeg;base64,not base64!'), null);
  assert.equal(I.dataUrlToBase64(null), null);
});

test('base64Bytes: decoded size from a base64 string', () => {
  assert.equal(I.base64Bytes('QQ=='), 1);
  assert.equal(I.base64Bytes('QUI='), 2);
  assert.equal(I.base64Bytes('QUJD'), 3);
  assert.equal(I.base64Bytes(''), 0);
});

test('chooseQuality: highest quality that fits, steps down, reports when nothing fits', () => {
  const sizes = { 0.86: 200_000, 0.8: 160_000, 0.74: 140_000, 0.68: 120_000, 0.6: 100_000 };
  const enc = q => sizes[q];
  assert.deepEqual(I.chooseQuality(enc, 150_000), { ok: true, quality: 0.74, bytes: 140_000 });
  assert.deepEqual(I.chooseQuality(enc, 250_000), { ok: true, quality: 0.86, bytes: 200_000 });
  const r = I.chooseQuality(enc, 50_000);
  assert.equal(r.ok, false);
  assert.equal(r.quality, 0.6);
});

// a minimal JPEG header: SOI, optional APP1 (EXIF-like) segment, SOF0 with the size, then EOI
function jpeg({ w, h, app1 = 0, sof = 0xC0 }) {
  const parts = [Buffer.from([0xFF, 0xD8])];
  if (app1) { const body = Buffer.alloc(app1, 0x41); parts.push(Buffer.from([0xFF, 0xE1, (app1 + 2) >> 8, (app1 + 2) & 255]), body); }
  parts.push(Buffer.from([0xFF, sof, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]));
  parts.push(Buffer.from([0xFF, 0xD9]));
  return Buffer.concat(parts);
}

test('jpegInfo: reads size, skips metadata segments, recognises progressive frames', () => {
  assert.deepEqual(I.jpegInfo(jpeg({ w: 512, h: 512 })), { ok: true, width: 512, height: 512 });
  assert.deepEqual(I.jpegInfo(jpeg({ w: 640, h: 480, app1: 3000 })), { ok: true, width: 640, height: 480 });
  assert.deepEqual(I.jpegInfo(jpeg({ w: 300, h: 200, sof: 0xC2 })), { ok: true, width: 300, height: 200 });
});

test('jpegInfo: rejects non-JPEG, truncated and size-less data', () => {
  assert.equal(I.jpegInfo(Buffer.from('GIF89a....')).ok, false);
  assert.equal(I.jpegInfo(Buffer.from([0xFF, 0xD8, 0xFF])).ok, false);
  assert.equal(I.jpegInfo(Buffer.from([0xFF, 0xD8, 0xFF, 0xD9])).ok, false);
  assert.equal(I.jpegInfo(Buffer.alloc(0)).ok, false);
  assert.equal(I.jpegInfo(null).ok, false);
  assert.equal(I.jpegInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).ok, false);
});
