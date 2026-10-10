/**
 * routes/students.js
 * -----------------------------------------------------------------------
 * Lab 5: PostgreSQL-backed Student Records CRUD API.
 *
 *   GET    /api/students              list all students, or search with ?q=keyword
 *   GET    /api/students/:studentId    view a single student
 *   POST   /api/students               add/register a student
 *   PUT    /api/students/:studentId     update a student
 *   DELETE /api/students/:studentId      delete a student
 * -----------------------------------------------------------------------
 */
const express = require('express');
const { validateStudentId } = require('../validators');
const { StudentRepository, DuplicateStudentError, StudentNotFoundError } = require('../repositories/studentRepository');
const { getPool } = require('../db/pool');

const router = express.Router();

function getRepository() {
  return new StudentRepository(getPool());
}

router.get('/students', async (req, res, next) => {
  try {
    const { q } = req.query;
    const repository = getRepository();
    const students = q ? await repository.searchStudents(q) : await repository.listStudents();
    return res.status(200).json({ success: true, students });
  } catch (err) {
    return next(err);
  }
});

router.get('/students/:studentId', async (req, res, next) => {
  try {
    const repository = getRepository();
    const student = await repository.getStudent(req.params.studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: `No student found with ID ${req.params.studentId}.` });
    }
    return res.status(200).json({ success: true, student });
  } catch (err) {
    return next(err);
  }
});

router.post('/students', async (req, res, next) => {
  try {
    const { studentId, name, email, programme } = req.body;

    const idCheck = validateStudentId(studentId);
    if (!idCheck.valid) {
      return res.status(400).json({ success: false, message: idCheck.message });
    }
    if (!name || !email || !programme) {
      return res.status(400).json({ success: false, message: 'Name, email, and programme are all mandatory.' });
    }

    const repository = getRepository();
    const student = await repository.createStudent({ studentId, name, email, programme });
    return res.status(201).json({ success: true, message: 'Student added successfully.', student });
  } catch (err) {
    if (err instanceof DuplicateStudentError) {
      return res.status(409).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

router.put('/students/:studentId', async (req, res, next) => {
  try {
    const { name, email, programme } = req.body;
    if (!name && !email && !programme) {
      return res.status(400).json({ success: false, message: 'Provide at least one field to update.' });
    }

    const repository = getRepository();
    const student = await repository.updateStudent(req.params.studentId, { name, email, programme });
    return res.status(200).json({ success: true, message: 'Student updated successfully.', student });
  } catch (err) {
    if (err instanceof StudentNotFoundError) {
      return res.status(404).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

router.delete('/students/:studentId', async (req, res, next) => {
  try {
    const repository = getRepository();
    await repository.deleteStudent(req.params.studentId);
    return res.status(200).json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    if (err instanceof StudentNotFoundError) {
      return res.status(404).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

module.exports = router;
