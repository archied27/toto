const BASE_URL = ""

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, 
    {...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  if (!response.ok) {
    let detail = `API error ${response.status}: ${path}`;
    try {
      const payload = await response.json() as { detail?: unknown };
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}