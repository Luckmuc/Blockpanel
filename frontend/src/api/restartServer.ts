import { API_BASE } from "../config/api";

export async function restartServer(servername: string, token?: string): Promise<{ status: string } | { error: string }> {
  try {
    const res = await fetch(`${API_BASE}/server/restart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: new URLSearchParams({ servername })
    });
    if (!res.ok) return { error: "API request failed" };
    return await res.json();
  } catch {
    return { error: "API request failed" };
  }
}
