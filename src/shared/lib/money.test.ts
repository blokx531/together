import { describe, expect, it } from 'vitest';
import { formatPaise, MAX_AMOUNT_PAISE, paiseToInputValue, parseRupeesToPaise } from './money';

describe('parseRupeesToPaise', () => {
  it.each([
    ['1200', 120000],
    ['1,200', 120000],
    ['12,00,000', 120000000],
    ['₹ 600.5', 60050],
    ['0.01', 1],
    ['0.10', 10],
    ['99.99', 9999],
  ])('parses %s', (input, expected) => {
    expect(parseRupeesToPaise(input)).toBe(expected);
  });

  it.each(['', '-5', '1.234', 'abc', '1..2', '1,2', '.5', '1e3'])('rejects %s', (input) => {
    expect(parseRupeesToPaise(input)).toBeNull();
  });

  it('avoids floating-point drift', () => {
    // 0.29 * 100 is 28.999999999999996 in binary floating point.
    expect(parseRupeesToPaise('0.29')).toBe(29);
    expect(parseRupeesToPaise('1.13')).toBe(113);
  });

  it('enforces the maximum amount', () => {
    expect(parseRupeesToPaise('100000000')).toBe(MAX_AMOUNT_PAISE);
    expect(parseRupeesToPaise('100000000.01')).toBeNull();
  });
});

describe('formatPaise', () => {
  it('uses Indian grouping and hides zero paise', () => {
    expect(formatPaise(120000)).toBe('₹1,200');
    expect(formatPaise(120000000)).toBe('₹12,00,000');
  });
  it('shows paise when present', () => {
    expect(formatPaise(60050)).toBe('₹600.50');
    expect(formatPaise(1)).toBe('₹0.01');
  });
});

describe('paiseToInputValue', () => {
  it('round-trips through the parser', () => {
    for (const paise of [1, 10, 99, 100, 60050, 123456789]) {
      expect(parseRupeesToPaise(paiseToInputValue(paise))).toBe(paise);
    }
  });
});
