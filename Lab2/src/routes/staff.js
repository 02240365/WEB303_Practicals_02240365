/**
 * routes/staff.js
 * -----------------------------------------------------------------------
 * Registration Staff review queue and decisions.
 *
 *   GET  /api/staff/queue
 *     Returns every pending payment and drug test submission, across all
 *     students, for the staff dashboard to list.
 *
 *   POST /api/staff/payment/:studentId/decision
 *   POST /api/staff/drugtest/:studentId/decision
 *     Body: { staffEmail, approve: boolean, note?: string }
 *     Approving sets tuitionPaid / drugTestVerified to true (generating a
 *     receipt for payment) - this is what actually unblocks Registration
 *     for that student. Rejecting clears the pending submission and
 *     leaves the requirement unmet, with the staff member's note stored
 *     so the student can see why.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const { findStudent, findStaff, getPendingPayments, getPendingDrugTests } = require('../db');

const router = express.Router();

function requireStaff(req, res) {
  const staffMember = findStaff(req.body.staffEmail);
  if (!staffMember) {
    res.status(401).json({ success: false, message: 'Staff sign-in required.' });
    return null;
  }
  return staffMember;
}

router.get('/staff/queue', (req, res) => {
  return res.status(200).json({
    success: true,
    payments: getPendingPayments(),
    drugTests: getPendingDrugTests(),
  });
});

router.post('/staff/payment/:studentId/decision', (req, res) => {
  const staffMember = requireStaff(req, res);
  if (!staffMember) return;

  const student = findStudent(req.params.studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }
  if (student.paymentStatus !== 'pending') {
    return res.status(409).json({ success: false, message: 'This student has no payment awaiting review.' });
  }

  const { approve, note } = req.body;
  if (approve) {
    student.tuitionPaid = true;
    student.paymentStatus = 'verified';
    student.paymentReceipt = `RECEIPT-${student.paymentSubmission.transactionNumber}-${Date.now()}`;
    student.paymentReviewNote = note || null;
  } else {
    student.tuitionPaid = false;
    student.paymentStatus = 'rejected';
    student.paymentReceipt = null;
    student.paymentReviewNote = note || 'Payment could not be verified. Please resubmit.';
    student.paymentSubmission = null;
  }

  return res.status(200).json({
    success: true,
    message: approve ? `Payment approved for ${student.studentId}.` : `Payment rejected for ${student.studentId}.`,
  });
});

router.post('/staff/drugtest/:studentId/decision', (req, res) => {
  const staffMember = requireStaff(req, res);
  if (!staffMember) return;

  const student = findStudent(req.params.studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }
  if (student.drugTestStatus !== 'pending') {
    return res.status(409).json({ success: false, message: 'This student has no drug test report awaiting review.' });
  }

  const { approve, note } = req.body;
  if (approve) {
    student.drugTestVerified = true;
    student.drugTestStatus = 'verified';
    student.drugTestReport = `DRUGTEST-${student.drugTestSubmission.fileName}-${Date.now()}`;
    student.drugTestReviewNote = note || null;
  } else {
    student.drugTestVerified = false;
    student.drugTestStatus = 'rejected';
    student.drugTestReport = null;
    student.drugTestReviewNote = note || 'Drug test report could not be verified. Please resubmit.';
    student.drugTestSubmission = null;
  }

  return res.status(200).json({
    success: true,
    message: approve ? `Drug test report approved for ${student.studentId}.` : `Drug test report rejected for ${student.studentId}.`,
  });
});

module.exports = router;
