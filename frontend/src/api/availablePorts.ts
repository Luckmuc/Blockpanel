import { API_BASE } from "../config/api";

// Fetch available ports from backend
export async function fetchAvailablePorts(): Promise<number[]> {
  const res = await fetch(`${API_BASE}/available-ports`);
  if (!res.ok) throw new Error("Failed to fetch available ports");
  const data = await res.json();
  return data.ports || [];
}
