import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { healthResponse } from "@{{PROJECT_NAME}}/contracts";
{{SLOT:API_IMPORTS}}

export function createAppServer() {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("x-content-type-options", "nosniff");
    {{SLOT:API_REQUEST_HANDLERS}}
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      response.writeHead(200).end(JSON.stringify(healthResponse("ok")));
      return;
    }
    response.writeHead(404).end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Route not found" } }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const server = createAppServer().listen(port, () => console.log(JSON.stringify({ level: "info", message: "api_started", port })));
  let stopping = false;
  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ level: "info", message: "api_shutdown_started", signal }));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    {{SLOT:API_SHUTDOWN}}
    console.log(JSON.stringify({ level: "info", message: "api_shutdown_complete" }));
  }
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void shutdown(signal));
}
