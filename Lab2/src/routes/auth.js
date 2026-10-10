/**
 * routes/auth.js
 * -----------------------------------------------------------------------
 * POST /api/login
 * Validates Student ID (R1, R2) and Password (R3, R4) format first, then
 * checks the credentials against the data store.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const { validateStudentId, validatePassword } = require('../validators');
const { findStudent, getPublicProfile } = require('../db');

const router = express.Router();

router.post('/login', (req, res) => {
  const { studentId, password } = req.body;

  // Step 1: format validation (R1, R2, R3, R4)
  const idCheck = validateStudentId(studentId);
  if (!idCheck.valid) {
    return res.status(400).json({ success: false, message: idCheck.message });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ success: false, message: pwCheck.message });
  }

  // Step 2: credential lookup
  const student = findStudent(studentId);
  if (!student || student.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid Student ID or Password.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    // Full (password-free) profile so the dashboard can render immediately
    // without a second round trip.
    student: getPublicProfile(studentId),
  });
});

module.exports = router;
