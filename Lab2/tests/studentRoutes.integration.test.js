/**
 * studentRoutes.integration.test.js
 * -----------------------------------------------------------------------
 * Lab 5 (extra depth): full-stack integration tests that go through the
 * actual Express routes (via supertest), which in turn talk to a real,
 * ephemeral PostgreSQL database started by Testcontainers. This proves
 * the whole Student Management System - application code AND database -
 * work correctly together, not just the repository layer in isolation.
 *
 * setPool() (src/db/pool.js) is used to point the running app's
 * /api/students routes at this test database - the exact same technique
 * used to run the app against docker-compose Postgres normally, just
 * swapped to an ephemeral Testcontainers instance for the test run.
 *
 * Requires Docker Desktop (or an equivalent engine) to be running, same
 * as studentRepository.integration.test.js.
 * -----------------------------------------------------------------------
 */
const request = require('supertest');
const { Pool } = require('pg');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const dbPool = require('../src/db/pool');
const app = require('../server');

jest.setTimeout(120000);

let container;
let pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  await dbPool.initSchema(pool);
  dbPool.setPool(pool); // point the app's Student Records routes at this test database
});

afterAll(async () => {
  await pool.end();
  await container.stop();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE student_records RESTART IDENTITY');
});

function addStudent(overrides = {}) {
  return request(app)
    .post('/api/students')
    .send({
      studentId: '02240900',
      name: 'Test Student',
      email: 't@example.com',
      programme: 'BE SE',
      ...overrides,
    });
}

describe('Student Records CRUD via HTTP', () => {
  test('POST /api/students adds a student', async () => {
    const res = await addStudent();
    expect(res.status).toBe(201);
    expect(res.body.student.studentId).toBe('02240900');
  });

  test('POST /api/students rejects a duplicate Student ID', async () => {
    await addStudent({ studentId: '02240901' });
    const res = await addStudent({ studentId: '02240901' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test('POST /api/students rejects an invalid Student ID format', async () => {
    const res = await addStudent({ studentId: 'abc' });
    expect(res.status).toBe(400);
  });

  test('GET /api/students/:id returns the student', async () => {
    await addStudent({ studentId: '02240902', name: 'Detail Student' });
    const res = await request(app).get('/api/students/02240902');
    expect(res.status).toBe(200);
    expect(res.body.student.name).toBe('Detail Student');
  });

  test('GET /api/students/:id returns 404 for a non-existent student', async () => {
    const res = await request(app).get('/api/students/00000000');
    expect(res.status).toBe(404);
  });

  test('PUT /api/students/:id updates the student', async () => {
    await addStudent({ studentId: '02240903', name: 'Old Name' });
    const res = await request(app).put('/api/students/02240903').send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.student.name).toBe('Updated Name');
  });

  test('PUT /api/students/:id returns 404 for a non-existent student', async () => {
    const res = await request(app).put('/api/students/00000000').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  test('DELETE /api/students/:id deletes the student', async () => {
    await addStudent({ studentId: '02240904' });
    const res = await request(app).delete('/api/students/02240904');
    expect(res.status).toBe(200);
    const check = await request(app).get('/api/students/02240904');
    expect(check.status).toBe(404);
  });

  test('DELETE /api/students/:id returns 404 for a non-existent student', async () => {
    const res = await request(app).delete('/api/students/00000000');
    expect(res.status).toBe(404);
  });

  test('GET /api/students lists all students', async () => {
    await addStudent({ studentId: '02240905', name: 'Listed Student' });
    const res = await request(app).get('/api/students');
    expect(res.status).toBe(200);
    expect(res.body.students.some((s) => s.studentId === '02240905')).toBe(true);
  });

  test('GET /api/students?q=... searches students', async () => {
    await addStudent({ studentId: '02240906', name: 'Searchable Student' });
    const res = await request(app).get('/api/students?q=Searchable');
    expect(res.status).toBe(200);
    expect(res.body.students.some((s) => s.name === 'Searchable Student')).toBe(true);
  });
});
