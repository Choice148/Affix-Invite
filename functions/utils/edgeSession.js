/**
 * Cloudflare Pages Functions Edge Session & Telegram Utility
 */

const STATE_SECURITY_CHECK = 'SECURITY_CHECK';
const COOKIE_NAME = 'authswitch_session';

async function getHmacKey(secretStr) {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secretStr || 'authswitch-demo-secret-key-super-secure'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let m = str.replace(/-/g, '+').replace(/_/g, '/');
  while (m.length % 4) m += '=';
  return atob(m);
}

export async function getSessionData(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  
  const defaultState = {
    state: STATE_SECURITY_CHECK,
    challengeId: null,
    challengePassed: false,
    provider: null,
    email: null,
    username: null,
    verificationStatus: null,
  };

  if (!match) return defaultState;

  const cookieVal = match[1];
  const parts = cookieVal.split('.');
  if (parts.length !== 2) return defaultState;

  const [payloadB64, sigB64] = parts;
  try {
    const secret = env.SESSION_SECRET || 'authswitch-demo-secret-key-super-secure';
    const key = await getHmacKey(secret);
    const enc = new TextEncoder();
    const dataToVerify = enc.encode(payloadB64);
    
    const sigStr = base64UrlDecode(sigB64);
    const sigBuf = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) sigBuf[i] = sigStr.charCodeAt(i);

    const isValid = await crypto.subtle.verify('HMAC', key, sigBuf, dataToVerify);
    if (!isValid) return defaultState;

    const jsonStr = base64UrlDecode(payloadB64);
    return JSON.parse(jsonStr);
  } catch (err) {
    return defaultState;
  }
}

export async function createSessionCookieHeader(authState, env) {
  const secret = env.SESSION_SECRET || 'authswitch-demo-secret-key-super-secure';
  const key = await getHmacKey(secret);
  const jsonStr = JSON.stringify(authState);
  const payloadB64 = base64UrlEncode(jsonStr);

  const enc = new TextEncoder();
  const dataToSign = enc.encode(payloadB64);
  const sigBuf = await crypto.subtle.sign('HMAC', key, dataToSign);

  let sigStr = '';
  const bytes = new Uint8Array(sigBuf);
  for (let i = 0; i < bytes.length; i++) sigStr += String.fromCharCode(bytes[i]);
  const sigB64 = base64UrlEncode(sigStr);

  const cookieValue = `${payloadB64}.${sigB64}`;
  return `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendEdgeTelegramNotification(eventDetails, env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[TELEGRAM MONITOR EDGE] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables in Cloudflare settings!');
    return false;
  }

  const messageLines = [`🔐 <b>AuthSwitch Demo</b>`, ``, `<b>Event:</b> ${escapeHtml(eventDetails.title)}`];

  if (eventDetails.lines) {
    eventDetails.lines.forEach((line) => {
      const cleanLine = line.replace(/^\*(.*?)\*:\s*/, '<b>$1:</b> ');
      messageLines.push(cleanLine);
    });
  }

  const messageText = messageLines.join('\n');

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[TELEGRAM MONITOR EDGE ERROR] Status ${response.status}: ${errText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[TELEGRAM MONITOR EDGE FETCH ERROR]', err.message);
    return false;
  }
}
