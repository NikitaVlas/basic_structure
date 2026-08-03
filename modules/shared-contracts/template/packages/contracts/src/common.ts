import { z } from "zod";

export const requestIdSchema = z.string().min(8).max(128);
export const apiErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE"
]);

export const fieldErrorsSchema = z.record(z.string(), z.array(z.string().max(200)).max(10));
export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string().min(1).max(200),
    details: fieldErrorsSchema.optional(),
    requestId: requestIdSchema,
    timestamp: z.iso.datetime()
  })
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export function apiError(input: {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  details?: Record<string, string[]>;
  timestamp?: Date;
}): ApiError {
  return apiErrorSchema.parse({
    error: {
      code: input.code,
      message: input.message,
      requestId: input.requestId,
      timestamp: (input.timestamp ?? new Date()).toISOString(),
      ...(input.details ? { details: input.details } : {})
    }
  });
}

export const healthStatusSchema = z.enum(["ok", "degraded"]);
export const healthResponseSchema = z.strictObject({ status: healthStatusSchema });
export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export function healthResponse(status: HealthStatus): HealthResponse { return healthResponseSchema.parse({ status }); }
