/**
 * routes/registration.js
 * -----------------------------------------------------------------------
 * POST /api/register
 * Applies the Registration Decision Table (payment / drug test / period)
 * and the duplicate-module rule from the SRS, Section 2.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const { findStudent } = require('../db');
const { checkRegistrationEligibility, checkDuplicateModule } = require('../decisionTable');

const router = express.Router();

router.post('/register', (req, res) => {
  const { studentId, moduleCode } = req.body;

  const student = findStudent(studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }

  // Decision-table check: payment verified / drug test verified / period open
  const eligibility = checkRegistrationEligibility(
    student.tuitionPaid,
    student.drugTestVerified,
    student.registrationPeriodOpen
  );

  if (!eligibility.allowed) {
    return res.status(403).json({ success: false, message: eligibility.message });
  }

  // Duplicate module registration check
  const duplicateCheck = checkDuplicateModule(student.registeredModules, moduleCode);
  if (!duplicateCheck.allowed) {
    return res.status(409).json({ success: false, message: duplicateCheck.message });
  }

  student.registeredModules.push(moduleCode);
  return res.status(200).json({
    success: true,
    message: `Successfully registered for ${moduleCode}.`,
    registeredModules: student.registeredModules,
  });
});

module.exports = router;
