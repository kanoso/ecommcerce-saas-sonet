import { BankOrWallet } from '../enums/raffle-status.enum';
import { PaymentAccountValidationError } from '../errors/domain.errors';
import { PaymentAccount, validatePaymentAccountDetails } from './payment-account';

describe('PaymentAccount (DT-19)', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  const later = new Date('2026-11-03T11:00:00Z');

  const yape = () =>
    PaymentAccount.create(
      'account-1',
      { method: BankOrWallet.YAPE, holderName: '  Rifas Tiendi SAC ', accountNumber: '987 654 321' },
      'admin-1',
      now,
    );

  const bcp = () =>
    PaymentAccount.create(
      'account-2',
      {
        method: BankOrWallet.BCP,
        holderName: 'Rifas Tiendi SAC',
        accountNumber: '191-12345678-0-12',
        cci: '002-191-112345678012-55',
        displayOrder: 2,
      },
      'admin-1',
      now,
    );

  describe('create', () => {
    it('normalizes a wallet phone and the holder, active and attributed to its creator', () => {
      const account = yape();

      expect(account).toMatchObject({
        id: 'account-1',
        method: BankOrWallet.YAPE,
        holderName: 'Rifas Tiendi SAC',
        accountNumber: '987654321',
        cci: null,
        displayOrder: 0,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        version: 1,
      });
    });

    it('keeps only the digits of a bank account and its CCI', () => {
      expect(bcp()).toMatchObject({
        accountNumber: '19112345678012',
        cci: '00219111234567801255',
        displayOrder: 2,
      });
    });

    it.each([
      ['a number that is not a mobile', '187654321'],
      ['eight digits', '98765432'],
      ['ten digits', '9876543210'],
      ['letters', '98765432a'],
    ])('rejects a Yape or Plin phone with %s', (_label, phone) => {
      for (const method of [BankOrWallet.YAPE, BankOrWallet.PLIN]) {
        expect(() =>
          PaymentAccount.create('a', { method, holderName: 'Titular', accountNumber: phone }, 'admin-1', now),
        ).toThrow(PaymentAccountValidationError);
      }
    });

    it('rejects a CCI on a wallet', () => {
      expect(() =>
        PaymentAccount.create(
          'a',
          { method: BankOrWallet.PLIN, holderName: 'Titular', accountNumber: '912345678', cci: '00219111234567801255' },
          'admin-1',
          now,
        ),
      ).toThrow(PaymentAccountValidationError);
    });

    it.each([
      ['too short', '123456789'],
      ['too long', '123456789012345678901'],
      ['letters', '1911234567801A'],
    ])('rejects a bank account number %s', (_label, accountNumber) => {
      expect(() =>
        PaymentAccount.create('a', { method: BankOrWallet.BBVA, holderName: 'Titular', accountNumber }, 'admin-1', now),
      ).toThrow(PaymentAccountValidationError);
    });

    it.each([
      ['19 digits', '0021911123456780125'],
      ['21 digits', '002191112345678012555'],
      ['another bank code', '00319111234567801255'],
    ])('rejects a CCI with %s', (_label, cci) => {
      expect(() =>
        PaymentAccount.create(
          'a',
          { method: BankOrWallet.BCP, holderName: 'Titular', accountNumber: '19112345678012', cci },
          'admin-1',
          now,
        ),
      ).toThrow(PaymentAccountValidationError);
    });

    it.each([
      [BankOrWallet.BCP, '002'],
      [BankOrWallet.INTERBANK, '003'],
      [BankOrWallet.BBVA, '011'],
    ])('accepts a %s CCI that starts with its bank code %s', (method, code) => {
      const account = PaymentAccount.create(
        'a',
        { method, holderName: 'Titular', accountNumber: '1234567890123', cci: `${code}12345678901234567` },
        'admin-1',
        now,
      );

      expect(account.cci).toBe(`${code}12345678901234567`);
    });

    it.each([
      ['empty', '   '],
      ['one letter', 'A'],
      ['too long', 'A'.repeat(101)],
    ])('rejects a holder name that is %s', (_label, holderName) => {
      expect(() =>
        PaymentAccount.create('a', { method: BankOrWallet.YAPE, holderName, accountNumber: '987654321' }, 'admin-1', now),
      ).toThrow(PaymentAccountValidationError);
    });

    it.each([-1, 1000, 1.5])('rejects the display order %p', (displayOrder) => {
      expect(() =>
        PaymentAccount.create(
          'a',
          { method: BankOrWallet.YAPE, holderName: 'Titular', accountNumber: '987654321', displayOrder },
          'admin-1',
          now,
        ),
      ).toThrow(PaymentAccountValidationError);
    });
  });

  describe('edit', () => {
    it('returns a new account with the changes, validated, and its editor', () => {
      const original = bcp();

      const edited = original.edit({ holderName: 'Otro Titular', displayOrder: 5 }, 'admin-2', later);

      expect(edited).toMatchObject({
        id: 'account-2',
        holderName: 'Otro Titular',
        accountNumber: '19112345678012',
        displayOrder: 5,
        createdBy: 'admin-1',
        createdAt: now,
        updatedBy: 'admin-2',
        updatedAt: later,
        version: 2,
      });
      expect(original.holderName).toBe('Rifas Tiendi SAC');
    });

    it('tells a change of where the money goes from a pure reorder', () => {
      const original = bcp();

      expect(original.sameDestinationAs(original.edit({ displayOrder: 9 }, 'admin-2', later))).toBe(true);
      expect(original.sameDestinationAs(original.edit({ holderName: 'Otro' }, 'admin-2', later))).toBe(false);
      expect(original.sameDestinationAs(original.edit({ cci: null }, 'admin-2', later))).toBe(false);
    });

    it('validates the merged fields: a bank turned wallet must drop its CCI', () => {
      expect(() =>
        bcp().edit({ method: BankOrWallet.YAPE, accountNumber: '987654321' }, 'admin-2', later),
      ).toThrow(PaymentAccountValidationError);

      expect(
        bcp().edit({ method: BankOrWallet.YAPE, accountNumber: '987654321', cci: null }, 'admin-2', later).cci,
      ).toBeNull();
    });

    it('tells whether anything the buyer sees changed', () => {
      const original = bcp();

      expect(original.sameDetailsAs(original.edit({ holderName: ' Rifas Tiendi SAC ' }, 'admin-2', later))).toBe(true);
      expect(original.sameDetailsAs(original.edit({ displayOrder: 9 }, 'admin-2', later))).toBe(false);
    });
  });

  describe('activation', () => {
    it('deactivates and activates again, naming who did it', () => {
      const inactive = yape().withActive(false, 'admin-2', later);

      expect(inactive).toMatchObject({ active: false, updatedBy: 'admin-2', updatedAt: later, version: 2 });
      expect(inactive.withActive(true, 'admin-3', later)).toMatchObject({ active: true, updatedBy: 'admin-3' });
    });
  });

  it('snapshots every field for the audit, dates as ISO text', () => {
    expect(bcp().snapshot()).toEqual({
      method: 'BCP',
      holderName: 'Rifas Tiendi SAC',
      accountNumber: '19112345678012',
      cci: '00219111234567801255',
      displayOrder: 2,
      active: true,
      version: 1,
      updatedBy: 'admin-1',
      updatedAt: now.toISOString(),
    });
  });

  it('validates details on their own, for a proposal', () => {
    expect(
      validatePaymentAccountDetails({ method: BankOrWallet.PLIN, holderName: ' Ana ', accountNumber: '912 345 678' }),
    ).toEqual({ method: 'PLIN', holderName: 'Ana', accountNumber: '912345678', cci: null, displayOrder: 0 });
    expect(() =>
      validatePaymentAccountDetails({ method: BankOrWallet.PLIN, holderName: 'Ana', accountNumber: '1' }),
    ).toThrow(PaymentAccountValidationError);
  });
});
