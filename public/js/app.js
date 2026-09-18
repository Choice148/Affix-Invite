document.addEventListener('DOMContentLoaded', () => {
  // Provider Domain Extension Rules
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

  // State Variables
  let currentSessionState = 'SECURITY_CHECK';
  let selectedProvider = 'Gmail';
  let isDraggingSlider = false;
  let sliderStartX = 0;
  let sliderCurrentX = 0;

  // DOM Elements
  const viewCheckpoint = document.getElementById('view-checkpoint');
  const viewLogin = document.getElementById('view-login');
  const viewOtp = document.getElementById('view-otp');
  const viewSuccess = document.getElementById('view-success');

  // Page 1 Elements
  const sliderTrack = document.getElementById('slider-track');
  const sliderHandle = document.getElementById('slider-handle');
  const sliderFill = document.getElementById('slider-fill');
  const sliderText = document.getElementById('slider-text');
  const handleIcon = document.getElementById('handle-icon');
  const checkpointStatus = document.getElementById('checkpoint-status');

  // Page 2 Elements
  const formLogin = document.getElementById('form-login');
  const inputEmail = document.getElementById('input-email');
  const inputUsername = document.getElementById('input-username');
  const providerPillGroup = document.getElementById('provider-pill-group');
  const providerDropdownBtn = document.getElementById('provider-dropdown-btn');
  const providerDropdownMenu = document.getElementById('provider-dropdown-menu');
  const selectedProviderLabel = document.getElementById('selected-provider-label');
  const errorEmail = document.getElementById('error-email');
  const loginGlobalError = document.getElementById('login-global-error');

  // Page 3 Elements
  const formOtp = document.getElementById('form-otp');
  const otpBoxes = Array.from(document.querySelectorAll('.otp-box'));
  const otpErrorMsg = document.getElementById('otp-error-msg');
  const btnOpenSkipModal = document.getElementById('btn-open-skip-modal');
  const modalSkip = document.getElementById('modal-skip');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalConfirmSkip = document.getElementById('btn-modal-confirm-skip');

  // Page 4 Elements
  const summaryCheckpoint = document.getElementById('summary-checkpoint');
  const summaryLogin = document.getElementById('summary-login');
  const summaryOtp = document.getElementById('summary-otp');
  const btnRestartDemo = document.getElementById('btn-restart-demo');

  const stateOrder = ['SECURITY_CHECK', 'LOGIN_PAGE', 'ACTIVATION_PAGE', 'SUCCESS_PAGE'];
  const statePathMap = {
    SECURITY_CHECK: '/',
    LOGIN_PAGE: '/login',
    ACTIVATION_PAGE: '/activation',
    SUCCESS_PAGE: '/success',
  };
  const pathStateMap = {
    '/': 'SECURITY_CHECK',
    '/login': 'LOGIN_PAGE',
    '/activation': 'ACTIVATION_PAGE',
    '/otp': 'ACTIVATION_PAGE',
    '/success': 'SUCCESS_PAGE',
  };

  // Helper to update hint text based on selected provider extension
  function updateProviderHint() {
    const domains = providerDomains[selectedProvider];
    if (domains && domains.length > 0) {
      selectedProviderLabel.textContent = `${selectedProvider} (${domains.join(', ')})`;
    } else {
      selectedProviderLabel.textContent = `${selectedProvider} (any valid domain)`;
    }
  }

  // ==========================================
  // SPA ROUTER & SESSION SYNC
  // ==========================================
  async function syncSessionState() {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (data.success && data.authState) {
        currentSessionState = data.authState.state || 'SECURITY_CHECK';
        updateSummaryView(data.authState);
      }
    } catch (err) {
      console.error('Failed to sync session:', err);
    }
  }

  function getValidPathForRequestedPath(requestedPath) {
    const requestedState = pathStateMap[requestedPath] || 'SECURITY_CHECK';
    const currentIdx = stateOrder.indexOf(currentSessionState);
    const reqIdx = stateOrder.indexOf(requestedState);

    if (reqIdx > currentIdx) {
      return statePathMap[currentSessionState] || '/';
    }
    return requestedPath;
  }

  function routeToPath(path, pushState = true) {
    const targetPath = getValidPathForRequestedPath(path);

    if (pushState && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }

    [viewCheckpoint, viewLogin, viewOtp, viewSuccess].forEach((view) => {
      view.classList.remove('active');
    });

    switch (targetPath) {
      case '/login':
        viewLogin.classList.add('active');
        break;
      case '/activation':
      case '/otp':
        viewOtp.classList.add('active');
        break;
      case '/success':
        viewSuccess.classList.add('active');
        break;
      case '/':
      default:
        resetSlider();
        viewCheckpoint.classList.add('active');
        break;
    }
  }

  function handleForbiddenRedirect(data) {
    const redirectPath = data.redirect || statePathMap[data.currentState] || '/';
    routeToPath(redirectPath, true);
  }

  window.addEventListener('popstate', async () => {
    await syncSessionState();
    routeToPath(window.location.pathname, false);
  });

  syncSessionState().then(() => {
    routeToPath(window.location.pathname, false);
  });

  // ==========================================
  // PAGE 1: SWIPE-TO-UNLOCK INTERACTION
  // ==========================================
  function resetSlider() {
    isDraggingSlider = false;
    sliderCurrentX = 0;
    sliderHandle.style.transition = 'left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    sliderHandle.style.left = '5px';
    sliderFill.style.width = '0%';
    sliderTrack.classList.remove('verified');
    handleIcon.textContent = '→';
    sliderText.textContent = 'Swipe to unlock';
    checkpointStatus.textContent = '';
  }

  function getMaxDrag() {
    const trackWidth = sliderTrack.clientWidth;
    const handleWidth = sliderHandle.clientWidth;
    return trackWidth - handleWidth - 10;
  }

  function onDragStart(clientX) {
    if (sliderTrack.classList.contains('verified')) return;
    isDraggingSlider = true;
    sliderStartX = clientX - sliderCurrentX;
    sliderHandle.style.transition = 'none';
  }

  function onDragMove(clientX) {
    if (!isDraggingSlider || sliderTrack.classList.contains('verified')) return;
    const maxDrag = getMaxDrag();
    sliderCurrentX = Math.max(0, Math.min(clientX - sliderStartX, maxDrag));

    sliderHandle.style.left = 5 + sliderCurrentX + 'px';
    const percent = Math.round((sliderCurrentX / maxDrag) * 100);
    sliderFill.style.width = percent + '%';
  }

  async function onDragEnd() {
    if (!isDraggingSlider || sliderTrack.classList.contains('verified')) return;
    isDraggingSlider = false;
    const maxDrag = getMaxDrag();
    const percent = (sliderCurrentX / maxDrag) * 100;

    if (percent >= 85) {
      sliderHandle.style.transition = 'left 0.15s ease-out';
      sliderHandle.style.left = 5 + maxDrag + 'px';
      sliderFill.style.width = '100%';
      sliderTrack.classList.add('verified');
      handleIcon.textContent = '✓';
      sliderText.textContent = 'Verified';
      checkpointStatus.textContent = 'Verification successful.';

      try {
        const response = await fetch('/api/access-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: 'demo-challenge-123',
            completed: true,
          }),
        });

        const data = await response.json();
        if (data.success && data.next) {
          setTimeout(() => {
            currentSessionState = 'LOGIN_PAGE';
            routeToPath(data.next, true);
          }, 600);
        } else {
          checkpointStatus.textContent = data.error || 'Verification failed.';
          resetSlider();
        }
      } catch (err) {
        console.error('Access check error:', err);
        checkpointStatus.textContent = 'Server error during check.';
        resetSlider();
      }
    } else {
      sliderHandle.style.transition = 'left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
      sliderHandle.style.left = '5px';
      sliderFill.style.width = '0%';
      sliderCurrentX = 0;
    }
  }

  sliderHandle.addEventListener('mousedown', (e) => onDragStart(e.clientX));
  window.addEventListener('mousemove', (e) => onDragMove(e.clientX));
  window.addEventListener('mouseup', () => onDragEnd());

  sliderHandle.addEventListener('touchstart', (e) => onDragStart(e.touches[0].clientX), { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (isDraggingSlider) onDragMove(e.touches[0].clientX);
  }, { passive: true });
  window.addEventListener('touchend', () => onDragEnd());

  sliderHandle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      sliderCurrentX = getMaxDrag();
      onDragEnd();
    }
  });

  // ==========================================
  // PAGE 2: PROVIDER SWITCHER & USER DETAILS FORM
  // ==========================================
  providerPillGroup.addEventListener('click', (e) => {
    const pill = e.target.closest('.provider-pill:not(.dropdown-trigger)');
    if (pill) {
      document.querySelectorAll('.provider-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      selectedProvider = pill.dataset.provider;
      updateProviderHint();
      providerDropdownMenu.classList.remove('show');
    }
  });

  providerDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    providerDropdownMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    providerDropdownMenu.classList.remove('show');
  });

  providerDropdownMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (item) {
      selectedProvider = item.dataset.provider;
      updateProviderHint();
      document.querySelectorAll('.provider-pill').forEach((p) => p.classList.remove('active'));
      providerDropdownBtn.classList.add('active');
      providerDropdownMenu.classList.remove('show');
    }
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginGlobalError.classList.remove('visible');
    inputEmail.classList.remove('is-invalid');
    inputUsername.classList.remove('is-invalid');

    const emailVal = inputEmail.value.trim();
    const usernameVal = inputUsername.value.trim();

    let hasError = false;

    const emailCheck = validateEmailProviderDomain(emailVal, selectedProvider);
    if (!emailCheck.valid) {
      inputEmail.classList.add('is-invalid');
      if (errorEmail) errorEmail.textContent = emailCheck.message;
      hasError = true;
    }

    if (!usernameVal || usernameVal.length < 3) {
      inputUsername.classList.add('is-invalid');
      hasError = true;
    }

    if (hasError) return;

    try {
      const response = await fetch('/api/login-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          email: emailVal,
          username: usernameVal,
        }),
      });

      const data = await response.json();

      if (response.status === 403) {
        await syncSessionState();
        handleForbiddenRedirect(data);
        return;
      }

      if (data.success && data.next) {
        currentSessionState = 'ACTIVATION_PAGE';
        routeToPath(data.next, true);
      } else {
        if (data.errors) {
          if (data.errors.email) {
            inputEmail.classList.add('is-invalid');
            if (errorEmail) errorEmail.textContent = data.errors.email;
          }
          if (data.errors.username) {
            inputUsername.classList.add('is-invalid');
          }
        } else {
          loginGlobalError.textContent = data.error || 'Validation error.';
          loginGlobalError.classList.add('visible');
        }
      }
    } catch (err) {
      console.error('Form submit error:', err);
      loginGlobalError.textContent = 'Server connection error. Please try again.';
      loginGlobalError.classList.add('visible');
    }
  });

  // Initial provider hint update
  updateProviderHint();

  // ==========================================
  // PAGE 3: CODE VERIFICATION
  // ==========================================
  otpBoxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val && !/^\d$/.test(val)) {
        box.value = '';
        return;
      }

      if (val && index < otpBoxes.length - 1) {
        otpBoxes[index + 1].focus();
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) {
        otpBoxes[index - 1].focus();
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pasted)) {
        pasted.split('').forEach((char, i) => {
          if (otpBoxes[i]) otpBoxes[i].value = char;
        });
        otpBoxes[5].focus();
      }
    });
  });

  formOtp.addEventListener('submit', async (e) => {
    e.preventDefault();
    otpErrorMsg.classList.remove('visible');

    const code = otpBoxes.map((box) => box.value).join('');
    if (code.length !== 6) {
      otpErrorMsg.textContent = 'Please enter all 6 numeric digits.';
      otpErrorMsg.classList.add('visible');
      return;
    }

    try {
      const response = await fetch('/api/activation/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (response.status === 403) {
        await syncSessionState();
        handleForbiddenRedirect(data);
        return;
      }

      if (data.success && data.next) {
        currentSessionState = 'SUCCESS_PAGE';
        await syncSessionState();
        routeToPath(data.next, true);
      } else {
        otpErrorMsg.textContent = data.error || 'Code verification failed.';
        otpErrorMsg.classList.add('visible');
      }
    } catch (err) {
      console.error('Code verify error:', err);
      otpErrorMsg.textContent = 'Server connection error.';
      otpErrorMsg.classList.add('visible');
    }
  });

  btnOpenSkipModal.addEventListener('click', () => {
    if (typeof modalSkip.showModal === 'function') {
      modalSkip.showModal();
    } else {
      modalSkip.setAttribute('open', '');
    }
  });

  btnModalCancel.addEventListener('click', () => {
    if (typeof modalSkip.close === 'function') {
      modalSkip.close();
    } else {
      modalSkip.removeAttribute('open');
    }
  });

  btnModalConfirmSkip.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/activation/skip', { method: 'POST' });
      const data = await res.json();

      if (typeof modalSkip.close === 'function') {
        modalSkip.close();
      } else {
        modalSkip.removeAttribute('open');
      }

      if (res.status === 403) {
        await syncSessionState();
        handleForbiddenRedirect(data);
        return;
      }

      if (data.success && data.next) {
        currentSessionState = 'SUCCESS_PAGE';
        await syncSessionState();
        routeToPath(data.next, true);
      }
    } catch (err) {
      console.error('Skip verification error:', err);
    }
  });

  // ==========================================
  // PAGE 4: SUCCESS SUMMARY & RESTART
  // ==========================================
  function updateSummaryView(authState) {
    if (authState.challengePassed) {
      summaryCheckpoint.textContent = '✓ Completed';
      summaryCheckpoint.className = 'item-status status-pass';
    }

    if (authState.email) {
      summaryLogin.textContent = `✓ Completed (${authState.provider || 'Email'})`;
      summaryLogin.className = 'item-status status-pass';
    }

    const verStatus = authState.verificationStatus || authState.activationStatus || authState.otpStatus;
    if (verStatus === 'completed') {
      summaryOtp.textContent = '✓ Completed';
      summaryOtp.className = 'item-status status-pass';
    } else if (verStatus === 'skipped') {
      summaryOtp.textContent = '— Skipped';
      summaryOtp.className = 'item-status status-skip';
    }
  }

  btnRestartDemo.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      currentSessionState = 'SECURITY_CHECK';
      resetSlider();
      formLogin.reset();
      otpBoxes.forEach((b) => (b.value = ''));
      selectedProvider = 'Gmail';
      updateProviderHint();
      document.querySelectorAll('.provider-pill').forEach((p) => p.classList.remove('active'));
      document.querySelector('.provider-pill[data-provider="Gmail"]').classList.add('active');

      routeToPath('/', true);
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
});
