/**
 * routes/results.js
 * -----------------------------------------------------------------------
 * GET /api/results/:studentId
 * Only registered students (those with at least one registered module)
 * may view their results: Module Code, Module Title, Grade.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const { findStudent, getModuleCatalogue } = require('../db');

const router = express.Router();

router.get('/results/:studentId', (req, res) => {
  const { studentId } = req.params;
  const student = findStudent(studentId);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found.' });
  }

  // Only registered students (i.e. registeredModules is non-empty) may view results.
  if (!student.registeredModules || student.registeredModules.length === 0) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only registered students may view results.',
    });
  }

  // Every registered module appears on the results sheet. Modules without a
  // published grade yet are listed as "Pending" so a newly registered student
  // sees their enrolment instead of an empty table.
  const catalogue = getModuleCatalogue();
  const results = [...(student.results || [])];
  student.registeredModules.forEach((code) => {
    if (!results.some((r) => r.moduleCode === code)) {
      const mod = catalogue.find((m) => m.code === code);
      results.push({ moduleCode: code, moduleTitle: mod ? mod.title : code, grade: 'Pending' });
    }
  });

  return res.status(200).json({ success: true, results });
});

module.exports = router;
