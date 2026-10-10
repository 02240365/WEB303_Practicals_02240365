/**
 * repositories/studentRepository.js
 * -----------------------------------------------------------------------
 * Data-access layer for Student Records, backed by PostgreSQL (Lab 5).
 *
 * This module is deliberately independent of Express. It is the layer
 * that Lab 5's Testcontainers integration tests exercise directly against
 * a real, ephemeral PostgreSQL database - there is no mocking anywhere in
 * this file.
 *
 * Operations implemented (Lab 5, Instruction step 3):
 *   - createStudent   : add/register a student
 *   - getStudent      : view a single student by Student ID
 *   - searchStudents  : search by partial Student ID or name
 *   - listStudents    : view the list of all registered students
 *   - updateStudent   : update student information
 *   - deleteStudent   : delete a student record
 * Duplicate and not-found handling are implemented as distinct custom
 * error classes so callers (routes, tests) can react to them precisely.
 * -----------------------------------------------------------------------
 */

class DuplicateStudentError extends Error {
  constructor(studentId) {
    super(`A student with ID ${studentId} already exists.`);
    this.name = 'DuplicateStudentError';
  }
}

class StudentNotFoundError extends Error {
  constructor(studentId) {
    super(`No student found with ID ${studentId}.`);
    this.name = 'StudentNotFoundError';
  }
}

/** Maps a raw Postgres row (snake_case) to the application's shape (camelCase). */
function toStudentDTO(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    email: row.email,
    programme: row.programme,
  };
}

class StudentRepository {
  /** @param {import('pg').Pool} pool */
  constructor(pool) {
    this.pool = pool;
  }

  // ------------------------------------------------------------------
  // Create (+ duplicate handling)
  // ------------------------------------------------------------------
  async createStudent({ studentId, name, email, programme }) {
    const existing = await this.getStudent(studentId);
    if (existing) {
      throw new DuplicateStudentError(studentId);
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO student_records (student_id, name, email, programme)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [studentId, name, email, programme]
      );
      return toStudentDTO(result.rows[0]);
    } catch (err) {
      // Postgres error code 23505 = unique_violation. The database's own
      // UNIQUE constraint is the final authority, catching a duplicate
      // created by a concurrent request that slipped past the check above.
      if (err.code === '23505') {
        throw new DuplicateStudentError(studentId);
      }
      throw err;
    }
  }

  // ------------------------------------------------------------------
  // Read (get / search / list) + non-existent handling
  // ------------------------------------------------------------------
  async getStudent(studentId) {
    const result = await this.pool.query('SELECT * FROM student_records WHERE student_id = $1', [studentId]);
    return toStudentDTO(result.rows[0]);
  }

  async getStudentOrThrow(studentId) {
    const student = await this.getStudent(studentId);
    if (!student) {
      throw new StudentNotFoundError(studentId);
    }
    return student;
  }

  async listStudents() {
    const result = await this.pool.query('SELECT * FROM student_records ORDER BY student_id ASC');
    return result.rows.map(toStudentDTO);
  }

  async searchStudents(keyword) {
    const pattern = `%${keyword}%`;
    const result = await this.pool.query(
      `SELECT * FROM student_records
       WHERE student_id ILIKE $1 OR name ILIKE $1
       ORDER BY student_id ASC`,
      [pattern]
    );
    return result.rows.map(toStudentDTO);
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  async updateStudent(studentId, fields) {
    await this.getStudentOrThrow(studentId);

    const allowedFields = ['name', 'email', 'programme'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const key of allowedFields) {
      if (fields[key] !== undefined && fields[key] !== null) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(fields[key]);
        paramIndex += 1;
      }
    }

    if (setClauses.length === 0) {
      return this.getStudent(studentId); // nothing to update
    }

    values.push(studentId);
    const result = await this.pool.query(
      `UPDATE student_records SET ${setClauses.join(', ')} WHERE student_id = $${paramIndex} RETURNING *`,
      values
    );
    return toStudentDTO(result.rows[0]);
  }

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------
  async deleteStudent(studentId) {
    await this.getStudentOrThrow(studentId);
    await this.pool.query('DELETE FROM student_records WHERE student_id = $1', [studentId]);
    return true;
  }
}

module.exports = { StudentRepository, DuplicateStudentError, StudentNotFoundError };
