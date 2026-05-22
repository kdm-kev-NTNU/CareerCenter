const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
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
