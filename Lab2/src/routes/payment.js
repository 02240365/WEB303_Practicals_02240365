/**
 * routes/payment.js
 * -----------------------------------------------------------------------
 * POST /api/payment/upload
 * Implements R5 (Mobile Banking only - informational/fixed method),
 * R6 (screenshot mandatory + file type), R7 (transaction number format).
 *
 * R8/R9 (receipt generated once verified / registration stays incomplete
 * otherwise) are now driven by a real Registration Staff review instead
 * of the student self-certifying: a valid submission is recorded as
 * "pending" here, and routes/staff.js exposes the approve/reject
 * decision that actually sets tuitionPaid and generates the receipt.
 *
 * Uses multer with memory storage, and keeps the uploaded file as a
 * small base64 data URL on the in-memory student record so the staff
 * dashboard can preview it - no files are ever written to disk (keeps
 * the demo self-contained and safe to run anywhere).
 * -----------------------------------------------------------------------
 */
const express = require('express');
const multer = require('multer');
const { validatePaymentScreenshot, validateTransactionNumber } = require('../validators');
const { findStudent } = require('../db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

router.post('/payment/upload', upload.single('screenshot'), (req, res) => {
  const { studentId, transactionNumber } = req.body;

  const student = findStudent(studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }

  // R6: screenshot mandatory + file type check
  const fileName = req.file ? req.file.originalname : null;
  const fileCheck = validatePaymentScreenshot(fileName);
  if (!fileCheck.valid) {
    return res.status(400).json({ success: false, message: fileCheck.message });
  }

  // R7: transaction number format check
  const txnCheck = validateTransactionNumber(transactionNumber);
  if (!txnCheck.valid) {
    return res.status(400).json({ success: false, message: txnCheck.message });
  }

  const mimeType = req.file.mimetype || 'image/jpeg';
  const fileDataUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;

  student.paymentStatus = 'pending';
  student.tuitionPaid = false;
  student.paymentReceipt = null;
  student.paymentReviewNote = null;
  student.paymentSubmission = {
    transactionNumber,
    fileName,
    fileDataUrl,
    submittedAt: new Date().toISOString(),
  };

  return res.status(201).json({
    success: true,
    status: 'pending',
    message: 'Payment submitted. Registration staff will verify it shortly.',
  });
});

module.exports = router;
