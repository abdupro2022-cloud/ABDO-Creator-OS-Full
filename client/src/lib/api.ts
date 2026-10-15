import { useAuth } from "./auth";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const BASE = "/api";

async function call<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const errObj = (parsed as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(
      errObj?.code ?? "http_error",
      errObj?.message ?? `HTTP ${res.status}`,
      res.status,
      errObj?.details,
    );
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string) => call<T>("GET", path),
  post: <T>(path: string, body?: unknown) => call<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => call<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => call<T>("PATCH", path, body),
  del: <T>(path: string) => call<T>("DELETE", path),
};
