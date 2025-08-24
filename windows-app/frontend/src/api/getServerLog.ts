import axios from "axios";
import { API_BASE } from "../config/api";

export async function getServerLog(servername: string, token?: string | null, lines: number = 50) {
  try {
    const res = await axios.get(`${API_BASE}/server/log`, {
      params: { servername, lines },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.data;
  } catch (err) {
    return { error: "API request failed" };
  }
}