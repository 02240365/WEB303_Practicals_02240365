# CST College Student Management System
**SWE302 – Software Testing & Quality Assurance – Lab 2**

A small web application implementing the SRS from Lab 1 (Student Login,
Student Registration, Tuition Payment, Result Viewing), together with an
automated Jest unit-test suite that achieves **100% statement, branch,
function and line coverage** on all application logic (`src/**`).

---

## 1. Project Structure

```
student-management-system/
├── server.js                 # Express app entry point
├── package.json
├── src/
│   ├── validators.js         # R1-R7 field validation (pure functions)
│   ├── decisionTable.js      # Registration decision table + duplicate module rule
│   ├── db.js                 # In-memory "database" (demo data)
│   └── routes/
│       ├── auth.js           # POST /api/login
│       ├── registration.js   # POST /api/register
│       ├── payment.js        # POST /api/payment/upload
│       └── results.js        # GET  /api/results/:studentId
├── public/                   # Front-end (HTML/CSS/JS)
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── tests/                    # Jest + Supertest test suites
    ├── validators.studentId.test.js
    ├── validators.password.test.js
    ├── validators.payment.test.js
    ├── decisionTable.test.js
    └── api.test.js
```

---

## 2. Prerequisites

- **Node.js** v18 or later (v22 was used to build this project) and npm.
  Check with: `node -v` and `npm -v`.
- No database installation is required — the app uses an in-memory data
  store, seeded automatically when the server starts.

---

## 3. Step-by-Step: Running the Application

1. **Unzip** the submitted folder and open a terminal inside
   `student-management-system/`.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start the server:**
   ```bash
   npm start
   ```
   You should see:
   ```
   CST Student Management System running at http://localhost:3000
   ```
4. **Open the app** in a browser at **http://localhost:3000**.
5. Log in with the seeded demo account:
   - Student ID: `02240365`
   - Password: `Passw0rd`
6. Explore the four tabs in the left-hand navigation: **Login**,
   **Registration**, **Tuition Payment**, **Results**.

   > Note: the demo student starts with `tuitionPaid = false`, so try the
   > **Tuition Payment** tab first (tick "Simulate: verified by college
   > back-office" and upload any `.jpg`/`.png` file with a transaction
   > number like `123-123456789`) before testing **Registration**, so you
   > can see the decision table allow the registration.

---

## 4. Step-by-Step: Running the Unit Tests

1. From the same project folder, run:
   ```bash
   npm test
   ```
   (This runs `jest --coverage` as configured in `package.json`.)
2. Jest will print a **PASS/FAIL** summary per test file, followed by a
   **coverage table** summarising % Statements, % Branch, % Functions and
   % Lines for every file in `src/`.
3. A detailed HTML coverage report is also generated at:
   ```
   coverage/lcov-report/index.html
   ```
   Open this file directly in a browser to see line-by-line coverage
   highlighting (green = covered, red = uncovered).

---

## 5. What the Tests Cover

| Test file | Requirement(s) covered |
|---|---|
| `validators.studentId.test.js` | R1 (mandatory), R2 (exactly 8 digits, numeric only) — includes boundary values (7/8/9 digits) |
| `validators.password.test.js` | R3 (mandatory), R4 (8-12 chars, upper/lower/number) — includes boundary values (7/8/9/11/12/13 chars) |
| `validators.payment.test.js` | R6 (screenshot mandatory, JPG/JPEG/PNG only), R7 (transaction number format, boundary lengths 12/13/14) |
| `decisionTable.test.js` | All 8 combinations of the registration decision table (payment/drug test/period), plus the duplicate-module rule |
| `api.test.js` | End-to-end HTTP behaviour of every route: login, registration, payment upload (R5, R8, R9), and result viewing, including success and failure paths |

All test IDs (TC01, TC02, …) intentionally mirror the equivalence
partitioning and boundary value test cases designed in **Lab 1**, so the
report can cross-reference Lab 1's test design directly to Lab 2's
automated implementation.

---

## 6. Notes and Assumptions

- The application uses an **in-memory data store** (`src/db.js`) instead
  of a real database, so the project is fully self-contained and the
  marker does not need to install/configure MySQL, MongoDB, etc.
- "College verification" of a payment (R8/R9) is simulated through a
  checkbox on the Payment form, standing in for the back-office
  verification step that would normally happen on the admin side of a
  real system.
- File uploads are handled with `multer` in memory (no files are written
  to disk), keeping the demo safe to run anywhere.
- "Download results as PDF" opens the browser's print dialog on the
  results table, which can be saved as a PDF from any browser's print
  destination options.
