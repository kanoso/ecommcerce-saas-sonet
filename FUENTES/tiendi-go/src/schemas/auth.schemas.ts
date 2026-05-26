import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerStep1Schema = z
  .object({
    firstName: z.string().min(1, 'Nombre requerido'),
    lastName: z.string().min(1, 'Apellido requerido'),
    documentType: z.enum(['DNI', 'CE', 'Pasaporte']),
    documentNumber: z.string().min(5, 'Número de documento inválido'),
    email: z.string().email('Email inválido'),
    phone: z.string().min(7, 'Teléfono inválido'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirmPassword: z.string().min(1, 'Confirmá la contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type RegisterStep1FormData = z.infer<typeof registerStep1Schema>;

export const registerStep2Schema = z
  .object({
    vehicleType: z.enum(['Motocicleta', 'Automovil', 'Bicicleta', 'APie']),
    plate: z.string().optional(),
    brand: z.string().optional(),
    color: z.string().optional(),
  })
  .refine(
    (data) => {
      const needsPlate = data.vehicleType === 'Motocicleta' || data.vehicleType === 'Automovil';
      if (needsPlate && (!data.plate || data.plate.trim() === '')) return false;
      return true;
    },
    { message: 'La placa es requerida para este tipo de vehículo', path: ['plate'] }
  );

export type RegisterStep2FormData = z.infer<typeof registerStep2Schema>;

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});

export type OtpFormData = z.infer<typeof otpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
