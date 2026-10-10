const request = require('supertest');
const app = require('../server');
const { resetDatabase, students } = require('../src/db');

/**
 * Integration test suite: exercises the full HTTP layer (routes + Express
 * middleware) using supertest, on top of the already unit-tested
 * validators and decision table logic. Resets the in-memory database
 * before each test so tests remain independent of execution order.
 */
beforeEach(() => {
  resetDatabase();
});

describe('POST /api/login', () => {
  test('rejects login when student ID is missing', async () => {
    const res = await request(app).post('/api/login').send({ studentId: '', password: 'Passw0rd' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('rejects login when password format is invalid', async () => {
    const res = await request(app).post('/api/login').send({ studentId: '02240365', password: 'weak' });
    expect(res.status).toBe(400);
  });

  test('rejects login with wrong credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ studentId: '02240365', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('logs in successfully with valid credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ studentId: '02240365', password: 'Passw0rd' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.student.studentId).toBe('02240365');
  });
});

describe('POST /api/register', () => {
  test('returns 404 for an unknown student', async () => {
    const res = await request(app).post('/api/register').send({ studentId: '99999999', moduleCode: 'SWE302' });
    expect(res.status).toBe(404);
  });

  test('rejects registration when tuition has not been paid', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ studentId: '02240365', moduleCode: 'SWE305' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/payment not verified/i);
  });

  test('rejects duplicate module registration once eligible', async () => {
    students['02240365'].tuitionPaid = true; // simulate a verified payment
    const res = await request(app)
      .post('/api/register')
      .send({ studentId: '02240365', moduleCode: 'SWE301' }); // already registered in db.js seed data
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('allows registration when all conditions are satisfied', async () => {
    students['02240365'].tuitionPaid = true;
    const res = await request(app)
      .post('/api/register')
      .send({ studentId: '02240365', moduleCode: 'SWE305' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.registeredModules).toContain('SWE305');
  });
});

describe('POST /api/payment/upload', () => {
  test('rejects upload with no screenshot attached', async () => {
    const res = await request(app)
      .post('/api/payment/upload')
      .field('studentId', '02240365')
      .field('transactionNumber', '123-123456789');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mandatory/i);
  });

  test('rejects upload with an unsupported file type', async () => {
    const res = await request(app)
      .post('/api/payment/upload')
      .field('studentId', '02240365')
      .field('transactionNumber', '123-123456789')
      .attach('screenshot', Buffer.from('dummy'), 'proof.pdf');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid file type/i);
  });

  test('rejects upload with a malformed transaction number', async () => {
    const res = await request(app)
      .post('/api/payment/upload')
      .field('studentId', '02240365')
      .field('transactionNumber', '12-123456789')
      .attach('screenshot', Buffer.from('dummy'), 'proof.jpg');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/format/i);
  });

  test('records a valid submission as pending for staff review (R9)', async () => {
    const res = await request(app)
      .post('/api/payment/upload')
      .field('studentId', '02240365')
      .field('transactionNumber', '123-123456789')
      .attach('screenshot', Buffer.from('dummy'), 'proof.jpg');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('pending');
    expect(students['02240365'].tuitionPaid).toBe(false);
    expect(students['02240365'].paymentStatus).toBe('pending');
  });

  test('rejects upload when studentId does not exist', async () => {
    const res = await request(app)
      .post('/api/payment/upload')
      .field('studentId', '99999999')
      .field('transactionNumber', '123-123456789')
      .attach('screenshot', Buffer.from('dummy'), 'proof.jpg');
    expect(res.status).toBe(404);
  });
});

