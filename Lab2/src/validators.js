/**
 * validators.js
 * -----------------------------------------------------------------------
 * Pure validation functions that implement the Software Requirements
 * Specification (SRS) rules from SWE302 - Lab 1 / Lab 2.
 *
 * Every function is a PURE function (no side effects, no I/O) so that it
 * can be unit tested in isolation with 100% branch coverage. Each
 * function returns an object in the shape:
 *   { valid: boolean, message: string }
 *
 * Requirement mapping:
 *   R1 - Student ID is mandatory
 *   R2 - Student ID must be exactly 8 digits, numeric only
 *   R3 - Password is mandatory
 *   R4 - Password must be 8-12 characters with 1 uppercase, 1 lowercase,
 *        1 number
 *   R6 - Payment screenshot is mandatory and must be JPG/JPEG/PNG
 *   R7 - Transaction number must follow the pattern DDD-DDDDDDDDD
 *        (3 digits, hyphen, 9 digits => 13 characters total)
 * -----------------------------------------------------------------------
 */

// Regex patterns kept as named constants so they are easy to audit/reuse.
const STUDENT_ID_REGEX = /^\d{8}$/; // exactly 8 digits, numbers only (R2)
const TRANSACTION_NUMBER_REGEX = /^\d{3}-\d{9}$/; // 3 digits - hyphen - 9 digits (R7)
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const ALLOWED_SCREENSHOT_EXTENSIONS = ['jpg', 'jpeg', 'png']; // (R6)
// Staff sign-in uses a college email instead of a Student ID: one name
// token, then the fixed "@rub.edu.bt" domain (e.g. dorji.cst@rub.edu.bt).
const STAFF_EMAIL_REGEX = /^[a-z][a-z0-9]*\.cst@rub\.edu\.bt$/i;
const ALLOWED_DRUG_TEST_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']; // clinic reports are usually scanned as a PDF

/**
 * Validates a Student ID against R1 (mandatory) and R2 (exactly 8 digits,
 * numeric only).
 * @param {string} studentId
 * @returns {{valid: boolean, message: string}}
 */
function validateStudentId(studentId) {
  // R1: mandatory field check. Treat null/undefined/empty-string/whitespace
  // as "missing".
  if (studentId === undefined || studentId === null || String(studentId).trim() === '') {
    return { valid: false, message: 'Student ID is mandatory.' };
  }

  // R2: must be exactly 8 digits, numbers only.
  if (!STUDENT_ID_REGEX.test(studentId)) {
    if (!/^\d+$/.test(studentId)) {
      return { valid: false, message: 'Student ID must contain numbers only.' };
    }
    return { valid: false, message: 'Student ID must contain exactly 8 digits.' };
  }

  return { valid: true, message: 'Student ID is valid.' };
}

/**
 * Validates a Password against R3 (mandatory) and R4 (8-12 chars,
 * at least 1 uppercase, 1 lowercase and 1 number).
 * @param {string} password
 * @returns {{valid: boolean, message: string}}
 */
function validatePassword(password) {
  // R3: mandatory field check.
  if (password === undefined || password === null || String(password) === '') {
    return { valid: false, message: 'Password is mandatory.' };
  }

  // R4: length must be between 8 and 12 characters (inclusive).
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 12) {
    return { valid: false, message: 'Password must not exceed 12 characters.' };
  }

  // R4: character composition rules.
  if (!UPPERCASE_REGEX.test(password)) {
    return { valid: false, message: 'Password must include at least one uppercase letter.' };
  }
  if (!LOWERCASE_REGEX.test(password)) {
    return { valid: false, message: 'Password must include at least one lowercase letter.' };
  }
  if (!NUMBER_REGEX.test(password)) {
    return { valid: false, message: 'Password must include at least one number.' };
  }

  return { valid: true, message: 'Password is valid.' };
}

