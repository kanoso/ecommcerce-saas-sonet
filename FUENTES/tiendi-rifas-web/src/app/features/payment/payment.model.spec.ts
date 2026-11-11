import {
  PROOF_MAX_FILE_BYTES,
  ProofFormValues,
  formatCountdown,
  isFinalPhase,
  parseAmountToCents,
  phaseLabel,
  phaseOf,
  EXPIRY_GRACE_MS,
  isPastDeadline,
  remainingMs,
  serverClockOffsetMs,
  validateProofForm,
} from './payment.model';

describe('serverClockOffsetMs', () => {
  it('measures how far the server clock is from the local one, from hora_servidor', () => {
    const receivedAt = Date.parse('2026-11-03T15:05:00.000Z');
    expect(serverClockOffsetMs(new Date('2026-11-03T15:00:00.250Z'), receivedAt)).toBe(-299_750);
  });

  it('is null without a readable server time', () => {
    expect(serverClockOffsetMs(null, Date.now())).toBeNull();
    expect(serverClockOffsetMs(new Date('not a date'), Date.now())).toBeNull();
  });
});

describe('isPastDeadline', () => {
  const deadline = new Date('2026-11-03T15:15:00.000Z');
  const at = (iso: string) => Date.parse(iso);

  it('is true only once the server clock passed the deadline by the grace', () => {
    // The local clock is 5 minutes ahead of the server.
    const offset = -5 * 60_000;
    expect(isPastDeadline(deadline, at('2026-11-03T15:20:00.000Z'), offset)).toBe(false);
    expect(isPastDeadline(deadline, at('2026-11-03T15:20:02.999Z'), offset)).toBe(false);
    expect(isPastDeadline(deadline, at('2026-11-03T15:20:03.000Z'), offset)).toBe(true);
    expect(EXPIRY_GRACE_MS).toBe(3000);
  });

  it('is false without a deadline: nothing proves the reservation is over', () => {
    expect(isPastDeadline(null, Date.now(), 0)).toBe(false);
  });
});

describe('remainingMs', () => {
  const deadline = new Date('2026-11-03T15:15:00.000Z');

  it('counts down to the server deadline on the server clock', () => {
    const local = Date.parse('2026-11-03T15:20:00.000Z');
    // The local clock is 10 minutes ahead of the server.
    expect(remainingMs(deadline, local, -10 * 60_000)).toBe(5 * 60_000);
  });

  it('never goes below zero, and is zero without a deadline', () => {
    expect(remainingMs(deadline, Date.parse('2026-11-03T16:00:00.000Z'), 0)).toBe(0);
    expect(remainingMs(null, 0, 0)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('shows minutes and seconds, rounding up so zero means time is up', () => {
    expect(formatCountdown(15 * 60_000)).toBe('15:00');
    expect(formatCountdown(899_001)).toBe('15:00');
    expect(formatCountdown(899_000)).toBe('14:59');
    expect(formatCountdown(61_000)).toBe('01:01');
    expect(formatCountdown(1)).toBe('00:01');
  });

  it('shows 00:00 at or past zero', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5000)).toBe('00:00');
  });

  it('adds hours for long deadlines', () => {
    expect(formatCountdown(3_600_000)).toBe('1:00:00');
    expect(formatCountdown(12 * 3_600_000 - 1000)).toBe('11:59:59');
  });
});

describe('money', () => {
  it('reads an amount typed in soles as whole cents', () => {
    expect(parseAmountToCents('20')).toBe(2000);
    expect(parseAmountToCents('20.5')).toBe(2050);
    expect(parseAmountToCents('20,50')).toBe(2050);
    expect(parseAmountToCents(' 20.00 ')).toBe(2000);
    expect(parseAmountToCents('0.1')).toBe(10);
    expect(parseAmountToCents('99999999.99')).toBe(9_999_999_999);
    expect(parseAmountToCents('0')).toBe(0);
  });

  it('refuses text that is not a plain amount with up to two decimals', () => {
    for (const text of ['', '  ', 'abc', '-5', '1e3', '1.005', '1,000.00', '20.', '.5', 'S/ 20']) {
      expect(parseAmountToCents(text), text).toBeNull();
    }
  });
});

