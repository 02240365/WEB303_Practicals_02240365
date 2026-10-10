/**
 * app.js
 * -----------------------------------------------------------------------
 * Front-end logic for the CST Student Management System demo UI.
 * Handles auth state for both roles (student / registration staff), tab
 * navigation, dashboard rendering, and talks to the Express API defined
 * in server.js / src/routes/*.js.
 * -----------------------------------------------------------------------
 */

// ---------- Icons used inside dynamically-rendered status messages ----------
const ICONS = {
  success:
    '<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error:
    '<svg class="icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  warning:
    '<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 3.5 21.5 20h-19L12 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.5v4.2M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pending:
    '<svg class="icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const GRADE_POINTS = {
  A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, F: 0,
};

const STUDENT_ID_REGEX = /^\d{8}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,12}$/;
const TXN_REGEX = /^\d{3}-\d{9}$/;
const STAFF_EMAIL_REGEX = /^[a-z][a-z0-9]*\.cst@rub\.edu\.bt$/i;
const SESSION_KEY = 'sms_session';

let currentModuleCatalogue = [];
let loginRole = 'student';
let signupRole = 'student';

// ============================================================
// Toasts
// ============================================================
function showToast(type, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${ICONS[type] || ''}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 200);
  }, 3800);
}

function renderStatus(el, type, message) {
  el.innerHTML = `<div class="status ${type}">${ICONS[type] || ''}<span>${message}</span></div>`;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================================
// Theme (dark mode) - shared across the student and staff shells
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('sms-theme');
  const theme = saved || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}
function updateThemeIcon(theme) {
  document.querySelectorAll('.icon-sun').forEach((el) => { el.hidden = theme === 'dark'; });
  document.querySelectorAll('.icon-moon').forEach((el) => { el.hidden = theme !== 'dark'; });
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sms-theme', next);
  updateThemeIcon(next);
}
document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
document.getElementById('staffThemeToggleBtn').addEventListener('click', toggleTheme);
initTheme();

document.getElementById('bellBtn').addEventListener('click', () => {
  document.getElementById('bellDot').hidden = true;
  showToast('success', 'No new notifications.');
});

document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('sidenav').classList.toggle('open');
});
document.getElementById('staffHamburgerBtn').addEventListener('click', () => {
  document.getElementById('staffSidenav').classList.toggle('open');
});

document.querySelectorAll('[data-switchto]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector(`.auth-tab[data-authtab="${link.dataset.switchto}"]`).click();
  });
});

document.getElementById('forgotPwLink').addEventListener('click', (e) => {
  e.preventDefault();
  showToast('warning', 'Please contact the IT Helpdesk to reset your password.');
});

// ============================================================
// Live field validation
// ============================================================
function liveValidate(inputEl, regex, hintEl, validMsg, invalidMsg) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    const value = inputEl.value.trim();
    if (!value) {
      inputEl.classList.remove('field-valid', 'field-invalid');
      if (hintEl) { hintEl.textContent = invalidMsg; hintEl.classList.remove('field-valid', 'field-invalid'); }
      return;
    }
    const ok = regex.test(value);
    inputEl.classList.toggle('field-valid', ok);
    inputEl.classList.toggle('field-invalid', !ok);
    if (hintEl) {
      hintEl.textContent = ok ? validMsg : invalidMsg;
      hintEl.classList.toggle('field-valid', ok);
      hintEl.classList.toggle('field-invalid', !ok);
    }
  });
}
liveValidate(document.getElementById('loginStudentId'), STUDENT_ID_REGEX, document.getElementById('loginIdHint'), 'Looks good.', 'Exactly 8 digits, numbers only.');
liveValidate(document.getElementById('loginStaffEmail'), STAFF_EMAIL_REGEX, document.getElementById('loginEmailHint'), 'Looks good.', 'Format: name.cst@rub.edu.bt');
liveValidate(document.getElementById('loginPassword'), PASSWORD_REGEX, null, '', '');
liveValidate(document.getElementById('signupStudentId'), STUDENT_ID_REGEX, document.getElementById('signupIdHint'), 'Looks good.', 'Exactly 8 digits, numbers only.');
liveValidate(document.getElementById('signupStaffEmail'), STAFF_EMAIL_REGEX, document.getElementById('signupEmailHint'), 'Looks good.', 'Format: name.cst@rub.edu.bt');
const STUDENT_EMAIL_REGEX = /^\d{8}\.cst@rub\.edu\.bt$/i;
liveValidate(document.getElementById('signupEmail'), STUDENT_EMAIL_REGEX, document.getElementById('signupStudentEmailHint'), 'Looks good.', 'Format: studentID.cst@rub.edu.bt');
// Convenience: once an 8-digit Student ID is typed, pre-fill the matching college email.
document.getElementById('signupStudentId').addEventListener('input', (e) => {
  const emailEl = document.getElementById('signupEmail');
  const id = e.target.value.trim();
  if (/^\d{8}$/.test(id) && (!emailEl.value || /^\d{0,8}\.cst@rub\.edu\.bt$/i.test(emailEl.value))) {
    emailEl.value = `${id}.cst@rub.edu.bt`;
    emailEl.dispatchEvent(new Event('input'));
  }
});
liveValidate(document.getElementById('signupPassword'), PASSWORD_REGEX, document.getElementById('signupPwHint'), 'Looks good.', '8-12 characters, incl. uppercase, lowercase and a number.');

function wirePasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  toggle.addEventListener('click', () => {
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    toggle.setAttribute('aria-label', isPw ? 'Hide password' : 'Show password');
  });
}
wirePasswordToggle('loginPwToggle', 'loginPassword');
wirePasswordToggle('signupPwToggle', 'signupPassword');

// ============================================================
// Auth screen: Log In / Create Account tabs, Student / Staff roles
// ============================================================
document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.auth-view').forEach((v) => { v.hidden = true; v.classList.remove('active'); });
    const view = document.getElementById(`authView-${tab.dataset.authtab}`);
    view.hidden = false;
    view.classList.add('active');
  });
});

function setLoginRole(role) {
  loginRole = role;
  document.querySelectorAll('#loginRoleToggle .role-btn').forEach((b) => b.classList.toggle('active', b.dataset.role === role));
  document.getElementById('loginStudentIdField').hidden = role !== 'student';
  document.getElementById('loginStaffEmailField').hidden = role !== 'staff';
  document.getElementById('loginSubtitle').textContent =
    role === 'student' ? 'Sign in with your Student ID and password to access the portal.' : 'Sign in with your college email to review student submissions.';
}
document.querySelectorAll('#loginRoleToggle .role-btn').forEach((btn) => {
  btn.addEventListener('click', () => setLoginRole(btn.dataset.role));
});

function setSignupRole(role) {
  signupRole = role;
  document.querySelectorAll('#signupRoleToggle .role-btn').forEach((b) => b.classList.toggle('active', b.dataset.role === role));
  document.getElementById('signupStudentFields').hidden = role !== 'student';
  document.getElementById('signupStaffFields').hidden = role !== 'staff';
  document.getElementById('signupEmailField').hidden = role !== 'student';
  document.getElementById('signupSubtitle').textContent =
    role === 'student' ? 'Set up student access to the portal.' : 'Set up a Registration Staff account to review submissions.';
}
document.querySelectorAll('#signupRoleToggle .role-btn').forEach((btn) => {
  btn.addEventListener('click', () => setSignupRole(btn.dataset.role));
});

// ============================================================
// Tab navigation (student shell)
// ============================================================
function goToTab(tabName) {
  document.querySelectorAll('#sidenav .nav-item[data-tab]').forEach((b) => b.classList.remove('active'));
  const navBtn = document.querySelector(`#sidenav .nav-item[data-tab="${tabName}"]`);
  if (navBtn) navBtn.classList.add('active');
  document.querySelectorAll('#appShell .tab-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.getElementById('sidenav').classList.remove('open');

  if (['dashboard', 'payment', 'drugtest', 'register'].includes(tabName)) refreshProfile();
  if (tabName === 'results') loadResults();
  if (tabName === 'register') renderEligibility();
}

document.querySelectorAll('#sidenav .nav-item[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => goToTab(btn.dataset.tab));
});
document.querySelectorAll('.quick-action').forEach((btn) => {
  btn.addEventListener('click', () => goToTab(btn.dataset.goto));
});

// Tab navigation (staff shell - currently a single tab, kept generic for growth)
function goToStaffTab(tabName) {
  document.querySelectorAll('#staffSidenav .nav-item[data-stafftab]').forEach((b) => b.classList.remove('active'));
  const navBtn = document.querySelector(`#staffSidenav .nav-item[data-stafftab="${tabName}"]`);
  if (navBtn) navBtn.classList.add('active');
  document.querySelectorAll('#staffShell .tab-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`stafftab-${tabName}`).classList.add('active');
  document.getElementById('staffSidenav').classList.remove('open');
}
document.querySelectorAll('#staffSidenav .nav-item[data-stafftab]').forEach((btn) => {
  btn.addEventListener('click', () => goToStaffTab(btn.dataset.stafftab));
});

// ============================================================
// Session handling
// ============================================================
function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.querySelector('.btn-label').hidden = loading;
  btn.querySelector('.btn-spinner').hidden = !loading;
}

function saveSession(profile, role) {
  // `role` must come last: the staff profile carries its own job-title "role"
  // field, which would otherwise overwrite the session role and break restore-on-refresh.
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...profile, role }));
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch (err) {
    return null;
  }
}

