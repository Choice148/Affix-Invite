import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/server.js';

let server;
let baseUrl;
let cookieHeader = '';

async function request(path, options = {}) {
  const headers = options.headers || {};
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    cookieHeader = setCookie.split(';')[0];
  }

  const data = await res.json();
  return { status: res.status, data };
}

test.before(async () => {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  return new Promise((resolve) => {
    server.close(resolve);
  });
});

test('AuthSwitch Provider Domain Extension Validation Workflow', async (t) => {
  await t.test('Initial session state is SECURITY_CHECK', async () => {
    const { status, data } = await request('/api/session');
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.equal(data.authState.state, 'SECURITY_CHECK');
  });

  await t.test('Security Checkpoint access-check succeeds', async () => {
    const { status, data } = await request('/api/access-check', {
      method: 'POST',
      body: { challengeId: 'demo-test-1', completed: true },
    });
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.equal(data.next, '/login');
  });

  await t.test('Rejects email extension mismatch for provider', async () => {
    const { status, data } = await request('/api/login-demo', {
      method: 'POST',
      body: { provider: 'Gmail', email: 'user@yahoo.com', username: 'john_doe' },
    });
    assert.equal(status, 400);
    assert.equal(data.success, false);
    assert.ok(data.errors.email);
    assert.match(data.errors.email, /must end with @gmail\.com/);
  });

  await t.test('Accepts valid email matching selected provider extension', async () => {
    const { status, data } = await request('/api/login-demo', {
      method: 'POST',
      body: { provider: 'Gmail', email: 'user@gmail.com', username: 'john_doe' },
    });
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.equal(data.next, '/activation');
    assert.equal(data.provider, 'Gmail');
  });

  await t.test('Verification step accepts any valid 6-digit numeric code', async () => {
    const { status, data } = await request('/api/activation/verify', {
      method: 'POST',
      body: { code: '123456' },
    });
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.equal(data.next, '/success');
  });

  await t.test('Logout resets state machine back to SECURITY_CHECK', async () => {
    const { status, data } = await request('/api/logout', { method: 'POST' });
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.equal(data.next, '/');
  });
});