describe('validateProofForm', () => {
  const png = { name: 'voucher.png', size: 1000, type: 'image/png' };
  const valid: ProofFormValues = {
    file: png,
    operationNumber: '',
    bankOrWallet: 'YAPE',
    declaredAmount: '20.00',
    acceptedTerms: true,
    paymentAccountId: 'acc-1',
  };
  const check = (values: ProofFormValues) => validateProofForm(values, ['acc-1', 'acc-2']);

  it('needs the operator account the buyer paid to, one of those shown', () => {
    expect(check({ ...valid, paymentAccountId: '' })).toEqual({
      paymentAccount: 'Elige la cuenta a la que transferiste.',
    });
    expect(check({ ...valid, paymentAccountId: 'acc-removed' })).toEqual({
      paymentAccount: 'Elige la cuenta a la que transferiste.',
    });
    expect(check({ ...valid, paymentAccountId: 'acc-2' })).toEqual({});
  });

  it('accepts a file, or an operation number, with a bank, an amount and the terms', () => {
    expect(check(valid)).toEqual({});
    expect(check({ ...valid, file: null, operationNumber: '00123456' })).toEqual({});
    for (const type of ['image/jpeg', 'image/webp', 'application/pdf']) {
      expect(check({ ...valid, file: { ...png, type } }), type).toEqual({});
    }
  });

  it('needs a file or an operation number', () => {
    expect(check({ ...valid, file: null, operationNumber: '   ' })).toEqual({
      file: 'Sube el comprobante o escribe el número de operación.',
    });
  });

  it('applies the size and type limits of the API to the file', () => {
    expect(check({ ...valid, file: { ...png, size: PROOF_MAX_FILE_BYTES } })).toEqual({});
    expect(check({ ...valid, file: { ...png, size: PROOF_MAX_FILE_BYTES + 1 } })).toEqual({
      file: 'El archivo pesa más de 5 MB.',
    });
    expect(check({ ...valid, file: { ...png, size: 0 } })).toEqual({ file: 'El archivo está vacío.' });
    expect(check({ ...valid, file: { name: 'a.gif', size: 10, type: 'image/gif' } })).toEqual({
      file: 'El archivo debe ser una imagen PNG, JPEG o WEBP, o un PDF.',
    });
  });

  it('falls back to the extension when the browser gives no type', () => {
    expect(check({ ...valid, file: { name: 'VOUCHER.PDF', size: 10, type: '' } })).toEqual({});
    expect(check({ ...valid, file: { name: 'voucher.exe', size: 10, type: '' } })).toEqual({
      file: 'El archivo debe ser una imagen PNG, JPEG o WEBP, o un PDF.',
    });
  });

  it('limits the operation number to 100 characters', () => {
    expect(check({ ...valid, operationNumber: '9'.repeat(100) })).toEqual({});
    expect(check({ ...valid, operationNumber: '9'.repeat(101) })).toEqual({
      operationNumber: 'El número de operación admite hasta 100 caracteres.',
    });
  });

  it('needs one of the banks or wallets the API knows', () => {
    const message = 'Elige el banco o la billetera desde la que pagaste.';
    expect(check({ ...valid, bankOrWallet: '' })).toEqual({ bankOrWallet: message });
    expect(check({ ...valid, bankOrWallet: 'CAJA' })).toEqual({ bankOrWallet: message });
  });

  it('needs a positive amount within the API maximum', () => {
    expect(check({ ...valid, declaredAmount: '' })).toEqual({
      declaredAmount: 'Escribe el monto que pagaste.',
    });
    expect(check({ ...valid, declaredAmount: '20.555' })).toEqual({
      declaredAmount: 'Escribe un monto válido, por ejemplo 20.00.',
    });
    expect(check({ ...valid, declaredAmount: '0' })).toEqual({
      declaredAmount: 'El monto debe ser mayor que cero.',
    });
    expect(check({ ...valid, declaredAmount: '100000000' })).toEqual({
      declaredAmount: 'El monto es demasiado alto.',
    });
  });

  it('needs the terms accepted', () => {
    expect(check({ ...valid, acceptedTerms: false })).toEqual({
      acceptedTerms: 'Debes aceptar los términos para enviar el comprobante.',
    });
  });

  it('reports every invalid field at once', () => {
    const errors = check({
      file: null,
      operationNumber: '',
      bankOrWallet: '',
      declaredAmount: '',
      acceptedTerms: false,
      paymentAccountId: '',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'acceptedTerms',
      'bankOrWallet',
      'declaredAmount',
      'file',
      'paymentAccount',
    ]);
  });
});

describe('phaseOf and isFinalPhase', () => {
  it('maps each order status to what the buyer sees', () => {
    expect(phaseOf('PENDING')).toBe('awaiting-proof');
    expect(phaseOf('PENDING_VERIFICATION')).toBe('verifying');
    expect(phaseOf('PAID')).toBe('paid');
    expect(phaseOf('REJECTED')).toBe('rejected');
    expect(phaseOf('REFUND_PENDING')).toBe('refund-pending');
    expect(phaseOf('REFUNDED')).toBe('refunded');
    expect(phaseOf('LATE_PAYMENT_REVIEW')).toBe('late-review');
    expect(phaseOf('LATE_PAYMENT_DISMISSED')).toBe('late-dismissed');
    expect(phaseOf('EXPIRED')).toBe('expired');
  });

  it('never shows an unknown status as paid: it stays in verification', () => {
    expect(phaseOf('SOMETHING_NEW')).toBe('verifying');
  });

  it('stops polling only once the order left verification', () => {
    expect(isFinalPhase('awaiting-proof')).toBe(false);
    expect(isFinalPhase('verifying')).toBe(false);
    for (const phase of ['paid', 'rejected', 'refund-pending', 'refunded', 'late-review', 'late-dismissed', 'expired'] as const) {
      expect(isFinalPhase(phase), phase).toBe(true);
    }
  });
});

describe('phaseLabel', () => {
  it('names each phase as the payment page and the ticket list show it', () => {
    expect(phaseLabel('awaiting-proof')).toBe('Pendiente de pago');
    expect(phaseLabel('verifying')).toBe('Comprobante en verificación');
    expect(phaseLabel('paid')).toBe('Pago aprobado');
    expect(phaseLabel('rejected')).toBe('Pago rechazado');
    expect(phaseLabel('refund-pending')).toBe('Pago rechazado');
    expect(phaseLabel('refunded')).toBe('Pago reembolsado');
    expect(phaseLabel('late-review')).toBe('Pago en revisión');
    expect(phaseLabel('late-dismissed')).toBe('Revisión cerrada');
    expect(phaseLabel('expired')).toBe('Reserva vencida');
  });
});
