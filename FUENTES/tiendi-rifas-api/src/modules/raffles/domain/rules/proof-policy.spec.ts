import { BankOrWallet } from '../enums/raffle-status.enum';
import {
  InvalidPaymentProofError,
  ProofDeadlinePassedError,
  ReservationsClosedError,
} from '../errors/domain.errors';
import { detectProofType, ProofPolicy } from './proof-policy';
import { ReservationPolicy } from './reservation-policy';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1]);
const PDF = Buffer.from('%PDF-1.7\n');
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([1, 2, 3, 4]),
  Buffer.from('WEBPVP8 '),
]);

describe('detectProofType', () => {
  it.each([
    ['image/png', PNG],
    ['image/jpeg', JPEG],
    ['application/pdf', PDF],
    ['image/webp', WEBP],
  ])('recognizes %s by its content', (type, content) => {
    expect(detectProofType(content)).toBe(type);
  });

  it.each([
    ['html disguised as an image', Buffer.from('<script>alert(1)</script>')],
    ['an executable', Buffer.from([0x4d, 0x5a, 0x90, 0x00])],
    ['a RIFF that is not WEBP', Buffer.from('RIFF1234WAVEfmt ')],
    ['an empty file', Buffer.alloc(0)],
  ])('rejects %s', (_label, content) => {
    expect(detectProofType(content)).toBeNull();
  });
});