describe('Staff payment review', () => {
  async function submitPayment() {
    return request(app)
      .post('/api/payment/upload')
      .field('studentId', '02240365')
      .field('transactionNumber', '123-123456789')
      .attach('screenshot', Buffer.from('dummy'), 'proof.jpg');
  }

  test('rejects a decision from an unknown staff account', async () => {
    await submitPayment();
    const res = await request(app)
      .post('/api/staff/payment/02240365/decision')
      .send({ staffEmail: 'nobody.cst@rub.edu.bt', approve: true });
    expect(res.status).toBe(401);
  });

  test('approving generates a receipt (R8) and unblocks the student (R9)', async () => {
    await submitPayment();
    const res = await request(app)
      .post('/api/staff/payment/02240365/decision')
      .send({ staffEmail: 'registrar.cst@rub.edu.bt', approve: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(students['02240365'].tuitionPaid).toBe(true);
    expect(students['02240365'].paymentStatus).toBe('verified');
    expect(students['02240365'].paymentReceipt).toMatch(/^RECEIPT-123-123456789-/);
  });

  test('rejecting leaves tuition unpaid and clears the submission', async () => {
    await submitPayment();
    const res = await request(app)
      .post('/api/staff/payment/02240365/decision')
      .send({ staffEmail: 'registrar.cst@rub.edu.bt', approve: false, note: 'Amount does not match.' });
    expect(res.status).toBe(200);
    expect(students['02240365'].tuitionPaid).toBe(false);
    expect(students['02240365'].paymentStatus).toBe('rejected');
    expect(students['02240365'].paymentReviewNote).toMatch(/does not match/i);
  });

  test('rejects a decision when nothing is pending', async () => {
    const res = await request(app)
      .post('/api/staff/payment/02240365/decision')
      .send({ staffEmail: 'registrar.cst@rub.edu.bt', approve: true });
    expect(res.status).toBe(409);
  });

  test('lists pending payments and drug tests in the staff queue', async () => {
    await submitPayment();
    const res = await request(app).get('/api/staff/queue');
    expect(res.status).toBe(200);
    expect(res.body.payments.some((p) => p.studentId === '02240365')).toBe(true);
  });
});

describe('Account sign-up', () => {
  test('creates a new student account and allows immediate login', async () => {
    const signupRes = await request(app).post('/api/signup/student').send({
      studentId: '02241234',
      password: 'Newpass1',
      name: 'New Student',
      email: '02241234.cst@rub.edu.bt',
      programme: 'BE Civil Engineering',
    });
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.success).toBe(true);

    const loginRes = await request(app)
      .post('/api/login')
      .send({ studentId: '02241234', password: 'Newpass1' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
  });

  test('rejects a student email that is not studentID.cst@rub.edu.bt', async () => {
    const res = await request(app).post('/api/signup/student').send({
      studentId: '02241234',
      password: 'Newpass1',
      name: 'New Student',
      email: 'someone@gmail.com',
      programme: 'BE Civil Engineering',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/studentID\.cst@rub\.edu\.bt/);
  });

  test('rejects a duplicate Student ID', async () => {
    const res = await request(app).post('/api/signup/student').send({
      studentId: '02240365',
      password: 'Newpass1',
      name: 'Duplicate',
      email: '02240365.cst@rub.edu.bt',
      programme: 'BE Software Engineering',
    });
    expect(res.status).toBe(409);
  });

  test('creates a new staff account and allows immediate login', async () => {
    const signupRes = await request(app).post('/api/signup/staff').send({
      email: 'dorji.cst@rub.edu.bt',
      password: 'Staffpass1',
      name: 'Dorji',
    });
    expect(signupRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/staff/login')
      .send({ email: 'dorji.cst@rub.edu.bt', password: 'Staffpass1' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
  });

  test('rejects a staff email that does not match the college format', async () => {
    const res = await request(app).post('/api/signup/staff').send({
      email: 'dorji@gmail.com',
      password: 'Staffpass1',
      name: 'Dorji',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/results/:studentId', () => {
  test('returns 404 for an unknown student', async () => {
    const res = await request(app).get('/api/results/99999999');
    expect(res.status).toBe(404);
  });

  test('denies access to a student with no registered modules', async () => {
    students['02240365'].registeredModules = [];
    const res = await request(app).get('/api/results/02240365');
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/access denied/i);
  });

  test('lists a newly registered module with a Pending grade', async () => {
    students['02240365'].registeredModules.push('SWE305');
    const res = await request(app).get('/api/results/02240365');
    expect(res.status).toBe(200);
    const row = res.body.results.find((r) => r.moduleCode === 'SWE305');
    expect(row).toBeDefined();
    expect(row.grade).toBe('Pending');
  });

  test('returns Module Code, Module Title and Grade for a registered student', async () => {
    const res = await request(app).get('/api/results/02240365');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results[0]).toHaveProperty('moduleCode');
    expect(res.body.results[0]).toHaveProperty('moduleTitle');
    expect(res.body.results[0]).toHaveProperty('grade');
  });
});
