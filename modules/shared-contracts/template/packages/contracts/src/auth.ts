import { z } from "zod";

export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(320));
export const passwordSchema = z.string()
  .min(12, "Password must contain at least 12 characters")
  .max(128, "Password must contain at most 128 characters")
  .refine((value) => /[a-z]/.test(value), "Password must contain a lowercase letter")
  .refine((value) => /[A-Z]/.test(value), "Password must contain an uppercase letter")
  .refine((value) => /\d/.test(value), "Password must contain a number");

export const registerRequestSchema = z.strictObject({ email: emailSchema, password: passwordSchema });
export const loginRequestSchema = z.strictObject({ email: emailSchema, password: z.string().min(1).max(128) });
export const emailRequestSchema = z.strictObject({ email: emailSchema });
export const tokenRequestSchema = z.strictObject({ token: z.string().min(32).max(256) });
export const passwordResetRequestSchema = z.strictObject({ token: z.string().min(32).max(256), password: passwordSchema });
export const userRoleSchema = z.enum(["user", "admin"]);
export const userDtoSchema = z.strictObject({
  id: z.uuid(),
  email: z.email().max(320),
  role: userRoleSchema,
  createdAt: z.iso.datetime(),
  emailVerified: z.boolean()
});
export const authResponseSchema = z.strictObject({ user: userDtoSchema });
export const sessionDtoSchema = z.strictObject({
  id: z.uuid(),
  clientLabel: z.string().min(1).max(160),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  current: z.boolean()
});
export const securityEventDtoSchema = z.strictObject({
  id: z.uuid(),
  eventType: z.string().min(3).max(80),
  outcome: z.enum(["success", "failure"]),
  occurredAt: z.iso.datetime()
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type EmailRequest = z.infer<typeof emailRequestSchema>;
export type TokenRequest = z.infer<typeof tokenRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type UserDto = z.infer<typeof userDtoSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type SecurityEventDto = z.infer<typeof securityEventDtoSchema>;
