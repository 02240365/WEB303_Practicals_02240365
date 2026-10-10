/**
 * routes/staffAuth.js
 * -----------------------------------------------------------------------
 * POST /api/staff/login
 * Validates the staff email format and password, then checks the
 * credentials against the staff store. Mirrors routes/auth.js for
 * students.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const { validateStaffEmail, validatePassword } = require('../validators');
const { findStaff, getPublicStaffProfile } = require('../db');

const router = express.Router();

router.post('/staff/login', (req, res) => {
  const { email, password } = req.body;

  const emailCheck = validateStaffEmail(email);
  if (!emailCheck.valid) {
    return res.status(400).json({ success: false, message: emailCheck.message });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ success: false, message: pwCheck.message });
  }

  const key = String(email).trim().toLowerCase();
  const staffMember = findStaff(key);
  if (!staffMember || staffMember.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    staff: getPublicStaffProfile(key),
  });
});

module.exports = router;
