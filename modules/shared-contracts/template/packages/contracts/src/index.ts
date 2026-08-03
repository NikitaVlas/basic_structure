export type HealthStatus = "ok" | "degraded";
export type HealthResponse = Readonly<{ status: HealthStatus }>;
export function healthResponse(status: HealthStatus): HealthResponse { return { status }; }