describe('ProofPolicy', () => {
  const salesCloseAt = new Date('2026-11-10T18:00:00Z');

  it('defaults to 12 hours, 120 minutes and 5 MiB', () => {
    const policy = new ProofPolicy();

    expect(policy.verificationTtlHours).toBe(12);
    expect(policy.deadlineMinutesBeforeClose).toBe(120);
    expect(policy.maxFileBytes).toBe(5 * 1024 * 1024);
  });

  describe('assertBeforeDeadline', () => {
    const policy = new ProofPolicy();

    it('accepts a proof just before the deadline', () => {
      expect(() =>
        policy.assertBeforeDeadline(
          new Date('2026-11-10T15:59:59Z'),
          salesCloseAt,
        ),
      ).not.toThrow();
    });

    it('rejects a proof at the deadline', () => {
      expect(() =>
        policy.assertBeforeDeadline(
          new Date('2026-11-10T16:00:00Z'),
          salesCloseAt,
        ),
      ).toThrow(ProofDeadlinePassedError);
    });

    it('honors a configured margin', () => {
      expect(() =>
        new ProofPolicy({ deadlineMinutesBeforeClose: 30 }).assertBeforeDeadline(
          new Date('2026-11-10T17:29:00Z'),
          salesCloseAt,
        ),
      ).not.toThrow();
    });
  });

  describe('assertReservationsOpen', () => {
    // Close at 18:00, proofs until 16:00, reservations until 15:45.
    const policy = new ProofPolicy();
    const reservation = new ReservationPolicy();
    const open = (at: string, closeAt: Date | null = salesCloseAt) => () =>
      policy.assertReservationsOpen(new Date(at), closeAt, reservation);

    it('accepts a reservation one millisecond before the cutoff', () => {
      expect(open('2026-11-10T15:44:59.999Z')).not.toThrow();
    });

    it('refuses a reservation at the cutoff', () => {
      expect(open('2026-11-10T15:45:00Z')).toThrow(ReservationsClosedError);
    });

    it('refuses a reservation inside the last TTL before the proof deadline', () => {
      expect(open('2026-11-10T15:59:59.999Z')).toThrow(ReservationsClosedError);
    });

    it('refuses a reservation after the close of sales', () => {
      expect(open('2026-11-10T18:00:01Z')).toThrow(ReservationsClosedError);
    });

    it('gives the last accepted reservation its full TTL before the proof deadline', () => {
      const lastAccepted = new Date('2026-11-10T15:44:59.999Z');

      expect(open(lastAccepted.toISOString())).not.toThrow();
      expect(
        reservation.calculateExpiration(lastAccepted).getTime(),
      ).toBeLessThanOrEqual(policy.paymentDeadline(salesCloseAt).getTime());
    });

    it('follows a configured reservation TTL', () => {
      const long = new ReservationPolicy({ reservationTtlMinutes: 30 });

      expect(() =>
        policy.assertReservationsOpen(
          new Date('2026-11-10T15:29:59.999Z'),
          salesCloseAt,
          long,
        ),
      ).not.toThrow();
      expect(() =>
        policy.assertReservationsOpen(
          new Date('2026-11-10T15:30:00Z'),
          salesCloseAt,
          long,
        ),
      ).toThrow(ReservationsClosedError);
    });

    it('shares the configured margin with the proof deadline', () => {
      const short = new ProofPolicy({ deadlineMinutesBeforeClose: 30 });

      expect(() =>
        short.assertReservationsOpen(
          new Date('2026-11-10T17:14:59.999Z'),
          salesCloseAt,
          reservation,
        ),
      ).not.toThrow();
      expect(() =>
        short.assertReservationsOpen(
          new Date('2026-11-10T17:15:00Z'),
          salesCloseAt,
          reservation,
        ),
      ).toThrow(ReservationsClosedError);
    });

    it('ends every TTL by the close of sales when the proof margin is zero', () => {
      const none = new ProofPolicy({ deadlineMinutesBeforeClose: 0 });
      const lastAccepted = new Date('2026-11-10T17:44:59.999Z');

      expect(() =>
        none.assertReservationsOpen(lastAccepted, salesCloseAt, reservation),
      ).not.toThrow();
      expect(() =>
        none.assertReservationsOpen(
          new Date('2026-11-10T17:45:00Z'),
          salesCloseAt,
          reservation,
        ),
      ).toThrow(ReservationsClosedError);
      expect(
        reservation.calculateExpiration(lastAccepted).getTime(),
      ).toBeLessThanOrEqual(salesCloseAt.getTime());
    });

    it('refuses a raffle without a close of sales', () => {
      expect(open('2026-11-01T10:00:00Z', null)).toThrow(
        ReservationsClosedError,
      );
    });

    it('names the cutoff in the error', () => {
      expect(open('2026-11-10T17:00:00Z')).toThrow('2026-11-10T15:45:00.000Z');
    });
  });

  describe('reservationCutoff', () => {
    it('is the proof deadline minus the reservation TTL', () => {
      expect(
        new ProofPolicy().reservationCutoff(
          salesCloseAt,
          new ReservationPolicy(),
        ),
      ).toEqual(new Date('2026-11-10T15:45:00Z'));
    });
  });

  describe('paymentDeadline', () => {
    it('is the close of sales minus the margin', () => {
      expect(new ProofPolicy().paymentDeadline(salesCloseAt)).toEqual(
        new Date('2026-11-10T16:00:00Z'),
      );
    });
  });

  describe('extendedReservationEnd', () => {
    const policy = new ProofPolicy();

    it('adds the verification window', () => {
      expect(
        policy.extendedReservationEnd(
          new Date('2026-11-01T10:00:00Z'),
          salesCloseAt,
        ),
      ).toEqual(new Date('2026-11-01T22:00:00Z'));
    });

    it('never goes past the close of sales', () => {
      expect(
        policy.extendedReservationEnd(
          new Date('2026-11-10T15:00:00Z'),
          salesCloseAt,
        ),
      ).toEqual(salesCloseAt);
    });
  });

  describe('assertValidDeclaration', () => {
    const policy = new ProofPolicy();
    const valid = {
      bankOrWallet: BankOrWallet.PLIN,
      declaredAmount: 10,
      operationNumber: 'OP-1',
    };

    it('accepts an operation number without a file', () => {
      expect(() => policy.assertValidDeclaration(valid)).not.toThrow();
    });

    it('accepts a file without an operation number', () => {
      expect(() =>
        policy.assertValidDeclaration({
          ...valid,
          operationNumber: null,
          file: PNG,
        }),
      ).not.toThrow();
    });

    it('requires a file or an operation number', () => {
      expect(() =>
        policy.assertValidDeclaration({ ...valid, operationNumber: ' ' }),
      ).toThrow(InvalidPaymentProofError);
    });

    it.each([0, -5, Number.NaN])('rejects a declared amount of %s', (amount) => {
      expect(() =>
        policy.assertValidDeclaration({ ...valid, declaredAmount: amount }),
      ).toThrow(InvalidPaymentProofError);
    });

    it('rejects an unknown bank or wallet', () => {
      expect(() =>
        policy.assertValidDeclaration({
          ...valid,
          bankOrWallet: 'PAYPAL' as BankOrWallet,
        }),
      ).toThrow(InvalidPaymentProofError);
    });

    it('rejects a file whose content is not a proof type', () => {
      expect(() =>
        policy.assertValidDeclaration({
          ...valid,
          file: Buffer.from('<html></html>'),
        }),
      ).toThrow(InvalidPaymentProofError);
    });

    it('rejects a file over the size limit', () => {
      const small = new ProofPolicy({ maxFileBytes: 4 });

      expect(() =>
        small.assertValidDeclaration({ ...valid, file: PNG }),
      ).toThrow(InvalidPaymentProofError);
    });
  });
});
