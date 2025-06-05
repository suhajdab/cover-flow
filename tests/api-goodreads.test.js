import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/goodreads.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    data: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; }
  };
}

test('invalid userId returns 400', async () => {
  const req = {
    method: 'GET',
    query: { userId: 'abc' }
  };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'Invalid userId format. Must be numeric.');
});

test('rejects non-GET methods', async () => {
  const req = { method: 'POST', query: {} };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.data.error, 'Method not allowed');
  assert.equal(res.headers.Allow, 'GET');
});

test('invalid shelf input returns 400', async () => {
  const req = {
    method: 'GET',
    query: { userId: '123', shelf: '../etc/passwd' }
  };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.data.error, /Invalid shelf format/);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
});

test('invalid page parameter returns 400', async () => {
  const req = {
    method: 'GET',
    query: { userId: '123', page: '0' }
  };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.data.error, /Invalid page number/);
});

test('security headers exist on success', async () => {
  const mockXml = '<rss><channel><title>Test</title><item><book_id>1</book_id><title>Book</title><author_name>Auth</author_name><book_large_image_url></book_large_image_url></item></channel></rss>';
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => mockXml });

  const req = { method: 'GET', query: { userId: '123' } };
  const res = createMockRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.equal(res.headers['X-XSS-Protection'], '1; mode=block');
  assert.equal(res.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');

  global.fetch = originalFetch;
});
