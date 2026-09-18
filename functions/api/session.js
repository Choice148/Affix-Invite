import { getSessionData } from '../utils/edgeSession.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const authState = await getSessionData(request, env);

  return new Response(
    JSON.stringify({
      success: true,
      authState: {
        state: authState.state,
        challengePassed: authState.challengePassed,
        provider: authState.provider,
        email: authState.email,
        username: authState.username,
        verificationStatus: authState.verificationStatus || authState.activationStatus || authState.otpStatus,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
