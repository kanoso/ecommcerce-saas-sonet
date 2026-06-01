import {
  loginSchema,
  registerStep1Schema,
  registerStep2Schema,
  otpSchema,
  forgotPasswordSchema,
} from '../auth.schemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errorsFor(result: ReturnType<typeof loginSchema.safeParse>): string[] {
  if (result.success) return [];
  return result.error.issues.map((i) => i.path.join('.'));
}

function messageFor(result: ReturnType<typeof loginSchema.safeParse>): string[] {
  if (result.success) return [];
  return result.error.issues.map((i) => i.message);
}

// ─── loginSchema ──────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'test@test.com', password: 'Password1' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'Password1' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('email');
  });

  it('rejects empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'Password1' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('email');
  });

  it('rejects password shorter than 8 characters', () => {
    const result = loginSchema.safeParse({ email: 'test@test.com', password: 'Pass1' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('password');
  });

  it('rejects password without uppercase letter', () => {
    const result = loginSchema.safeParse({ email: 'test@test.com', password: 'password1' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('password');
  });

  it('rejects password without a number', () => {
    const result = loginSchema.safeParse({ email: 'test@test.com', password: 'Password' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('password');
  });
});

// ─── registerStep1Schema ──────────────────────────────────────────────────────

describe('registerStep1Schema', () => {
  const validPayload = {
    firstName: 'Juan',
    lastName: 'Perez',
    documentType: 'DNI' as const,
    documentNumber: '12345',
    email: 'juan@test.com',
    phone: '1234567',
    password: 'Password1',
    confirmPassword: 'Password1',
  };

  it('accepts a complete valid object', () => {
    const result = registerStep1Schema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejects when firstName is missing', () => {
    const result = registerStep1Schema.safeParse({ ...validPayload, firstName: '' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('firstName');
  });

  it('rejects an invalid documentType', () => {
    const result = registerStep1Schema.safeParse({ ...validPayload, documentType: 'RUC' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('documentType');
  });

  it('rejects documentNumber shorter than 5 characters', () => {
    const result = registerStep1Schema.safeParse({ ...validPayload, documentNumber: '123' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('documentNumber');
  });

  it('rejects when passwords do not match', () => {
    const result = registerStep1Schema.safeParse({
      ...validPayload,
      confirmPassword: 'DifferentPass1',
    });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('confirmPassword');
  });

  it('rejects password missing uppercase', () => {
    const result = registerStep1Schema.safeParse({
      ...validPayload,
      password: 'password1',
      confirmPassword: 'password1',
    });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('password');
  });

  it('rejects invalid email', () => {
    const result = registerStep1Schema.safeParse({ ...validPayload, email: 'bad-email' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('email');
  });

  it('accepts CE documentType', () => {
    const result = registerStep1Schema.safeParse({ ...validPayload, documentType: 'CE' });
    expect(result.success).toBe(true);
  });

  it('accepts Pasaporte documentType', () => {
    const result = registerStep1Schema.safeParse({ ...validPayload, documentType: 'Pasaporte' });
    expect(result.success).toBe(true);
  });
});

// ─── registerStep2Schema ──────────────────────────────────────────────────────

describe('registerStep2Schema', () => {
  it('accepts Motocicleta with a plate', () => {
    const result = registerStep2Schema.safeParse({
      vehicleType: 'Motocicleta',
      plate: 'ABC-123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts Bicicleta without a plate', () => {
    const result = registerStep2Schema.safeParse({ vehicleType: 'Bicicleta' });
    expect(result.success).toBe(true);
  });

  it('accepts APie without a plate', () => {
    const result = registerStep2Schema.safeParse({ vehicleType: 'APie' });
    expect(result.success).toBe(true);
  });

  it('rejects Motocicleta without a plate', () => {
    const result = registerStep2Schema.safeParse({ vehicleType: 'Motocicleta' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('plate');
  });

  it('rejects Automovil with an empty string plate', () => {
    const result = registerStep2Schema.safeParse({ vehicleType: 'Automovil', plate: '' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('plate');
  });

  it('rejects Automovil with a whitespace-only plate', () => {
    const result = registerStep2Schema.safeParse({ vehicleType: 'Automovil', plate: '   ' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('plate');
  });

  it('rejects an invalid vehicleType string', () => {
    const result = registerStep2Schema.safeParse({ vehicleType: 'Camion', plate: 'XYZ-999' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('vehicleType');
  });

  it('accepts Automovil with a valid plate', () => {
    const result = registerStep2Schema.safeParse({ vehicleType: 'Automovil', plate: 'XY-1234' });
    expect(result.success).toBe(true);
  });
});

// ─── otpSchema ────────────────────────────────────────────────────────────────

describe('otpSchema', () => {
  it('accepts a valid 6-digit code', () => {
    const result = otpSchema.safeParse({ code: '123456' });
    expect(result.success).toBe(true);
  });

  it('rejects 5-digit code', () => {
    const result = otpSchema.safeParse({ code: '12345' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('code');
  });

  it('rejects 7-digit code', () => {
    const result = otpSchema.safeParse({ code: '1234567' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('code');
  });

  it('rejects a code containing a non-digit character', () => {
    const result = otpSchema.safeParse({ code: '12345a' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('code');
  });

  it('rejects an empty string', () => {
    const result = otpSchema.safeParse({ code: '' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('code');
  });

  it('rejects code with spaces', () => {
    const result = otpSchema.safeParse({ code: '123 45' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('code');
  });
});

// ─── forgotPasswordSchema ─────────────────────────────────────────────────────

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'a@b.com' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-email string', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'notanemail' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('email');
  });

  it('rejects an empty email', () => {
    const result = forgotPasswordSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('email');
  });

  it('rejects missing email field', () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(errorsFor(result)).toContain('email');
  });
});
