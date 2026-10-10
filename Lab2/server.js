/**
 * server.js
 * -----------------------------------------------------------------------
 * Entry point for the CST College Student Management System.
 * Wires up middleware, static file serving, and API routes.
 * -----------------------------------------------------------------------
 */
const express = require('express');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const staffAuthRoutes = require('./src/routes/staffAuth');
const signupRoutes = require('./src/routes/signup');
const registrationRoutes = require('./src/routes/registration');
const paymentRoutes = require('./src/routes/payment');
const drugtestRoutes = require('./src/routes/drugtest');
const staffRoutes = require('./src/routes/staff'); // Registration staff review queue + decisions
const resultsRoutes = require('./src/routes/results');
const studentsRoutes = require('./src/routes/students'); // Lab 5: PostgreSQL-backed Student Records
const profileRoutes = require('./src/routes/profile'); // Dashboard profile refresh
const modulesRoutes = require('./src/routes/modules'); // Registration module catalogue

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the front-end (public/index.html, css, js, icons)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', authRoutes);
app.use('/api', staffAuthRoutes);
app.use('/api', signupRoutes);
app.use('/api', registrationRoutes);
app.use('/api', paymentRoutes);
app.use('/api', drugtestRoutes);
app.use('/api', staffRoutes);
app.use('/api', resultsRoutes);
app.use('/api', studentsRoutes); // Lab 5: /api/students CRUD
app.use('/api', profileRoutes);
app.use('/api', modulesRoutes);

// Fallback: send the SPA shell for any unmatched non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only start listening when run directly (keeps `require('./server')` safe
// for supertest in the API test suite, which manages its own instance).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CST Student Management System running at http://localhost:${PORT}`);
  });
}

module.exports = app;
