const { checkRegistrationEligibility, checkDuplicateModule } = require('../src/decisionTable');

/**
 * Test suite: Registration Decision Table (Lab 1 - Activity 3).
 * Covers all 8 combinations of the three conditions:
 *   Payment Verified / Drug Test Verified / Registration Period Open
 */
describe('checkRegistrationEligibility (Decision Table - all 8 rules)', () => {
  test('Rule 1: Y, Y, Y -> Registration Allowed', () => {
    expect(checkRegistrationEligibility(true, true, true)).toEqual({
      allowed: true,
      message: 'Registration Allowed.',
    });
  });

  test('Rule 2: Y, Y, N -> Registration period is closed', () => {
    expect(checkRegistrationEligibility(true, true, false)).toEqual({
      allowed: false,
      message: 'Registration period is closed.',
    });
  });

  test('Rule 3: Y, N, Y -> Drug testing report not verified', () => {
    expect(checkRegistrationEligibility(true, false, true)).toEqual({
      allowed: false,
      message: 'Drug testing report not verified.',
    });
  });

  test('Rule 4: Y, N, N -> Drug testing report not verified (priority order)', () => {
    expect(checkRegistrationEligibility(true, false, false)).toEqual({
      allowed: false,
      message: 'Drug testing report not verified.',
    });
  });

  test('Rule 5: N, Y, Y -> Tuition payment not verified', () => {
    expect(checkRegistrationEligibility(false, true, true)).toEqual({
      allowed: false,
      message: 'Tuition payment not verified.',
    });
  });

  test('Rule 6: N, Y, N -> Tuition payment not verified (priority order)', () => {
    expect(checkRegistrationEligibility(false, true, false)).toEqual({
      allowed: false,
      message: 'Tuition payment not verified.',
    });
  });

  test('Rule 7: N, N, Y -> Tuition payment not verified (priority order)', () => {
    expect(checkRegistrationEligibility(false, false, true)).toEqual({
      allowed: false,
      message: 'Tuition payment not verified.',
    });
  });

  test('Rule 8: N, N, N -> Tuition payment not verified (priority order)', () => {
    expect(checkRegistrationEligibility(false, false, false)).toEqual({
      allowed: false,
      message: 'Tuition payment not verified.',
    });
  });
});

describe('checkDuplicateModule', () => {
  test('allows registration for a module not already registered', () => {
    expect(checkDuplicateModule(['SWE301'], 'SWE302')).toEqual({
      allowed: true,
      message: 'Module is not yet registered.',
    });
  });

  test('rejects registration for a module already registered', () => {
    const result = checkDuplicateModule(['SWE301', 'SWE302'], 'SWE302');
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/already registered/i);
  });

  test('handles an empty registered-modules list', () => {
    expect(checkDuplicateModule([], 'SWE302').allowed).toBe(true);
  });

  test('handles a non-array registeredModules value gracefully', () => {
    expect(checkDuplicateModule(undefined, 'SWE302').allowed).toBe(true);
  });
});
