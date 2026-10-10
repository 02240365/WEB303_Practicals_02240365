/**
 * routes/signup.js
 * -----------------------------------------------------------------------
 * Account creation for both roles:
 *   POST /api/signup/student - Student ID + password + name + email +
 *     programme. Reuses the same R1/R2 (Student ID) and R3/R4 (Password)
 *     rules as login.
 *   POST /api/signup/staff - college email (name.cst@rub.edu.bt) +
 *     password, same password rule as students.
 *
 * Both reject a duplicate account instead of silently overwriting one.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const {
  validateStudentId,
  validatePassword,
  validateStaffEmail,
  validateRequiredText,
} = require('../validators');
const { findStudent, createStudent, findStaff, createStaff, getPublicProfile, getPublicStaffProfile } = require('../db');

const router = express.Router();

router.post('/signup/student', (req, res) => {
  const { studentId, password, name, email, programme } = req.body;

  const idCheck = validateStudentId(studentId);
  if (!idCheck.valid) {
    return res.status(400).json({ success: false, message: idCheck.message });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ success: false, message: pwCheck.message });
  }

  const nameCheck = validateRequiredText(name, 'Full name');
  if (!nameCheck.valid) {
    return res.status(400).json({ success: false, message: nameCheck.message });
  }

  const programmeCheck = validateRequiredText(programme, 'Programme');
  if (!programmeCheck.valid) {
    return res.status(400).json({ success: false, message: programmeCheck.message });
  }

  if (!email || String(email).trim().toLowerCase() !== `${studentId}.cst@rub.edu.bt`) {
    return res.status(400).json({
      success: false,
      message: 'Student email must follow the format studentID.cst@rub.edu.bt (e.g. 02240365.cst@rub.edu.bt).',
    });
  }

  if (findStudent(studentId)) {
    return res.status(409).json({ success: false, message: 'An account with this Student ID already exists.' });
  }

  createStudent({ studentId, password, name: name.trim(), email: email.trim().toLowerCase(), programme: programme.trim() });
  return res.status(201).json({
    success: true,
    message: 'Account created. You can now log in.',
    student: getPublicProfile(studentId),
  });
});

router.post('/signup/staff', (req, res) => {
  const { email, password, name } = req.body;

  const emailCheck = validateStaffEmail(email);
  if (!emailCheck.valid) {
    return res.status(400).json({ success: false, message: emailCheck.message });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ success: false, message: pwCheck.message });
  }

  const nameCheck = validateRequiredText(name, 'Full name');
  if (!nameCheck.valid) {
    return res.status(400).json({ success: false, message: nameCheck.message });
  }

  if (findStaff(email)) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  const key = String(email).trim().toLowerCase();
  createStaff({ email: key, password, name: name.trim() });
  return res.status(201).json({
    success: true,
    message: 'Staff account created. You can now log in.',
    staff: getPublicStaffProfile(key),
  });
});

module.exports = router;
