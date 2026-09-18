const $ = (id) => document.getElementById(id);

let session = JSON.parse(localStorage.getItem('adwatch_session') || 'null');
let currentAdConfig = null;
let watchTimer = null;

// Capture a referral code from the URL (e.g. yoursite.com/?ref=ab12cd34)
// so it survives through to the signup call, even if the user browses
// around before creating an account.
const urlRef = new URLSearchParams(window.location.search).get('ref');
if (urlRef) localStorage.setItem('adwatch_ref', urlRef);

// ---------- Screen switching ----------
function showScreen(id) {
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
  $(id).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.nav-btn[data-screen="${id}"]`);
  if (btn) btn.classList.add('active');
}

function enterApp() {
  $('auth-screen').classList.add('hidden');
  $('wallet-pill').classList.remove('hidden');
  $('bottom-nav').classList.remove('hidden');
  showScreen('watch-screen');
  refreshBalance();
  loadAdConfig();
}

function exitApp() {
  session = null;
  localStorage.removeItem('adwatch_session');
  $('wallet-pill').classList.add('hidden');
  $('bottom-nav').classList.add('hidden');
  $('auth-screen').classList.remove('hidden');
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
  $('auth-screen').classList.remove('hidden');
}

// ---------- Auth tabs ----------
let mode = 'login';
$('tab-login').addEventListener('click', () => setMode('login'));
$('tab-signup').addEventListener('click', () => setMode('signup'));

function setMode(m) {
  mode = m;
  $('tab-login').classList.toggle('active', m === 'login');
  $('tab-signup').classList.toggle('active', m === 'signup');
  $('payout-method-field').classList.toggle('hidden', m !== 'signup');
  $('payout-detail-field').classList.toggle('hidden', m !== 'signup');
  $('auth-submit').textContent = m === 'login' ? 'Log in' : 'Sign up';
  $('auth-error').classList.add('hidden');
}

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  const payload = { email, password };
  if (mode === 'signup') {
    payload.payout_method = $('payout-method').value;
    payload.payout_detail = $('payout-detail').value.trim();
    const storedRef = localStorage.getItem('adwatch_ref');
    if (storedRef) payload.ref = storedRef;
  }

  const endpoint = mode === 'login' ? '/api/login' : '/api/signup';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    session = { token: data.token, userId: data.userId, email, referralCode: data.referralCode };
    localStorage.setItem('adwatch_session', JSON.stringify(session));
    enterApp();
  } catch (err) {
    $('auth-error').textContent = err.message;
    $('auth-error').classList.remove('hidden');
  }
});

// ---------- Nav ----------
document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
  btn.addEventListener('click', () => {
    showScreen(btn.dataset.screen);
    if (btn.dataset.screen === 'withdraw-screen') refreshBalance();
  });
});
$('logout-btn').addEventListener('click', exitApp);

// ---------- Wallet ----------
async function refreshBalance() {
  if (!session) return;
  try {
    const res = await fetch(`/api/get-balance?userId=${session.userId}`, {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    const data = await res.json();
    const bal = (data.balance || 0).toFixed(4);
    $('balance').textContent = `$${bal}`;
    $('withdraw-balance').textContent = `$${bal}`;
  } catch (err) {
    console.error('balance fetch failed', err);
  }
}

// ---------- Ad config (rotates between providers) ----------
async function loadAdConfig() {
  try {
    const res = await fetch('/api/ad-config');
    currentAdConfig = await res.json();
    $('rate-note').textContent = `This ad pays $${currentAdConfig.payoutPerView.toFixed(4)} - watch ${currentAdConfig.durationSeconds}s to claim it.`;
  } catch (err) {
    $('rate-note').textContent = 'Could not load ad right now, try again shortly.';
  }
}

// ---------- Watch flow ----------
$('watch-btn').addEventListener('click', startWatch);

function startWatch() {
  if (!currentAdConfig) return;
  $('watch-btn').classList.add('hidden');
  $('timer-wrap').classList.remove('hidden');
  $('watch-result').textContent = '';

  renderAdCreative(currentAdConfig);

  const total = currentAdConfig.durationSeconds;
  let elapsed = 0;
  const startedAt = Date.now();

  watchTimer = setInterval(() => {
    elapsed = (Date.now() - startedAt) / 1000;
    const pct = Math.min(100, (elapsed / total) * 100);
    $('progress-bar').style.width = pct + '%';
    $('timer-label').textContent = `${Math.max(0, Math.ceil(total - elapsed))}s remaining`;

    if (elapsed >= total) {
      clearInterval(watchTimer);
      claimView(startedAt);
    }
  }, 200);
}

function renderAdCreative(config) {
  const slot = $('ad-placeholder').parentElement;

  if (config.embed) {
    // Real ad-network snippet came from ad-config.js. innerHTML alone
    // won't execute <script> tags, so we rebuild them manually.
    slot.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = config.embed;
    wrapper.querySelectorAll('script').forEach(oldScript => {
      const newScript = document.createElement('script');
      [...oldScript.attributes].forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.replaceWith(newScript);
    });
    slot.appendChild(wrapper);
  } else if (config.provider === 'video') {
    slot.innerHTML = `<video src="${config.creativeUrl}" autoplay muted playsinline style="width:100%;border-radius:8px;"></video>`;
  } else {
    slot.innerHTML = `<div id="ad-placeholder"><p>[${config.provider} ad slot - not configured yet, set EMBED_${config.provider.toUpperCase()} in Netlify]</p></div>`;
  }
}

// Networks with a real "watch completed" callback (e.g. Monetag's
// Rewarded Interstitial) should call this from their own snippet
// instead of relying purely on the visual countdown timer.
window.onAdComplete = function () {
  if (watchTimer) {
    clearInterval(watchTimer);
    claimView(Date.now() - (currentAdConfig.durationSeconds * 1000));
  }
};

async function claimView(startedAt) {
  try {
    const res = await fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({
        userId: session.userId,
        adId: currentAdConfig.adId,
        provider: currentAdConfig.provider,
        startedAt
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not verify view');

    $('watch-result').textContent = `Credited $${data.credited.toFixed(4)}. New balance $${data.newBalance.toFixed(4)}.`;
    refreshBalance();
  } catch (err) {
    $('watch-result').textContent = err.message;
  } finally {
    $('timer-wrap').classList.add('hidden');
    $('watch-btn').classList.remove('hidden');
    loadAdConfig();
  }
}

// ---------- Withdraw ----------
$('withdraw-btn').addEventListener('click', async () => {
  const amount = parseFloat($('withdraw-amount').value);
  if (!amount || amount <= 0) {
    $('withdraw-result').textContent = 'Enter a valid amount first.';
    return;
  }
  try {
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ userId: session.userId, amount })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
    $('withdraw-result').textContent = data.message || 'Withdrawal requested.';
    refreshBalance();
  } catch (err) {
    $('withdraw-result').textContent = err.message;
  }
});

// ---------- Settings: referral link ----------
document.querySelectorAll('.nav-btn[data-screen="settings-screen"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (session && session.referralCode) {
      $('referral-link').value = `${window.location.origin}/?ref=${session.referralCode}`;
    }
  });
});

$('copy-referral-btn').addEventListener('click', () => {
  $('referral-link').select();
  document.execCommand('copy');
  $('copy-referral-btn').textContent = 'Copied';
  setTimeout(() => { $('copy-referral-btn').textContent = 'Copy'; }, 1500);
});

// ---------- Settings: link payout bank account ----------
$('link-account-btn').addEventListener('click', async () => {
  const bank_code = $('bank-code').value.trim();
  const account_number = $('account-number').value.trim();
  const account_name = $('account-name').value.trim();
  if (!bank_code || !account_number || !account_name) {
    $('link-account-result').textContent = 'Fill in all three fields.';
    return;
  }
  try {
    const res = await fetch('/api/link-payout-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ type: 'nuban', bank_code, account_number, account_name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not link account');
    $('link-account-result').textContent = data.message;
  } catch (err) {
    $('link-account-result').textContent = err.message;
  }
});

// ---------- Gift / donate ----------
$('gift-btn').addEventListener('click', async () => {
  const amount = parseFloat($('gift-amount').value);
  const email = $('gift-donor-email').value.trim();
  const recipientCode = $('gift-recipient-code').value.trim();

  if (!amount || amount < 100) {
    $('gift-result').textContent = 'Enter an amount of at least NGN 100.';
    return;
  }
  if (!email) {
    $('gift-result').textContent = 'An email is needed for the payment receipt.';
    return;
  }

  try {
    const res = await fetch('/api/create-donation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, email, recipientCode: recipientCode || null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not start payment');
    window.location.href = data.authorizationUrl; // off to Paystack checkout
  } catch (err) {
    $('gift-result').textContent = err.message;
  }
});

// If we're back from a Paystack redirect, show a result message.
(function checkDonationReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('donation') === 'success' && params.get('reference')) {
    fetch(`/api/verify-donation?reference=${params.get('reference')}`)
      .then(r => r.json())
      .then(data => {
        alert(data.message || 'Thank you for your gift!');
        if (session) refreshBalance();
      })
      .catch(() => {});
  }
})();

// ---------- Boot ----------
setMode('login');
if (session) enterApp();
