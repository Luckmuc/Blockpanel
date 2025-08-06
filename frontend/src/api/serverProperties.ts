import axios from "axios";
import { API_BASE } from "../config/api";

export async function getServerProperties(servername: string, token?: string) {
  const res = await axios.get(`${API_BASE}/server/properties`, {
    params: { servername },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data;
}

export async function setServerProperty(servername: string, key: string, value: string, token?: string) {
  const res = await axios.post(
    `${API_BASE}/server/properties/set`,
    new URLSearchParams({ servername, key, value }),
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  return res.data;
}
