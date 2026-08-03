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
export const userRoleSchema = z.enum(["user", "admin"]);
export const userDtoSchema = z.strictObject({
  id: z.uuid(),
  email: z.email().max(320),
  role: userRoleSchema,
  createdAt: z.iso.datetime()
});
export const authResponseSchema = z.strictObject({ user: userDtoSchema });

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UserDto = z.infer<typeof userDtoSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
