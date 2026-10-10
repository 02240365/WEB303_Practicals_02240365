/**
 * db.js
 * -----------------------------------------------------------------------
 * A simple IN-MEMORY data store used in place of a real database so the
 * whole application (and its automated tests) can run without any
 * external setup. Data resets every time the server restarts.
 *
 * Two kinds of accounts live here:
 *   - students, keyed by Student ID (any student can sign up - see
 *     routes/signup.js)
 *   - staff, keyed by email (registration office staff who verify
 *     payments and drug test reports before a student can register)
 *
 * Seeded with one demo student and one demo staff account so the marker
 * can log in immediately:
 *   Student ID: 02240365        Password: Passw0rd
 *   Staff email: registrar.cst@rub.edu.bt   Password: Passw0rd
 * -----------------------------------------------------------------------
 */

function demoStudent() {
  return {
    studentId: '02240365',
    password: 'Passw0rd', // NOTE: plain text for demo purposes only, not for production use
    name: 'Demo Student',
    email: '02240365.cst@rub.edu.bt',
    programme: 'BE Software Engineering',
    semester: 'Semester 5, 2026',
    tuitionPaid: false,
    paymentStatus: 'none', // 'none' | 'pending' | 'verified' | 'rejected'
    paymentSubmission: null, // { transactionNumber, fileName, fileDataUrl, submittedAt }
    paymentReceipt: null,
    paymentReviewNote: null,
    drugTestVerified: true,
    drugTestStatus: 'verified',
    drugTestSubmission: null, // { fileName, fileDataUrl, submittedAt }
    drugTestReport: 'DRUGTEST-ON-FILE-2026',
    drugTestReviewNote: null,
    registrationPeriodOpen: true,
    registeredModules: ['SWE301'],
    results: [
      { moduleCode: 'SWE301', moduleTitle: 'Requirements Engineering', grade: 'A' },
      { moduleCode: 'SWE302', moduleTitle: 'Software Testing & QA', grade: 'B+' },
    ],
  };
}

function demoStaff() {
  return {
    email: 'registrar.cst@rub.edu.bt',
    password: 'Passw0rd',
    name: 'Registration Office',
    role: 'Registration Staff',
  };
}

const students = {
  '02240365': demoStudent(),
};

const staff = {
  'registrar.cst@rub.edu.bt': demoStaff(),
};

// Static module catalogue used by the Registration tab (not a DB table -
// this is reference data, not student records, so it lives alongside the
// in-memory store rather than in PostgreSQL).
const moduleCatalogue = [
  { code: 'SWE301', title: 'Requirements Engineering', credits: 3 },
  { code: 'SWE302', title: 'Software Testing & Quality Assurance', credits: 3 },
  { code: 'SWE303', title: 'Software Project Management', credits: 3 },
  { code: 'WEB303', title: 'Microservices & Serverless Computing', credits: 3 },
  { code: 'CSF301', title: 'Database Systems', credits: 4 },
  { code: 'CSF302', title: 'Design and Analysis of Algorithms', credits: 4 },
];

function findStudent(studentId) {
  return students[studentId] || null;
}

function findStaff(email) {
  const key = String(email || '').toLowerCase();
  return staff[key] || null;
}

function createStudent({ studentId, password, name, email, programme }) {
  const student = {
    studentId,
    password,
    name,
    email,
    programme,
    semester: 'Semester 5, 2026',
    tuitionPaid: false,
    paymentStatus: 'none',
    paymentSubmission: null,
    paymentReceipt: null,
    paymentReviewNote: null,
    drugTestVerified: false,
    drugTestStatus: 'none',
    drugTestSubmission: null,
    drugTestReport: null,
    drugTestReviewNote: null,
    registrationPeriodOpen: true,
    registeredModules: [],
    results: [],
  };
  students[studentId] = student;
  return student;
}

function createStaff({ email, password, name }) {
  const key = String(email).toLowerCase();
  const record = { email: key, password, name, role: 'Registration Staff' };
  staff[key] = record;
  return record;
}

/**
 * Returns a safe copy of a student's profile (no password field), for
 * endpoints that hand data to the front-end dashboard.
 */
function getPublicProfile(studentId) {
  const student = findStudent(studentId);
  if (!student) return null;
  const { password, ...publicProfile } = student;
  // Uploaded files stay server-side (staff queue only); the student's own view
  // needs just the metadata, which also keeps the status auto-refresh light.
  ['paymentSubmission', 'drugTestSubmission'].forEach((key) => {
    if (publicProfile[key]) {
      const { fileDataUrl, ...meta } = publicProfile[key];
      publicProfile[key] = meta;
    }
  });
  return publicProfile;
}

function getPublicStaffProfile(email) {
  const record = findStaff(email);
  if (!record) return null;
  const { password, ...publicProfile } = record;
  return publicProfile;
}

function getModuleCatalogue() {
  return moduleCatalogue;
}

/** All students with a payment submission awaiting staff review. */
function getPendingPayments() {
  return Object.values(students)
    .filter((s) => s.paymentStatus === 'pending')
    .map((s) => ({
      studentId: s.studentId,
      name: s.name,
      programme: s.programme,
      submission: s.paymentSubmission,
    }));
}

/** All students with a drug test submission awaiting staff review. */
function getPendingDrugTests() {
  return Object.values(students)
    .filter((s) => s.drugTestStatus === 'pending')
    .map((s) => ({
      studentId: s.studentId,
      name: s.name,
      programme: s.programme,
      submission: s.drugTestSubmission,
    }));
}

function resetDatabase() {
  // Restores the demo accounts to a known state, and clears any accounts
  // created via sign-up during a previous test run.
  Object.keys(students).forEach((key) => delete students[key]);
  Object.keys(staff).forEach((key) => delete staff[key]);
  students['02240365'] = demoStudent();
  staff['registrar.cst@rub.edu.bt'] = demoStaff();
}

module.exports = {
  students,
  staff,
  findStudent,
  findStaff,
  createStudent,
  createStaff,
  getPublicProfile,
  getPublicStaffProfile,
  getModuleCatalogue,
  getPendingPayments,
  getPendingDrugTests,
  resetDatabase,
};
