import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password is too long')
  .refine((value) => /[A-Za-z]/.test(value), 'Password must contain a letter')
  .refine((value) => /\d/.test(value), 'Password must contain a number');

const registrationFields = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username is too long')
    .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'Username contains invalid characters'),
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email'),
  password: passwordSchema,
});

export const registerSchema = registrationFields
  .extend({ confirm: z.string() })
  .refine((value) => value.password === value.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export const registerPayloadSchema = registrationFields;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email'),
});

export const passwordResetConfirmSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export function safeAuthMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: { error?: unknown } } })?.response;
  const message = response?.data?.error;
  if (response?.status === 400 && typeof message === 'string') return message;
  if (response?.status === 409) return 'That account information is already in use.';
  if (response?.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return fallback;
}
