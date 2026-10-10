const { validatePaymentScreenshot, validateTransactionNumber } = require('../src/validators');

/**
 * Test suite: Payment Screenshot validation (R6) and Transaction Number
 * validation (R7).
 */
describe('validatePaymentScreenshot (R6)', () => {
  test('TC23: .jpg file is accepted', () => {
    expect(validatePaymentScreenshot('payment.jpg').valid).toBe(true);
  });

  test('TC24: .jpeg file is accepted', () => {
    expect(validatePaymentScreenshot('payment.jpeg').valid).toBe(true);
  });

  test('TC25: .png file is accepted', () => {
    expect(validatePaymentScreenshot('payment.png').valid).toBe(true);
  });

  test('TC26: .pdf file is rejected - unsupported type', () => {
    const result = validatePaymentScreenshot('payment.pdf');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/invalid file type/i);
  });

  test('TC27: .docx file is rejected - unsupported type', () => {
    expect(validatePaymentScreenshot('payment.docx').valid).toBe(false);
  });

  test('TC28: no file uploaded is rejected (mandatory)', () => {
    const result = validatePaymentScreenshot(null);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/mandatory/i);
  });

  test('TC29: empty filename string is rejected (mandatory)', () => {
    expect(validatePaymentScreenshot('').valid).toBe(false);
  });

  test('TC30: uppercase extension (.JPG) is still accepted (case-insensitive)', () => {
    expect(validatePaymentScreenshot('payment.JPG').valid).toBe(true);
  });

  test('TC30b: filename with no extension at all is rejected', () => {
    expect(validatePaymentScreenshot('payment').valid).toBe(false);
  });
});

describe('validateTransactionNumber (R7)', () => {
  test('TC31: correctly formatted transaction number is accepted', () => {
    expect(validateTransactionNumber('123-123456789')).toEqual({
      valid: true,
      message: 'Transaction number is valid.',
    });
  });

  test('TC32: empty transaction number is rejected (mandatory)', () => {
    const result = validateTransactionNumber('');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/mandatory/i);
  });

  test('TC33: 12-character value rejected - one digit short of format', () => {
    const result = validateTransactionNumber('123-12345678');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/format/i);
  });

  test('TC34: 14-character value rejected - one digit too many', () => {
    expect(validateTransactionNumber('123-1234567890').valid).toBe(false);
  });

  test('TC35: missing hyphen is rejected', () => {
    expect(validateTransactionNumber('123123456789').valid).toBe(false);
  });

  test('TC36: only 2 digits before hyphen is rejected', () => {
    expect(validateTransactionNumber('12-123456789').valid).toBe(false);
  });

  test('TC37: letters instead of digits before hyphen is rejected', () => {
    expect(validateTransactionNumber('ABC-123456789').valid).toBe(false);
  });

  test('TC38: letters instead of digits after hyphen is rejected', () => {
    expect(validateTransactionNumber('123-1234567AB').valid).toBe(false);
  });
});
