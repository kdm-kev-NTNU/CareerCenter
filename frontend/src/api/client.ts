const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export const UPLOAD_TIMEOUT_MS = 120_000;
/** Finish/rate endpoints wait on an LLM call; 15s is too short and surfaces as a false "server down". */
export const LLM_REQUEST_TIMEOUT_MS = 120_000;
export const MAX_BACHELOR_FILE_BYTES = 50 * 1024 * 1024;

function timeoutErrorMessage(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return "Serveren svarte ikke i tide. API-proxyen kan være midlertidig utilgjengelig – prøv igjen om litt.";
    }
  }
  return "Serveren svarte ikke i tide. Sjekk at API-et kjører (port 3000) og at du åpner appen via dev-serveren (f.eks. http://localhost:5174 med Docker).";
}

function toRequestErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return timeoutErrorMessage();
  }
  if (error instanceof TypeError) {
    return "Kunne ikke koble til API-et. Er backend startet?";
  }
  return error instanceof Error ? error.message : "Nettverksfeil.";
}

async function parseResponseError(response: Response): Promise<string> {
  let message = await response.text();
  try {
    const parsed = JSON.parse(message) as { message?: string };
    if (parsed.message) message = parsed.message;
  } catch {
    // keep raw text
  }
  return message || `Request failed: ${response.status}`;
}

export async function uploadRequest<T>(
  path: string,
  formData: FormData,
  timeoutMs = UPLOAD_TIMEOUT_MS
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData,
      credentials: "include",
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new Error(toRequestErrorMessage(error));
  }
  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }
  return response.json() as Promise<T>;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: options.signal ?? AbortSignal.timeout(15_000)
    });
  } catch (error) {
    throw new Error(toRequestErrorMessage(error));
  }
  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function requestBlob(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    throw new Error(toRequestErrorMessage(error));
  }
  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }
  return response.blob();
}
