export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Wraps a route handler so HttpError becomes a JSON error response.
export function route<C = unknown>(
  fn: (request: Request, ctx: C) => Promise<Response>,
) {
  return async (request: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(request, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return Response.json({ error: e.message }, { status: e.status });
      }
      console.error(e);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export async function readJson(
  request: Request,
): Promise<Record<string, unknown>> {
  // Requiring JSON also blocks cross-site form posts (they cannot send it without a CORS preflight).
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {}
  throw new HttpError(400, "Invalid JSON body");
}

export function str(
  body: Record<string, unknown>,
  key: string,
  { min = 1, max = 200 }: { min?: number; max?: number } = {},
): string {
  const v = body[key];
  if (typeof v !== "string") throw new HttpError(400, `${key} is required`);
  const trimmed = key === "password" ? v : v.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpError(
      400,
      key === "password"
        ? `Password must be ${min}-${max} characters`
        : `${key} must be ${min}-${max} characters`,
    );
  }
  return trimmed;
}

export function parseCredentials(body: Record<string, unknown>) {
  const email = str(body, "email", { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Enter a valid email address");
  }
  return {
    name: str(body, "name", { max: 100 }),
    email,
    password: str(body, "password", { min: 8, max: 128 }),
  };
}

// Postgres unique violation, whether raw or wrapped by drizzle.
export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}
