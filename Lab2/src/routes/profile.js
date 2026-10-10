/**
 * routes/profile.js
 * -----------------------------------------------------------------------
 * GET /api/profile/:studentId
 * Returns a password-free snapshot of a student's record, used by the
 * dashboard to refresh its stats after a payment or registration action
 * without requiring the student to log in again.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const { getPublicProfile } = require('../db');

const router = express.Router();

router.get('/profile/:studentId', (req, res) => {
  const profile = getPublicProfile(req.params.studentId);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }
  return res.status(200).json({ success: true, student: profile });
});

module.exports = router;
