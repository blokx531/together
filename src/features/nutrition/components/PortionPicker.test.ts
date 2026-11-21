import { describe, expect, it } from 'vitest';
import { portionQuantity, stepCount } from './PortionPicker';

describe('stepCount', () => {
  it('steps whole servings above one and a half serving below', () => {
    expect(stepCount(1, 'up')).toBe(2);
    expect(stepCount(0.5, 'up')).toBe(1);
    expect(stepCount(1.5, 'up')).toBe(2.5);
    expect(stepCount(2, 'down')).toBe(1);
    expect(stepCount(1, 'down')).toBe(0.5);
    expect(stepCount(1.5, 'down')).toBe(1);
  });
});

describe('portionQuantity', () => {
  const servings = [{ label: '1 medium roti (40 g)', amount: 40 }];
  it('multiplies the serving amount', () => {
    expect(portionQuantity({ mode: 'serving', servingIndex: 0, count: 2 }, servings)).toBe(80);
  });
  it('accepts direct amounts and rejects invalid ones', () => {
    expect(portionQuantity({ mode: 'amount', amountInput: '85' }, servings)).toBe(85);
    expect(portionQuantity({ mode: 'amount', amountInput: '0' }, servings)).toBeNull();
    expect(portionQuantity({ mode: 'amount', amountInput: 'abc' }, servings)).toBeNull();
  });
});
