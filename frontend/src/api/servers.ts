import type { Server } from "../types/server";
import axios from "axios";
import { API_BASE } from "../config/api";

export async function fetchServers(token: string | undefined): Promise<Server[]> {
  try {
    const res = await axios.get(`${API_BASE}/server/list`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.data && Array.isArray(res.data.servers)) {
      return res.data.servers;
    } else {
      return [];
    }
  } catch (err) {
    return [];
  }
}

export async function startServer(name: string, token: string | undefined) {
  try {
    return await axios.post(
      `${API_BASE}/server/start?servername=${encodeURIComponent(name)}`,
      {},
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
  } catch (err) {
    return { error: "API request failed" };
  }
}

// Stops a running server (used for EULA workflow)
export async function stopServer(name: string, token: string | undefined) {
  try {
    return await axios.post(
      `${API_BASE}/server/stop?servername=${encodeURIComponent(name)}`,
      {},
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
  } catch (err) {
    return { error: "API request failed" };
  }
}

export async function killServer(name: string, token: string | undefined) {
  try {
    return await axios.post(
      `${API_BASE}/server/kill?servername=${encodeURIComponent(name)}`,
      {},
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
  } catch (err) {
    return { error: "API request failed" };
  }
}

export async function deleteServer(name: string, token: string | undefined) {
  try {
    return await axios.delete(
      `${API_BASE}/server/delete`,
      {
        params: { servername: name },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
  } catch (err) {
    return { error: "API request failed" };
  }
}

export async function createServer(
  name: string, 
  purpurUrl: string, 
  ram: string, 
  token: string | undefined
) {
  try {
    return await axios.post(
      `${API_BASE}/server/create`,
      new URLSearchParams({ 
        servername: name,
        purpur_url: purpurUrl,
        ram: ram
      }),
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
  } catch (err: any) {
    throw new Error(err?.response?.data?.detail || "Failed to create server");
  }
}

export async function createAndStartServer(
  name: string, 
  purpurUrl: string, 
  ram: string, 
  port: number = 25565,
  acceptEula: boolean = true,
  token: string | undefined
) {
  try {
    const response = await axios.post(
      `${API_BASE}/server/create_and_start`,
      new URLSearchParams({ 
        servername: name,
        purpur_url: purpurUrl,
        ram: ram,
        port: port.toString(),
        accept_eula: acceptEula.toString()
      }),
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    return response.data;
  } catch (err: any) {
    throw new Error(err?.response?.data?.detail || "Failed to create and start server");
  }
}

export async function acceptEula(name: string, token: string | undefined) {
  try {
    return await axios.post(
      `${API_BASE}/server/accept_eula`,
      new URLSearchParams({ servername: name }),
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
  } catch (err: any) {
    throw new Error(err?.response?.data?.detail || "Failed to accept EULA");
  }
}

// Get uptime for a server
export async function getServerUptime(serverName: string, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/uptime?servername=${encodeURIComponent(serverName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { uptime: null };
  }
}

// Get tmux output for a server
export async function getTmuxOutput(serverName: string, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/tmux?servername=${encodeURIComponent(serverName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { output: "" };
  }
}

// Check if server port is open
export async function checkServerPort(serverName: string, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/portcheck?servername=${encodeURIComponent(serverName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { open: false };
  }
}

// Validate if a port can be used for a new server
export async function validatePort(port: number, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/ports/validate?port=${port}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { valid: false, reason: "API request failed" };
  }
}

// Scan a range of ports
export async function scanPorts(start: number, end: number, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/ports/scan?start=${start}&end=${end}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { results: [] };
  }
}

// Get a suggested free port
export async function suggestFreePort(preferred: number = 25565, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/ports/suggest?preferred=${preferred}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { suggested_port: 25565 };
  }
}

// Check port availability (legacy function for compatibility)
export async function checkPortAvailability(port: number = 25565, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/ports/check?port=${port}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { available: false, suggested_port: 25566 };
  }
}

// Get next free port (legacy function for compatibility)
export async function getFreePort(token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/ports/free`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { free_port: 25566 };
  }
}

// Get player count for a server
export async function getServerPlayerCount(serverName: string, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/playercount?servername=${encodeURIComponent(serverName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { player_count: null, max_players: null };
  }
}

// Get plugins for a server
export async function getServerPlugins(serverName: string, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/plugins?servername=${encodeURIComponent(serverName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { plugins: [] };
  }
}

// Get version for a server
export async function getServerVersion(serverName: string, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/version?servername=${encodeURIComponent(serverName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  } catch (err) {
    return { version: null };
  }
}

// Get server stats (RAM, players, IPs, plugins, uptime, etc.)
export async function getServerStats(serverName: string, token?: string) {
  try {
    const res = await fetch(`${API_BASE}/server/stats?servername=${encodeURIComponent(serverName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error("API request failed");
    }
    return res.json();
  } catch (err) {
    return { error: "API request failed" };
  }
}
