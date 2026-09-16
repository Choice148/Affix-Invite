export const STATE_SECURITY_CHECK = 'SECURITY_CHECK';
export const STATE_LOGIN_PAGE = 'LOGIN_PAGE';
export const STATE_ACTIVATION_PAGE = 'ACTIVATION_PAGE';
export const STATE_SUCCESS_PAGE = 'SUCCESS_PAGE';

/**
 * Initializes and normalizes session authState structure.
 */
export function initSessionState(req, res, next) {
  if (!req.session) {
    return res.status(500).json({ error: 'Session middleware uninitialized' });
  }

  if (!req.session.authState) {
    req.session.authState = {
      state: STATE_SECURITY_CHECK,
      challengeId: null,
      challengePassed: false,
      provider: null,
      email: null,
      username: null,
      verificationStatus: null,
    };
  }

  next();
}

/**
 * Helper to check if current session meets target state prerequisites.
 */
export function requireState(requiredState) {
  return (req, res, next) => {
    const currentState = req.session?.authState?.state || STATE_SECURITY_CHECK;

    const stateOrder = [
      STATE_SECURITY_CHECK,
      STATE_LOGIN_PAGE,
      STATE_ACTIVATION_PAGE,
      STATE_SUCCESS_PAGE,
    ];

    const currentIndex = stateOrder.indexOf(currentState);
    const requiredIndex = stateOrder.indexOf(requiredState);

    if (currentIndex < requiredIndex) {
      return res.status(403).json({
        success: false,
        error: 'Session expired or out of sync. Please complete the security checkpoint to continue.',
        currentState,
        requiredState,
        redirect: getPathForState(currentState),
      });
    }

    next();
  };
}

export function getPathForState(state) {
  switch (state) {
    case STATE_LOGIN_PAGE:
      return '/login';
    case STATE_ACTIVATION_PAGE:
      return '/activation';
    case STATE_SUCCESS_PAGE:
      return '/success';
    case STATE_SECURITY_CHECK:
    default:
      return '/';
  }
}
