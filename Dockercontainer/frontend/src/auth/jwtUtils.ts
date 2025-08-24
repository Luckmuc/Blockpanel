import { jwtDecode } from "jwt-decode";

export function getUsernameFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const decoded: any = jwtDecode(token);
    // Try common fields for username
    return decoded.username || decoded.sub || decoded.user || null;
  } catch (e) {
    return null;
  }
}
