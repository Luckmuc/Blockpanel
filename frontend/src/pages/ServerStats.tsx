
import React, { useEffect, useState } from "react";
import { API_BASE } from "../config/api";
import { Box, Typography, Paper, Divider, Chip, CircularProgress, Tooltip, Slide, IconButton, Button, Modal } from "@mui/material";
import CropFreeIcon from '@mui/icons-material/CropFree';
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import StorageIcon from "@mui/icons-material/Storage";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import { useNavigate, useParams } from "react-router-dom";

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;
const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const ServerStats: React.FC = () => {
  const { serverName } = useParams<{ serverName: string }>();
  const [ram, setRam] = useState<string>("?");
  const [ramUsed, setRamUsed] = useState<string>("?");
  const [uptime, setUptime] = useState<string>("?");
  const [playerCount, setPlayerCount] = useState<string>("?");
  const [maxPlayers, setMaxPlayers] = useState<string>("?");
  const [version, setVersion] = useState<string>("?");
  const [plugins, setPlugins] = useState<string[]>([]);
  const [logs, setLogs] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | undefined>(undefined);
  // logExpanded wird nicht mehr benötigt, nur noch logModalOpen
  const [logModalOpen, setLogModalOpen] = useState(false);
  const navigate = useNavigate();

function parsePercent(used: string, max: string): string {
  const u = parseInt(used);
  const m = parseInt(max);
  if (!isNaN(u) && !isNaN(m) && m > 0) {
    return `${Math.min(100, Math.round((u / m) * 100))}%`;
  }
  return "0%";
}

  // Hilfsfunktion für Auth-Header
  function getAuthOptions() {
    const token = localStorage.getItem("token");
    return {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    };
  }

  // Hilfsfunktion für JSON-Fetch
  async function fetchJson(url: string, options: any) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  useEffect(() => {
    let isMounted = true;
    async function fetchAllStats() {
      setLoading(true);
      try {
        // Status (always available)
        console.log("[ServerStats] Fetching status for", serverName);
        const statusData = await fetchJson(`${API_BASE}/server/status?servername=${encodeURIComponent(serverName ?? "")}`, getAuthOptions());
        if (isMounted) setStatus(statusData.status ?? "");

        // Max RAM (always available)
        console.log("[ServerStats] Fetching ram for", serverName);
        const ramData = await fetchJson(`${API_BASE}/server/ram?servername=${encodeURIComponent(serverName ?? "")}`, getAuthOptions());
        if (isMounted) setRam(ramData.ram !== undefined ? ramData.ram : "?");

  // ...existing code...
        // Uptime (always available, returns 0 if offline)
        console.log("[ServerStats] Fetching uptime for", serverName);
        const uptimeData = await fetchJson(`${API_BASE}/server/uptime?servername=${encodeURIComponent(serverName ?? "")}`, getAuthOptions());
        if (isMounted) setUptime(uptimeData.uptime !== undefined ? uptimeData.uptime + " s" : "?");

        // Player Count (always available)
        console.log("[ServerStats] Fetching playercount for", serverName);
        const playerData = await fetchJson(`${API_BASE}/server/playercount?servername=${encodeURIComponent(serverName ?? "")}`, getAuthOptions());
        if (isMounted) {
          setPlayerCount(playerData.player_count !== undefined ? playerData.player_count : "?");
          setMaxPlayers(playerData.max_players !== undefined ? playerData.max_players : "?");
        }

        // Version (always available)
        console.log("[ServerStats] Fetching version for", serverName);
        const versionData = await fetchJson(`${API_BASE}/server/version?servername=${encodeURIComponent(serverName ?? "")}`, getAuthOptions());
        if (isMounted) setVersion(versionData.version !== undefined ? versionData.version : "?");

        // Plugins (always available)
        console.log("[ServerStats] Fetching plugins for", serverName);
        const pluginsData = await fetchJson(`${API_BASE}/server/plugins?servername=${encodeURIComponent(serverName ?? "")}`, getAuthOptions());
        if (isMounted) setPlugins(Array.isArray(pluginsData.plugins) ? pluginsData.plugins : []);

        // Used RAM (only if online, from /server/stats)
        let usedRamValue = "?";
        if (statusData.status === "running") {
          console.log("[ServerStats] Fetching stats for", serverName);
          const statsData = await fetchJson(`${API_BASE}/server/stats?servername=${encodeURIComponent(serverName ?? "")}`, getAuthOptions());
          usedRamValue = statsData.ram_used !== undefined ? statsData.ram_used + " MB" : "?";
        }
        if (isMounted) setRamUsed(usedRamValue);

        // Logs (only if online)
        if (statusData.status === "running") {
          console.log("[ServerStats] Fetching logs for", serverName);
          try {
            const logsData = await fetchJson(`${API_BASE}/server/log?servername=${encodeURIComponent(serverName ?? "")}&lines=50`, getAuthOptions());
            if (isMounted) setLogs(logsData.log ?? "");
          } catch (err) {
            if (isMounted) setLogs("");
          }
        } else {
          if (isMounted) setLogs("");
        }
      } catch (e) {
        console.error("[ServerStats] Error fetching stats:", e);
        if (isMounted) {
          setRam("?");
          setRamUsed("?");
          setUptime("?");
          setPlayerCount("?");
          setMaxPlayers("?");
          setVersion("?");
          setPlugins([]);
          setLogs("");
          setStatus("");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchAllStats();
    const poll = setInterval(fetchAllStats, 5000);
    return () => {
      isMounted = false;
      clearInterval(poll);
    };
  }, [serverName]);

  // Clear logs if server is offline (redundant, handled above)

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)",
      }}
    >
      {/* Sidebar + Back Button Row */}
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', height: '100vh' }}>
        {/* Sidebar */}
        <Box
          sx={{
            height: "100vh",
            width: hovered ? SIDEBAR_EXPANDED : SIDEBAR_WIDTH,
            transition: "width 0.25s cubic-bezier(.4,2,.6,1)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(30,40,60,0.92)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            borderTopRightRadius: 32,
            borderBottomRightRadius: 32,
            py: 3,
          }}
          onMouseLeave={() => setHovered(undefined)}
        >
          <Box sx={{ width: "100%", flex: 1 }}>
            {menuItems.map((item) => (
              <Tooltip key={item.key} title={item.label} placement="right">
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    px: 2,
                    py: 1.5,
                    cursor: "pointer",
                    color: hovered === item.key ? "#1976d2" : "#fff",
                    background: hovered === item.key ? "rgba(25, 118, 210, 0.08)" : undefined,
                    borderRadius: 2,
                    my: 1,
                    transition: "background 0.2s, color 0.2s",
                    '&:hover': { background: "rgba(255,255,255,0.08)" },
                  }}
                  onMouseEnter={() => setHovered(item.key)}
                  onClick={() => {
                    if (item.key === "servers") navigate("/servers");
                    if (item.key === "plugins") navigate("/plugins");
                    if (item.key === "controls") navigate("/controls");
                  }}
                >
                  {item.icon}
                  <Slide direction="right" in={hovered === item.key} mountOnEnter unmountOnExit>
                    <Typography sx={{ ml: 2, fontWeight: 600, color: "#b0c4de", whiteSpace: "nowrap" }}>
                      {item.label}
                    </Typography>
                  </Slide>
                </Box>
              </Tooltip>
            ))}
          </Box>
          <Box sx={{ width: "100%" }}>
            <Tooltip title="Settings" placement="right">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 2,
                  py: 1.5,
                  cursor: "pointer",
                  color: hovered === "settings" ? "#1976d2" : "#fff",
                  background: hovered === "settings" ? "rgba(25, 118, 210, 0.08)" : undefined,
                  borderRadius: 2,
                  mb: 1,
                  transition: "background 0.2s, color 0.2s",
                  '&:hover': { background: "rgba(255,255,255,0.08)" },
                }}
                onMouseEnter={() => setHovered("settings")}
                onClick={() => navigate("/settings")}
              >
                <SettingsIcon fontSize="large" />
                <Slide direction="right" in={hovered === "settings"} mountOnEnter unmountOnExit>
                  <Typography sx={{ ml: 2, fontWeight: 600, color: "#b0c4de", whiteSpace: "nowrap" }}>
                    Settings
                  </Typography>
                </Slide>
              </Box>
            </Tooltip>
            <Tooltip title="Logout" placement="right">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 2,
                  py: 1.5,
                  cursor: "pointer",
                  color: hovered === "logout" ? "#f44336" : "#fff",
                  background: hovered === "logout" ? "rgba(244, 67, 54, 0.08)" : undefined,
                  borderRadius: 2,
                  transition: "background 0.2s, color 0.2s",
                  '&:hover': { background: "rgba(255,255,255,0.08)" },
                }}
                onMouseEnter={() => setHovered("logout")}
                onClick={() => navigate("/login")}
              >
                <LogoutIcon fontSize="large" />
                <Slide direction="right" in={hovered === "logout"} mountOnEnter unmountOnExit>
                  <Typography sx={{ ml: 2, fontWeight: 600, color: "#f44336", whiteSpace: "nowrap" }}>
                    Logout
                  </Typography>
                </Slide>
              </Box>
            </Tooltip>
          </Box>
        </Box>
        {/* Back Button */}
        <Box sx={{ minWidth: 80, display: 'flex', alignItems: 'flex-start', pt: 3, pl: 2 }}>
          <Button variant="outlined" color="info" onClick={() => navigate(-1)} sx={{ borderRadius: 2, fontWeight: 700, px: 2, py: 1, minWidth: 60 }}>
            Back
          </Button>
        </Box>
      </Box>
      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          elevation={10}
          sx={{
            p: 0,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            background: "#1e2a3d",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            textAlign: "center",
            maxWidth: 1200,
            width: "90vw",
            minHeight: 600,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Servername oben */}
          <Box sx={{ px: 4, py: 3, borderBottom: "1px solid #223", background: "rgba(30,40,60,0.92)", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Typography variant="h4" sx={{ color: "#fff", fontWeight: 900, letterSpacing: 1 }}>{serverName ?? "Server"}</Typography>
          </Box>
          {/* Main Content: Flex Row */}
          <Box sx={{ display: "flex", flex: 1, minHeight: 500 }}>
            {/* Stats links - neue Darstellung als Kästen */}
            <Box sx={{ flex: 1, minWidth: 260, maxWidth: 320, background: "rgba(30,40,60,0.92)", borderRight: "1px solid #223", p: 2, display: "flex", flexDirection: "column", gap: 1, borderBottomLeftRadius: 24 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" sx={{ color: "#90caf9", fontWeight: 700, mr: 1 }}>Server Stats</Typography>
                {loading && <CircularProgress size={18} sx={{ color: "#90caf9" }} />}
              </Box>
              <Divider sx={{ mb: 1, borderColor: "#223" }} />
              {/* Max RAM - immer anzeigen */}
              <Box sx={{ background: "rgba(30,40,60,0.92)", color: "#fff", borderRadius: 2, mb: 1, p: 1.5, boxShadow: "0 2px 8px 0 #1976d2", display: "flex", flexDirection: "column", alignItems: "flex-start", opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Max RAM</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{ram} MB</Typography>
              </Box>
              {/* Used RAM - nur wenn online */}
              <Box sx={{ background: "rgba(30,40,60,0.92)", color: "#fff", borderRadius: 2, mb: 1, p: 1.5, boxShadow: "0 2px 8px 0 #1976d2", display: "flex", flexDirection: "column", alignItems: "flex-start", opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Used RAM</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{ramUsed}</Typography>
                {status === "running" && ram !== "?" && ramUsed !== "?" && ramUsed !== "Server is offline" ? (
                  <Box sx={{ width: "100%", height: 12, background: "#223", borderRadius: 1, mt: 1 }}>
                    <Box sx={{
                      width: parsePercent(ramUsed, ram),
                      height: "100%",
                      background: "linear-gradient(90deg, #90caf9 0%, #1976d2 100%)",
                      borderRadius: 1,
                      transition: "width 0.5s",
                    }} />
                  </Box>
                ) : null}
              </Box>
              {/* Spieler online - nur wenn online */}
              <Box sx={{ background: "rgba(30,40,60,0.92)", color: "#fff", borderRadius: 2, mb: 1, p: 1.5, boxShadow: "0 2px 8px 0 #1976d2", display: "flex", flexDirection: "column", alignItems: "flex-start", opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Players Online</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{status === "running" ? playerCount : "Server is offline"}</Typography>
                {maxPlayers !== "?" && (
                  <Typography sx={{ fontWeight: 400, fontSize: 13, color: "#90caf9" }}>Max: {maxPlayers}</Typography>
                )}
              </Box>
              {/* Version - immer anzeigen */}
              <Box sx={{ background: "rgba(30,40,60,0.92)", color: "#fff", borderRadius: 2, mb: 1, p: 1.5, boxShadow: "0 2px 8px 0 #1976d2", display: "flex", flexDirection: "column", alignItems: "flex-start", opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Version</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{version}</Typography>
              </Box>
              {/* Uptime - nur wenn online */}
              <Box sx={{ background: "rgba(30,40,60,0.92)", color: "#fff", borderRadius: 2, mb: 1, p: 1.5, boxShadow: "0 2px 8px 0 #1976d2", display: "flex", flexDirection: "column", alignItems: "flex-start", opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Uptime</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{uptime}</Typography>
              </Box>
              <Divider sx={{ my: 1, borderColor: "#223" }} />
              {/* Plugins - immer anzeigen */}
              <Typography sx={{ color: "#90caf9", fontWeight: 700, mb: 1 }}>Plugins</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
                {plugins.length > 0
                  ? plugins.map((p: string) => (
                      <Chip key={p} label={p.replace(/\.jar$/,"")} sx={{ fontWeight: 600, fontSize: 14, mb: 1, background: "#223", color: "#fff" }} />
                    ))
                  : <Typography sx={{ color: "#fff" }}>None</Typography>}
              </Box>
            </Box>
            {/* Logs/Console with Modal Overlay - only one instance */}
            <Box sx={{
              flex: 2,
              minWidth: 0,
              p: 4,
              display: "flex",
              flexDirection: "column",
              background: "rgba(30,40,60,0.92)",
              transition: "flex 0.3s, padding 0.3s",
              position: "relative",
              borderBottomRightRadius: 24
            }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="h6" sx={{ color: "#90caf9", fontWeight: 700 }}>Server Console</Typography>
                <IconButton onClick={() => setLogModalOpen(true)} sx={{ color: "#90caf9" }}>
                  <CropFreeIcon />
                </IconButton>
              </Box>
              <Divider sx={{ mb: 2, borderColor: "#223" }} />
              {status === "running" ? (
                logs.trim().length > 0 ? (
                  <Box sx={{
                    flex: 1,
                    overflow: "auto",
                    maxHeight: 350,
                    minHeight: 120,
                    background: "#181f2a",
                    borderRadius: 2,
                    p: 2,
                    fontFamily: "JetBrains Mono, Fira Mono, monospace",
                    fontSize: 13,
                    color: "#b0c4de",
                    textAlign: 'left',
                    transition: "all 0.3s"
                  }}>
                    {logs.split("\n").map((line, i) => (
                      <div key={i} style={{ padding: "1px 0", whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: 'left' }}>{line}</div>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 15, fontWeight: 600, opacity: 0.7, background: "#181f2a", borderRadius: 2, maxHeight: 350, minHeight: 120 }}>
                    No logs available
                  </Box>
                )
              ) : null}
              {/* Log Modal Overlay */}
              <Modal open={logModalOpen} onClose={() => setLogModalOpen(false)}>
                <Box sx={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  bgcolor: 'rgba(20,24,32,0.98)',
                  zIndex: 2000,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 0
                }}>
                  <Paper sx={{
                    maxWidth: '90vw',
                    width: 1000,
                    maxHeight: '90vh',
                    minHeight: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 4,
                    boxShadow: 8,
                    p: 0,
                    bgcolor: '#181f2a',
                    overflow: 'hidden',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3, borderBottom: '1px solid #223', bgcolor: '#232b3a' }}>
                      <Typography variant="h5" sx={{ color: '#90caf9', fontWeight: 800 }}>Server Log</Typography>
                      <Button onClick={() => setLogModalOpen(false)} variant="outlined" color="info" sx={{ fontWeight: 700, borderRadius: 2 }}>Close</Button>
                    </Box>
                    <Box sx={{
                      flex: 1,
                      overflow: 'auto',
                      p: 4,
                      fontFamily: 'JetBrains Mono, Fira Mono, monospace',
                      fontSize: 18,
                      color: '#b0c4de',
                      textAlign: 'left',
                      background: '#181f2a',
                    }}>
                      {logs.trim().length > 0 ? (
                        logs.split("\n").map((line, i) => (
                          <div key={i} style={{ padding: "2px 0", whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: 'left' }}>{line}</div>
                        ))
                      ) : (
                        <Typography sx={{ color: '#888', fontSize: 18, fontWeight: 600, opacity: 0.7 }}>No logs available</Typography>
                      )}
                    </Box>
                  </Paper>
                </Box>
              </Modal>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default ServerStats;
