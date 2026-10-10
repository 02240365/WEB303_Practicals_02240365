/**
 * routes/drugtest.js
 * -----------------------------------------------------------------------
 * POST /api/drugtest/upload
 * Lets a student submit (or resubmit) their drug test clearance report,
 * one of the three conditions the Registration Decision Table checks
 * (Tuition Payment / Drug Testing Report / Registration Period).
 *
 * As with payment.js, a valid submission is recorded as "pending" here;
 * routes/staff.js exposes the approve/reject decision made by a real
 * Registration Staff member that actually sets drugTestVerified.
 *
 * Uses multer with memory storage, keeping the file as a base64 data URL
 * on the in-memory record so staff can preview it (no files are ever
 * written to disk).
 * -----------------------------------------------------------------------
 */
const express = require('express');
const multer = require('multer');
const { validateDrugTestReport } = require('../validators');
const { findStudent } = require('../db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

router.post('/drugtest/upload', upload.single('report'), (req, res) => {
  const { studentId } = req.body;

  const student = findStudent(studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }

  const fileName = req.file ? req.file.originalname : null;
  const fileCheck = validateDrugTestReport(fileName);
  if (!fileCheck.valid) {
    return res.status(400).json({ success: false, message: fileCheck.message });
  }

  const mimeType = req.file.mimetype || 'application/pdf';
  const fileDataUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;

  student.drugTestStatus = 'pending';
  student.drugTestVerified = false;
  student.drugTestReport = null;
  student.drugTestReviewNote = null;
  student.drugTestSubmission = {
    fileName,
    fileDataUrl,
    submittedAt: new Date().toISOString(),
  };

  return res.status(201).json({
    success: true,
    status: 'pending',
    message: 'Drug test report submitted. Registration staff will verify it shortly.',
  });
});

module.exports = router;
