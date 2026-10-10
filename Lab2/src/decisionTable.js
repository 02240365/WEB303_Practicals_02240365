/**
 * decisionTable.js
 * -----------------------------------------------------------------------
 * Implements the Registration Decision Table (Lab 1 - Activity 3).
 *
 * Conditions:
 *   1. Tuition Payment Verified?      (paymentVerified)
 *   2. Drug Testing Report Verified?  (drugTestVerified)
 *   3. Registration Period Open?      (periodOpen)
 *
 * Rule: Registration is only Allowed when ALL three conditions are true.
 * When one or more conditions fail, the message returned corresponds to
 * the FIRST failing condition in this priority order:
 *   Payment -> Drug Testing Report -> Registration Period
 * -----------------------------------------------------------------------
 */

/**
 * Evaluates the registration decision table.
 * @param {boolean} paymentVerified
 * @param {boolean} drugTestVerified
 * @param {boolean} periodOpen
 * @returns {{allowed: boolean, message: string}}
 */
function checkRegistrationEligibility(paymentVerified, drugTestVerified, periodOpen) {
  if (paymentVerified && drugTestVerified && periodOpen) {
    return { allowed: true, message: 'Registration Allowed.' };
  }

  if (!paymentVerified) {
    return { allowed: false, message: 'Tuition payment not verified.' };
  }

  if (!drugTestVerified) {
    return { allowed: false, message: 'Drug testing report not verified.' };
  }

  // Only remaining possibility: payment OK, drug test OK, period closed.
  return { allowed: false, message: 'Registration period is closed.' };
}

/**
 * Checks whether a student has already registered for a given module
 * (duplicate module registration rule from the SRS, Section 2).
 * @param {string[]} registeredModules - modules already registered by the student
 * @param {string} moduleCode - module the student wants to register for
 * @returns {{allowed: boolean, message: string}}
 */
function checkDuplicateModule(registeredModules, moduleCode) {
  if (Array.isArray(registeredModules) && registeredModules.includes(moduleCode)) {
    return { allowed: false, message: `Module ${moduleCode} is already registered.` };
  }
  return { allowed: true, message: 'Module is not yet registered.' };
}

module.exports = { checkRegistrationEligibility, checkDuplicateModule };