/**
 * Validates a payment screenshot file name against R6 (mandatory,
 * JPG/JPEG/PNG only).
 * @param {string} fileName - e.g. "payment.jpg"
 * @returns {{valid: boolean, message: string}}
 */
function validatePaymentScreenshot(fileName) {
  if (!fileName || String(fileName).trim() === '') {
    return { valid: false, message: 'Payment screenshot is mandatory.' };
  }

  const parts = String(fileName).split('.');
  const extension = parts.length > 1 ? parts.pop().toLowerCase() : '';

  if (!ALLOWED_SCREENSHOT_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      message: 'Invalid file type. Only JPG, JPEG, or PNG files are accepted.',
    };
  }

  return { valid: true, message: 'Payment screenshot is valid.' };
}

/**
 * Validates a drug test report file name - mandatory, PDF/JPG/JPEG/PNG
 * only (clinics typically issue a scanned PDF, but a photo is accepted
 * too, mirroring the payment screenshot rule).
 * @param {string} fileName - e.g. "drug-test-report.pdf"
 * @returns {{valid: boolean, message: string}}
 */
function validateDrugTestReport(fileName) {
  if (!fileName || String(fileName).trim() === '') {
    return { valid: false, message: 'Drug test report is mandatory.' };
  }

  const parts = String(fileName).split('.');
  const extension = parts.length > 1 ? parts.pop().toLowerCase() : '';

  if (!ALLOWED_DRUG_TEST_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      message: 'Invalid file type. Only PDF, JPG, JPEG, or PNG files are accepted.',
    };
  }

  return { valid: true, message: 'Drug test report is valid.' };
}

/**
 * Validates a transaction number against R7 (mandatory, format
 * DDD-DDDDDDDDD, 13 characters total).
 * @param {string} transactionNumber
 * @returns {{valid: boolean, message: string}}
 */
function validateTransactionNumber(transactionNumber) {
  if (
    transactionNumber === undefined ||
    transactionNumber === null ||
    String(transactionNumber).trim() === ''
  ) {
    return { valid: false, message: 'Transaction number is mandatory.' };
  }

  if (!TRANSACTION_NUMBER_REGEX.test(transactionNumber)) {
    return {
      valid: false,
      message: 'Transaction number must follow the format 123-123456789 (3 digits, hyphen, 9 digits).',
    };
  }

  return { valid: true, message: 'Transaction number is valid.' };
}

/**
 * Validates a staff email against the college's staff address format:
 * one name token followed by the fixed "@rub.edu.bt" domain, e.g.
 * dorji.cst@rub.edu.bt.
 * @param {string} email
 * @returns {{valid: boolean, message: string}}
 */
function validateStaffEmail(email) {
  if (email === undefined || email === null || String(email).trim() === '') {
    return { valid: false, message: 'Staff email is mandatory.' };
  }
  if (!STAFF_EMAIL_REGEX.test(String(email).trim())) {
    return {
      valid: false,
      message: 'Staff email must follow the format name.cst@rub.edu.bt.',
    };
  }
  return { valid: true, message: 'Staff email is valid.' };
}

/**
 * Validates that a required free-text field (name, programme, ...) is
 * present and not just whitespace.
 * @param {string} value
 * @param {string} fieldLabel - used in the returned message, e.g. "Name"
 * @returns {{valid: boolean, message: string}}
 */
function validateRequiredText(value, fieldLabel) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { valid: false, message: `${fieldLabel} is mandatory.` };
  }
  return { valid: true, message: `${fieldLabel} is valid.` };
}

module.exports = {
  validateStudentId,
  validatePassword,
  validatePaymentScreenshot,
  validateTransactionNumber,
  validateDrugTestReport,
  validateStaffEmail,
  validateRequiredText,
  STUDENT_ID_REGEX,
  TRANSACTION_NUMBER_REGEX,
  STAFF_EMAIL_REGEX,
  ALLOWED_SCREENSHOT_EXTENSIONS,
  ALLOWED_DRUG_TEST_EXTENSIONS,
};