function hideAllShells() {
  document.getElementById('authScreen').hidden = true;
  document.getElementById('appShell').hidden = true;
  document.getElementById('staffShell').hidden = true;
}

function enterApp(student) {
  saveSession(student, 'student');
  hideAllShells();
  document.getElementById('appShell').hidden = false;

  const initials = (student.name || '??').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('avatarInitials').textContent = initials;
  document.getElementById('sessionName').textContent = student.name;
  document.getElementById('sessionId').textContent = student.studentId;

  renderDashboard(student);
  loadModules();
  goToTab('dashboard');
  startStatusPolling();
}

function enterStaffApp(staffMember) {
  saveSession(staffMember, 'staff');
  hideAllShells();
  document.getElementById('staffShell').hidden = false;

  const initials = (staffMember.name || '??').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('staffAvatarInitials').textContent = initials;
  document.getElementById('staffSessionName').textContent = staffMember.name;
  document.getElementById('staffSessionEmail').textContent = staffMember.email;

  goToStaffTab('queue');
  loadStaffQueue();
}

function exitAny() {
  stopStatusPolling();
  clearSession();
  hideAllShells();
  document.getElementById('authScreen').hidden = false;
  document.getElementById('loginForm').reset();
  document.getElementById('loginResult').innerHTML = '';
  document.querySelector('.auth-tab[data-authtab="login"]').click();
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  exitAny();
  showToast('success', 'You have been logged out.');
});
document.getElementById('staffLogoutBtn').addEventListener('click', () => {
  exitAny();
  showToast('success', 'You have been logged out.');
});

/** Re-fetches the student's profile from the server and refreshes every view that depends on it. */
async function refreshProfile() {
  const session = getSession();
  if (!session || session.role !== 'student') return null;
  try {
    const res = await fetch(`/api/profile/${session.studentId}`);
    const data = await res.json();
    if (data.success) {
      announceReviewChanges(session, data.student);
      saveSession(data.student, 'student');
      renderDashboard(data.student);
      const registerPanel = document.getElementById('tab-register');
      if (registerPanel && registerPanel.classList.contains('active')) renderEligibility();
      return data.student;
    }
  } catch (err) {
    // Network hiccup - keep showing the last known state.
  }
  return session;
}

/** Tell the student the moment Registration Staff decide on a submission (status visibility). */
function announceReviewChanges(oldStudent, newStudent) {
  [['paymentStatus', 'Tuition payment'], ['drugTestStatus', 'Drug test report']].forEach(([key, label]) => {
    const before = oldStudent[key];
    const after = newStudent[key];
    if (before === 'pending' && after === 'verified') showToast('success', `${label} verified by Registration Staff.`);
    if (before === 'pending' && after === 'rejected') showToast('warning', `${label} was rejected. Open its tab to read the staff note.`);
  });
}

// Auto-refresh while a student is signed in, so staff decisions appear without a manual reload.
const STATUS_POLL_MS = 8000;
let statusTimer = null;
function startStatusPolling() {
  stopStatusPolling();
  statusTimer = setInterval(() => { if (!document.hidden) refreshProfile(); }, STATUS_POLL_MS);
}
function stopStatusPolling() {
  if (statusTimer) clearInterval(statusTimer);
  statusTimer = null;
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && statusTimer) refreshProfile(); });

