// Client-side calls to the prototype API (app/api). Errors come back as {error:{code,message}}.

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown> | unknown[] | null;

async function parse<T>(res: Response): Promise<T> {
  const type = res.headers.get("content-type") ?? "";
  const body: unknown = type.includes("application/json") ? await res.json().catch(() => null) : null;
  if (res.ok) return (body ?? {}) as T;
  const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
  if (err?.message) throw new ApiError(err.code ?? "error", err.message, res.status);
  if (res.status === 404 && !type.includes("application/json")) {
    // The route itself is missing (backend not wired yet), not a domain 404.
    throw new ApiError("not_available", "This action isn't connected yet in the prototype.", 404);
  }
  throw new ApiError("http_error", `Request failed (${res.status})`, res.status);
}

async function send<T>(method: string, path: string, body?: Json | FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body instanceof FormData || body === undefined ? undefined : { "content-type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", "Could not reach the server. Is the dev server running?", 0);
  }
  return parse<T>(res);
}

export const api = {
  get: <T = unknown>(path: string) => send<T>("GET", path),
  post: <T = unknown>(path: string, body?: Json) => send<T>("POST", path, body ?? {}),
  patch: <T = unknown>(path: string, body: Json) => send<T>("PATCH", path, body),
  upload: <T = unknown>(path: string, form: FormData) => send<T>("POST", path, form),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
