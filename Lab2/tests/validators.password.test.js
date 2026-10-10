const { validatePassword } = require('../src/validators');

/**
 * Test suite: Password validation (R3 - mandatory, R4 - 8-12 characters
 * with at least one uppercase, one lowercase, and one number).
 */
describe('validatePassword (R3, R4)', () => {
  test('TC11: valid password (8 chars, mixed case + number) is accepted', () => {
    expect(validatePassword('Passw0rd')).toEqual({ valid: true, message: 'Password is valid.' });
  });

  test('TC12: empty password is rejected (R3 - mandatory)', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/mandatory/i);
  });

  test('TC13: undefined password is rejected (R3 - mandatory)', () => {
    expect(validatePassword(undefined).valid).toBe(false);
  });

  test('TC14: 7-character password rejected - boundary below minimum', () => {
    const result = validatePassword('Passw0r');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/at least 8/i);
  });

  test('TC15: 8-character password (lower boundary) is accepted', () => {
    expect(validatePassword('Passw0rd').valid).toBe(true);
  });

  test('TC16: 9-character password (lower boundary + 1) is accepted', () => {
    expect(validatePassword('Passw0rd1').valid).toBe(true);
  });

  test('TC17: 11-character password (upper boundary - 1) is accepted', () => {
    expect(validatePassword('Passw0rd123').valid).toBe(true);
  });

  test('TC18: 12-character password (upper boundary) is accepted', () => {
    expect(validatePassword('Passw0rd1234').valid).toBe(true);
  });

  test('TC19: 13-character password rejected - boundary above maximum', () => {
    const result = validatePassword('Passw0rd12345');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/not exceed 12/i);
  });

  test('TC20: password missing an uppercase letter is rejected', () => {
    const result = validatePassword('password1');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/uppercase/i);
  });

  test('TC21: password missing a lowercase letter is rejected', () => {
    const result = validatePassword('PASSWORD1');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/lowercase/i);
  });

  test('TC22: password missing a number is rejected', () => {
    const result = validatePassword('Password');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/number/i);
  });
});
