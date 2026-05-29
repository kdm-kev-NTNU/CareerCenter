const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function toRequestErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "Serveren svarte ikke i tide. Sjekk at API-et kjører (port 3000) og at du åpner appen via dev-serveren (f.eks. http://localhost:5174 med Docker).";
  }
  if (error instanceof TypeError) {
    return "Kunne ikke koble til API-et. Er backend startet?";
  }
  return error instanceof Error ? error.message : "Nettverksfeil.";
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
    let message = await response.text();
    try {
      const parsed = JSON.parse(message) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // keep raw text
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
