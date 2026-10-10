const { validateStudentId } = require('../src/validators');

/**
 * Test suite: Student ID validation (R1 - mandatory, R2 - exactly 8 digits,
 * numeric only). Mirrors the Equivalence Partitioning and Boundary Value
 * Analysis classes designed in Lab 1, Activities 1 & 2.
 */
describe('validateStudentId (R1, R2)', () => {
  test('TC01: valid 8-digit numeric ID is accepted', () => {
    expect(validateStudentId('02240365')).toEqual({ valid: true, message: 'Student ID is valid.' });
  });

  test('TC02: empty string is rejected (R1 - mandatory)', () => {
    const result = validateStudentId('');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/mandatory/i);
  });

  test('TC03: undefined is rejected (R1 - mandatory)', () => {
    expect(validateStudentId(undefined).valid).toBe(false);
  });

  test('TC04: null is rejected (R1 - mandatory)', () => {
    expect(validateStudentId(null).valid).toBe(false);
  });

  test('TC05: whitespace-only value is rejected (R1 - mandatory)', () => {
    expect(validateStudentId('        ').valid).toBe(false);
  });

  test('TC06: 7-digit ID is rejected - boundary below (too short)', () => {
    const result = validateStudentId('2240365');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/exactly 8 digits/i);
  });

  test('TC07: 9-digit ID is rejected - boundary above (too long)', () => {
    const result = validateStudentId('022403651');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/exactly 8 digits/i);
  });

  test('TC08: ID containing letters is rejected (numeric only rule)', () => {
    const result = validateStudentId('0224ABCD');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/numbers only/i);
  });

  test('TC09: ID containing a special character is rejected', () => {
    const result = validateStudentId('0224-365');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/numbers only/i);
  });

  test('TC10: exact boundary of 8 digits is accepted', () => {
    expect(validateStudentId('12345678').valid).toBe(true);
  });
});
