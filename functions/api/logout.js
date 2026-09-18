import { createSessionCookieHeader } from '../utils/edgeSession.js';

export async function onRequestPost(context) {
  const { env } = context;
  const initialAuthState = {
    state: 'SECURITY_CHECK',
    challengeId: null,
    challengePassed: false,
    provider: null,
    email: null,
    username: null,
    verificationStatus: null,
  };

  const cookieHeader = await createSessionCookieHeader(initialAuthState, env);

  return new Response(
    JSON.stringify({ success: true, next: '/' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader,
      },
    }
  );
}
