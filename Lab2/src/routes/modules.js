/**
 * routes/modules.js
 * -----------------------------------------------------------------------
 * GET /api/modules
 * Returns the module catalogue shown as a dropdown on the Registration
 * tab, instead of asking the student to free-type a module code from
 * memory.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const { getModuleCatalogue } = require('../db');

const router = express.Router();

router.get('/modules', (req, res) => {
  return res.status(200).json({ success: true, modules: getModuleCatalogue() });
});

module.exports = router;
