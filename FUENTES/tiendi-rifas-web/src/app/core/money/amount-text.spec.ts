import { centsToAmountText } from './amount-text';

describe('centsToAmountText', () => {
  it('writes whole cents as the decimal text the API expects', () => {
    expect(centsToAmountText(2000)).toBe('20.00');
    expect(centsToAmountText(2050)).toBe('20.50');
    expect(centsToAmountText(5)).toBe('0.05');
    expect(centsToAmountText(9_999_999_999)).toBe('99999999.99');
  });
});