// ============================================================
// Login
// ============================================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultEl = document.getElementById('loginResult');
  const btn = document.getElementById('loginSubmitBtn');
  const password = document.getElementById('loginPassword').value;

  setButtonLoading(btn, true);
  try {
    let res, data;
    if (loginRole === 'student') {
      const studentId = document.getElementById('loginStudentId').value.trim();
      res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password }),
      });
      data = await res.json();
      if (data.success) {
        resultEl.innerHTML = '';
        showToast('success', `Welcome, ${data.student.name}.`);
        enterApp(data.student);
      } else {
        // Wrong credentials: also point first-time users to sign-up (error recovery).
        renderStatus(resultEl, 'error', res.status === 401 ? `${data.message} If you have not created an account yet, use "Create an account" below.` : data.message);
      }
    } else {
      const email = document.getElementById('loginStaffEmail').value.trim();
      res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      data = await res.json();
      if (data.success) {
        resultEl.innerHTML = '';
        showToast('success', `Welcome, ${data.staff.name}.`);
        enterStaffApp(data.staff);
      } else {
        renderStatus(resultEl, 'error', data.message);
      }
    }
  } catch (err) {
    renderStatus(resultEl, 'error', 'Unable to reach the server. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ============================================================
// Sign up
// ============================================================
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultEl = document.getElementById('signupResult');
  const btn = document.getElementById('signupSubmitBtn');
  const name = document.getElementById('signupName').value.trim();
  const password = document.getElementById('signupPassword').value;

  setButtonLoading(btn, true);
  try {
    if (signupRole === 'student') {
      const studentId = document.getElementById('signupStudentId').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const programme = document.getElementById('signupProgramme').value.trim();
      const res = await fetch('/api/signup/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password, name, email, programme }),
      });
      const data = await res.json();
      if (data.success) {
        resultEl.innerHTML = '';
        showToast('success', 'Account created. Signing you in...');
        document.getElementById('signupForm').reset();
        enterApp(data.student);
      } else {
        renderStatus(resultEl, 'error', data.message);
      }
    } else {
      const email = document.getElementById('signupStaffEmail').value.trim();
      const res = await fetch('/api/signup/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (data.success) {
        resultEl.innerHTML = '';
        showToast('success', 'Staff account created. Signing you in...');
        document.getElementById('signupForm').reset();
        enterStaffApp(data.staff);
      } else {
        renderStatus(resultEl, 'error', data.message);
      }
    }
  } catch (err) {
    renderStatus(resultEl, 'error', 'Unable to reach the server. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ============================================================
// Dashboard (student)
// ============================================================
function computeGpa(results) {
  if (!results || results.length === 0) return null;
  const points = results.map((r) => GRADE_POINTS[r.grade]).filter((p) => p !== undefined);
  if (points.length === 0) return null;
  return points.reduce((a, b) => a + b, 0) / points.length;
}

const STATUS_LABEL = { none: 'Not Submitted', pending: 'Pending Review', verified: 'Verified', rejected: 'Rejected' };
const STATUS_PILL_CLASS = { none: 'muted', pending: '', rejected: 'bad', verified: 'good' };

function renderDashboard(student) {
  const firstName = (student.name || '').split(' ')[0] || 'Student';
  document.getElementById('dashGreeting').textContent = `Welcome back, ${firstName}`;
  document.getElementById('dashSubtitle').textContent = `${student.programme || ''} · ${student.semester || ''}`;

  const paid = !!student.tuitionPaid;
  const paymentStatus = student.paymentStatus || (paid ? 'verified' : 'none');
  document.getElementById('statPayment').textContent = STATUS_LABEL[paymentStatus];
  const paymentPill = document.getElementById('statPaymentPill');
  paymentPill.textContent = paymentStatus === 'verified' ? 'Verified' : paymentStatus === 'pending' ? 'Awaiting staff' : paymentStatus === 'rejected' ? 'Rejected' : 'Action needed';
  paymentPill.className = `stat-pill ${STATUS_PILL_CLASS[paymentStatus] || 'bad'}`;

  document.getElementById('statModules').textContent = (student.registeredModules || []).length;

  const gpa = computeGpa(student.results);
  document.getElementById('statGpa').textContent = gpa === null ? '—' : gpa.toFixed(2);
  document.getElementById('statGpaNote').textContent = `${(student.results || []).length} module(s) graded`;

  const periodOpen = !!student.registrationPeriodOpen;
  document.getElementById('statPeriod').textContent = periodOpen ? 'Open' : 'Closed';
  const periodPill = document.getElementById('statPeriodPill');
  periodPill.textContent = periodOpen ? 'Accepting registrations' : 'Closed';
  periodPill.className = `stat-pill ${periodOpen ? 'good' : 'bad'}`;

  const drugVerified = !!student.drugTestVerified;
  const drugStatus = student.drugTestStatus || (drugVerified ? 'verified' : 'none');
  document.getElementById('statDrugTest').textContent = STATUS_LABEL[drugStatus];
  const drugPill = document.getElementById('statDrugTestPill');
  drugPill.textContent = drugStatus === 'verified' ? 'On file' : drugStatus === 'pending' ? 'Awaiting staff' : drugStatus === 'rejected' ? 'Rejected' : 'Action needed';
  drugPill.className = `stat-pill ${STATUS_PILL_CLASS[drugStatus] || 'bad'}`;

  // Stepper
  const steps = [
    { key: 'login', done: true },
    { key: 'payment', done: paid },
    { key: 'drugtest', done: drugVerified },
    { key: 'register', done: (student.registeredModules || []).length > 0 },
    { key: 'results', done: (student.results || []).length > 0 },
  ];
  let currentAssigned = false;
  steps.forEach((s) => {
    const el = document.querySelector(`.step[data-step="${s.key}"]`);
    el.classList.toggle('done', s.done);
    el.classList.remove('current');
    if (!s.done && !currentAssigned) {
      el.classList.add('current');
      currentAssigned = true;
    }
    const labelEl = el.querySelector('.step-text span[data-pending]');
    if (labelEl) {
      labelEl.textContent = s.done ? labelEl.dataset.done : labelEl.dataset.pending;
    }
  });

  // Nav badges nudging unfinished requirements
  document.getElementById('navPaymentBadge').hidden = paid;
  document.getElementById('navDrugTestBadge').hidden = drugVerified;

  // Payment tab due-status pill + review note
  const duePill = document.getElementById('dueStatusPill');
  if (duePill) {
    duePill.textContent = STATUS_LABEL[paymentStatus];
    duePill.className = `stat-pill ${STATUS_PILL_CLASS[paymentStatus] || 'bad'}`;
  }
  const paymentNoteCard = document.getElementById('paymentReviewNoteCard');
  if (paymentNoteCard) {
    if (paymentStatus === 'rejected' && student.paymentReviewNote) {
      paymentNoteCard.hidden = false;
      document.getElementById('paymentReviewNoteText').textContent = student.paymentReviewNote;
    } else {
      paymentNoteCard.hidden = true;
    }
  }

  // Drug test tab status pill + review note
  const drugStatusText = document.getElementById('drugTestStatusText');
  const drugStatusPill = document.getElementById('drugTestStatusPill');
  if (drugStatusText && drugStatusPill) {
    drugStatusText.textContent = STATUS_LABEL[drugStatus];
    drugStatusPill.textContent = STATUS_LABEL[drugStatus];
    drugStatusPill.className = `stat-pill ${STATUS_PILL_CLASS[drugStatus] || 'bad'}`;
  }
  const drugNoteCard = document.getElementById('drugTestReviewNoteCard');
  if (drugNoteCard) {
    if (drugStatus === 'rejected' && student.drugTestReviewNote) {
      drugNoteCard.hidden = false;
      document.getElementById('drugTestReviewNoteText').textContent = student.drugTestReviewNote;
    } else {
      drugNoteCard.hidden = true;
    }
  }

  // Expected turnaround while a submission is waiting for staff
  const etaFor = (status, submission) => (status === 'pending'
    ? `Submitted ${submission && submission.submittedAt ? formatTimestamp(submission.submittedAt) : 'just now'}. Registration Staff usually review submissions within 1 working day. This page updates automatically when they decide.`
    : '');
  [['paymentEta', etaFor(paymentStatus, student.paymentSubmission)], ['drugTestEta', etaFor(drugStatus, student.drugTestSubmission)]].forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
  });

  // Registration tab chips
  const chipRow = document.getElementById('registeredChips');
  if (chipRow) {
    const modules = student.registeredModules || [];
    chipRow.innerHTML = modules.length
      ? modules.map((m) => `<span class="chip">${m}</span>`).join('')
      : '<span class="chip-empty">No modules registered yet.</span>';
  }
}

function renderEligibility() {
  const session = getSession();
  if (!session) return;
  const paymentStatus = session.paymentStatus || (session.tuitionPaid ? 'verified' : 'none');
  const drugStatus = session.drugTestStatus || (session.drugTestVerified ? 'verified' : 'none');
  const checks = [
    { label: 'Tuition payment verified', ok: !!session.tuitionPaid, status: paymentStatus },
    { label: 'Drug test report verified', ok: !!session.drugTestVerified, status: drugStatus },
    { label: 'Registration period open', ok: !!session.registrationPeriodOpen, status: session.registrationPeriodOpen ? 'verified' : 'none' },
  ];
  document.getElementById('eligibilityList').innerHTML = checks
    .map((c) => {
      const icon = c.ok ? ICONS.success : c.status === 'pending' ? ICONS.pending : ICONS.error;
      const suffix = !c.ok && c.status === 'pending' ? ' (pending staff review)' : !c.ok && c.status === 'rejected' ? ' (rejected - resubmit)' : '';
      return `<li class="${c.ok ? 'ok' : 'fail'}"><span class="tick">${icon}</span>${c.label}${suffix}</li>`;
    })
    .join('');
}

// ============================================================
// Registration
// ============================================================
async function loadModules() {
  try {
    const res = await fetch('/api/modules');
    const data = await res.json();
    currentModuleCatalogue = data.modules || [];
  } catch (err) {
    currentModuleCatalogue = [];
  }
  populateModuleSelect();
}

function populateModuleSelect() {
  const select = document.getElementById('regModuleCode');
  const session = getSession();
  const registered = new Set((session && session.registeredModules) || []);
  const available = currentModuleCatalogue.filter((m) => !registered.has(m.code));

  if (available.length === 0) {
    select.innerHTML = '<option value="">All modules already registered</option>';
    return;
  }
  select.innerHTML =
    '<option value="">Select a module&hellip;</option>' +
    available.map((m) => `<option value="${m.code}">${m.code} &mdash; ${m.title} (${m.credits} credits)</option>`).join('');
}

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const session = getSession();
  const moduleCode = document.getElementById('regModuleCode').value;
  const resultEl = document.getElementById('registerResult');
  const btn = document.getElementById('registerSubmitBtn');

  if (!moduleCode) {
    renderStatus(resultEl, 'error', 'Please select a module first.');
    return;
  }

  setButtonLoading(btn, true);
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: session.studentId, moduleCode }),
    });
    const data = await res.json();
    renderStatus(resultEl, data.success ? 'success' : 'error', data.message);
    if (data.success) {
      showToast('success', data.message);
      await refreshProfile();
      populateModuleSelect();
      renderEligibility();
      document.getElementById('regModuleCode').value = '';
    }
  } catch (err) {
    renderStatus(resultEl, 'error', 'Unable to reach the server. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ============================================================
// Payment
// ============================================================
liveValidate(document.getElementById('payTxn'), TXN_REGEX, document.getElementById('payTxnHint'), 'Looks good.', 'Format: 3 digits - hyphen - 9 digits.');

const fileDrop = document.getElementById('fileDrop');
const payFileInput = document.getElementById('payFile');
const fileDropLabel = document.getElementById('fileDropLabel');

payFileInput.addEventListener('change', () => {
  if (payFileInput.files[0]) {
    fileDropLabel.textContent = `Selected: ${payFileInput.files[0].name}`;
    fileDrop.classList.add('has-file');
  } else {
    fileDropLabel.textContent = 'Click to choose a file, or drag one here — JPG, JPEG or PNG only.';
    fileDrop.classList.remove('has-file');
  }
});
['dragover', 'dragleave', 'drop'].forEach((evt) => {
  fileDrop.addEventListener(evt, (e) => {
    e.preventDefault();
    fileDrop.classList.toggle('drag-over', evt === 'dragover');
    if (evt === 'drop' && e.dataTransfer.files[0]) {
      payFileInput.files = e.dataTransfer.files;
      payFileInput.dispatchEvent(new Event('change'));
    }
  });
});

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const session = getSession();
  const transactionNumber = document.getElementById('payTxn').value.trim();
  const resultEl = document.getElementById('paymentResult');
  const btn = document.getElementById('paymentSubmitBtn');

  const formData = new FormData();
  formData.append('studentId', session.studentId);
  formData.append('transactionNumber', transactionNumber);
  if (payFileInput.files[0]) formData.append('screenshot', payFileInput.files[0]);

  setButtonLoading(btn, true);
  try {
    const res = await fetch('/api/payment/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      renderStatus(resultEl, 'pending', data.message);
      showToast('success', 'Payment submitted for staff review.');
      await refreshProfile();
      document.getElementById('paymentForm').reset();
      fileDropLabel.textContent = 'Click to choose a file, or drag one here — JPG, JPEG or PNG only.';
      fileDrop.classList.remove('has-file');
    } else {
      renderStatus(resultEl, 'error', data.message);
    }
  } catch (err) {
    renderStatus(resultEl, 'error', 'Unable to reach the server. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ============================================================
// Drug Test Report
// ============================================================
const drugFileDrop = document.getElementById('drugFileDrop');
const drugFileInput = document.getElementById('drugFile');
const drugFileDropLabel = document.getElementById('drugFileDropLabel');

drugFileInput.addEventListener('change', () => {
  if (drugFileInput.files[0]) {
    drugFileDropLabel.textContent = `Selected: ${drugFileInput.files[0].name}`;
    drugFileDrop.classList.add('has-file');
  } else {
    drugFileDropLabel.textContent = 'Click to choose a file, or drag one here — PDF, JPG, JPEG or PNG only.';
    drugFileDrop.classList.remove('has-file');
  }
});
['dragover', 'dragleave', 'drop'].forEach((evt) => {
  drugFileDrop.addEventListener(evt, (e) => {
    e.preventDefault();
    drugFileDrop.classList.toggle('drag-over', evt === 'dragover');
    if (evt === 'drop' && e.dataTransfer.files[0]) {
      drugFileInput.files = e.dataTransfer.files;
      drugFileInput.dispatchEvent(new Event('change'));
    }
  });
});

document.getElementById('drugTestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const session = getSession();
  const resultEl = document.getElementById('drugTestResult');
  const btn = document.getElementById('drugTestSubmitBtn');

  const formData = new FormData();
  formData.append('studentId', session.studentId);
  if (drugFileInput.files[0]) formData.append('report', drugFileInput.files[0]);

  setButtonLoading(btn, true);
  try {
    const res = await fetch('/api/drugtest/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      renderStatus(resultEl, 'pending', data.message);
      showToast('success', 'Drug test report submitted for staff review.');
      await refreshProfile();
      renderEligibility();
      document.getElementById('drugTestForm').reset();
      drugFileDropLabel.textContent = 'Click to choose a file, or drag one here — PDF, JPG, JPEG or PNG only.';
      drugFileDrop.classList.remove('has-file');
    } else {
      renderStatus(resultEl, 'error', data.message);
    }
  } catch (err) {
    renderStatus(resultEl, 'error', 'Unable to reach the server. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ============================================================
// Results
// ============================================================
function gradeBadgeClass(grade) {
  const points = GRADE_POINTS[grade];
  if (points === undefined) return '';
  if (points >= 3.3) return '';
  if (points >= 2.0) return 'mid';
  return 'low';
}

function resultsEmptyState(title, text, btnLabel) {
  return `
    <div class="card empty-state">
      <div class="empty-icon"><svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.6"/><path d="M9 12h6M9 16h6M9 8h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>
      <h3>${title}</h3>
      <p>${text}</p>
      <button type="button" class="btn-primary empty-cta" id="resultsGoRegister">${btnLabel}</button>
    </div>`;
}

async function loadResults() {
  const session = getSession();
  if (!session) return;
  const resultEl = document.getElementById('resultsResult');
  const tableWrap = document.getElementById('resultsTableWrap');
  const summaryWrap = document.getElementById('resultsSummaryWrap');
  tableWrap.innerHTML = '';
  summaryWrap.innerHTML = '';
  resultEl.innerHTML = '';

  try {
    const res = await fetch(`/api/results/${session.studentId}`);
    const data = await res.json();
    if (data.success) {
      const graded = data.results.filter((r) => GRADE_POINTS[r.grade] !== undefined);
      const gpa = computeGpa(graded);
      const pending = data.results.length - graded.length;
      summaryWrap.innerHTML = `
        <div class="results-summary">
          <div class="stat-tile">
            <span class="stat-label">Current GPA</span>
            <span class="stat-value">${gpa === null ? '—' : gpa.toFixed(2)}</span>
            <span class="stat-pill muted">${graded.length} graded</span>
          </div>
          <div class="stat-tile">
            <span class="stat-label">Modules</span>
            <span class="stat-value">${data.results.length}</span>
            <span class="stat-pill muted">${pending} awaiting grade</span>
          </div>
        </div>`;

      const rows = data.results
        .map((r) => {
          const isPending = GRADE_POINTS[r.grade] === undefined;
          return `<tr><td><strong>${escapeHtml(r.moduleCode)}</strong></td><td>${escapeHtml(r.moduleTitle)}</td><td><span class="grade-badge ${isPending ? 'pending' : gradeBadgeClass(r.grade)}">${escapeHtml(r.grade)}</span></td></tr>`;
        })
        .join('');
      const printed = new Date().toLocaleDateString(undefined, { dateStyle: 'long' });
      const noticeHtml = pending
        ? `<div class="notice-banner info"><strong>${pending} module${pending > 1 ? 's are' : ' is'} awaiting grades</strong><span>Grades appear here once the Examination Section publishes them after the semester assessment. Until then these modules are listed as Pending.</span></div>`
        : '';
      summaryWrap.insertAdjacentHTML('beforeend', noticeHtml);
      tableWrap.innerHTML = `
        <div class="card results-sheet" id="printableResults">
          <div class="print-letterhead">
            <strong>CST College &mdash; Royal University of Bhutan</strong>
            <span>Official Semester Results &middot; ${escapeHtml(session.name || '')} (${escapeHtml(session.studentId)}) &middot; ${escapeHtml(session.programme || '')} &middot; Issued ${printed}${pending ? ` &middot; Provisional: ${pending} module${pending > 1 ? 's' : ''} awaiting grades` : ''}</span>
          </div>
          <table class="results-table">
            <thead><tr><th>Module Code</th><th>Module Title</th><th>Grade</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <button class="download-btn" id="downloadPdfBtn">
          <svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          Download as PDF
        </button>`;
      document.getElementById('downloadPdfBtn').addEventListener('click', () => window.print());
    } else if (res.status === 403) {
      summaryWrap.innerHTML = resultsEmptyState(
        'No results yet',
        'Results are available once you are registered for at least one module. Complete your tuition payment and drug test verification, then register for your modules.',
        'Go to Registration'
      );
      document.getElementById('resultsGoRegister').addEventListener('click', () => goToTab('register'));
    } else {
      renderStatus(resultEl, 'error', data.message);
    }
  } catch (err) {
    renderStatus(resultEl, 'error', 'Unable to reach the server. Please try again.');
  }
}

// ============================================================
// Staff review queue
// ============================================================
function formatTimestamp(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (err) {
    return iso;
  }
}

function fileThumbMarkup(submission) {
  if (!submission || !submission.fileDataUrl) return '<div class="review-thumb-file">FILE</div>';
  if (submission.fileDataUrl.startsWith('data:image')) {
    return `<img class="review-thumb" src="${submission.fileDataUrl}" alt="Submitted file preview" onclick="window.open('${submission.fileDataUrl.replace(/'/g, "\\'")}', '_blank')" />`;
  }
  const ext = (submission.fileName || '').split('.').pop().toUpperCase();
  return `<div class="review-thumb-file">${escapeHtml(ext || 'FILE')}</div>`;
}

async function loadStaffQueue() {
  try {
    const res = await fetch('/api/staff/queue');
    const data = await res.json();
    if (!data.success) return;
    renderStaffQueue(data.payments || [], data.drugTests || []);
  } catch (err) {
    showToast('error', 'Unable to load the review queue.');
  }
}

function renderStaffQueue(payments, drugTests) {
  document.getElementById('staffStatPayments').textContent = payments.length;
  document.getElementById('staffStatDrugTests').textContent = drugTests.length;
  const totalPending = payments.length + drugTests.length;
  const badge = document.getElementById('staffQueueBadge');
  badge.hidden = totalPending === 0;

  const paymentList = document.getElementById('staffPaymentList');
  paymentList.innerHTML = payments
    .map((p) => {
      const s = p.submission || {};
      return `
        <div class="review-item" data-student="${p.studentId}" data-kind="payment">
          ${fileThumbMarkup(s)}
          <div class="review-body">
            <div class="review-body-top"><strong>${escapeHtml(p.name)}</strong><span class="stat-pill muted">${escapeHtml(p.studentId)}</span></div>
            <div class="review-meta">
              <span>${escapeHtml(p.programme || '')}</span>
              <span>Txn: ${escapeHtml(s.transactionNumber || '—')}</span>
              <span>Submitted ${formatTimestamp(s.submittedAt)}</span>
            </div>
            <div class="review-actions">
              <button class="review-btn approve" data-decision="approve">${ICONS.success} Approve</button>
              <button class="review-btn reject" data-decision="reject">${ICONS.error} Reject</button>
            </div>
          </div>
        </div>`;
    })
    .join('');

  const drugList = document.getElementById('staffDrugTestList');
  drugList.innerHTML = drugTests
    .map((d) => {
      const s = d.submission || {};
      return `
        <div class="review-item" data-student="${d.studentId}" data-kind="drugtest">
          ${fileThumbMarkup(s)}
          <div class="review-body">
            <div class="review-body-top"><strong>${escapeHtml(d.name)}</strong><span class="stat-pill muted">${escapeHtml(d.studentId)}</span></div>
            <div class="review-meta">
              <span>${escapeHtml(d.programme || '')}</span>
              <span>File: ${escapeHtml(s.fileName || '—')}</span>
              <span>Submitted ${formatTimestamp(s.submittedAt)}</span>
            </div>
            <div class="review-actions">
              <button class="review-btn approve" data-decision="approve">${ICONS.success} Approve</button>
              <button class="review-btn reject" data-decision="reject">${ICONS.error} Reject</button>
            </div>
          </div>
        </div>`;
    })
    .join('');
}

async function submitStaffDecision(kind, studentId, approve, note) {
  const session = getSession();
  const endpoint = kind === 'payment' ? `/api/staff/payment/${studentId}/decision` : `/api/staff/drugtest/${studentId}/decision`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffEmail: session.email, approve, note }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(approve ? 'success' : 'warning', data.message);
      loadStaffQueue();
    } else {
      showToast('error', data.message);
    }
  } catch (err) {
    showToast('error', 'Unable to reach the server. Please try again.');
  }
}

document.getElementById('staffPaymentList').addEventListener('click', (e) => {
  const btn = e.target.closest('.review-btn');
  if (!btn) return;
  const item = e.target.closest('.review-item');
  const studentId = item.dataset.student;
  if (btn.dataset.decision === 'approve') {
    submitStaffDecision('payment', studentId, true);
  } else {
    const note = window.prompt('Reason for rejecting this payment (shown to the student):', 'The amount paid does not match the transaction number.');
    if (note === null) return;
    submitStaffDecision('payment', studentId, false, note);
  }
});

document.getElementById('staffDrugTestList').addEventListener('click', (e) => {
  const btn = e.target.closest('.review-btn');
  if (!btn) return;
  const item = e.target.closest('.review-item');
  const studentId = item.dataset.student;
  if (btn.dataset.decision === 'approve') {
    submitStaffDecision('drugtest', studentId, true);
  } else {
    const note = window.prompt('Reason for rejecting this report (shown to the student):', 'The report could not be verified with the clinic.');
    if (note === null) return;
    submitStaffDecision('drugtest', studentId, false, note);
  }
});

// ============================================================
// Restore session on reload
// ============================================================
(function restoreSession() {
  const session = getSession();
  if (!session) return;
  if (session.role === 'staff' && session.email) {
    enterStaffApp(session);
  } else if (session.studentId) {
    enterApp(session);
  }
})();
