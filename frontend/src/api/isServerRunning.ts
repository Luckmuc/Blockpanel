import { API_BASE } from "../config/api";

export async function isServerRunning(servername: string, token?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/server/list`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.servers || !Array.isArray(data.servers)) return false;
    const server = data.servers.find((s: any) => s.name === servername);
    return server && server.status === "online";
  } catch {
    return false;
  }
}
