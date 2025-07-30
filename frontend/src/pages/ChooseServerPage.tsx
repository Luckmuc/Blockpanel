
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchServers, getServerStats, getServerPlugins, getServerVersion, getServerPlayerCount } from "../api/servers";
import { useAuth } from "../auth/AuthProvider";
import type { Server } from "../types/server";
import { Box, Typography, Card, CardContent, Checkbox, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { useNotification } from "../components/NotificationProvider";
import StorageIcon from "@mui/icons-material/Storage";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import Tooltip from "@mui/material/Tooltip";
import Slide from "@mui/material/Slide";

const ChooseServerPage: React.FC = () => {
  const [hovered, setHovered] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { token, clearToken } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const file = location.state?.file;
  const fileBuffer = location.state?.fileBuffer;

  useEffect(() => {
    fetchServers(token || undefined).then((data: Server[]) => {
      setServers(data || []);
      setLoading(false);
    });
  }, [token]);

  // Fetch real status and plugins for each server
  const [serverStats, setServerStats] = useState<Record<string, any>>({});
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [serversToRestart, setServersToRestart] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { notify } = useNotification();
  useEffect(() => {
    if (!servers.length) return;
    const fetchStats = async () => {
      const stats: Record<string, any> = {};
      await Promise.all(servers.map(async (srv: Server) => {
        const stat = await getServerStats(srv.name, token || undefined);
        // Fetch plugins, version, and player count from their own endpoints
        const pluginsRes = await getServerPlugins(srv.name, token || undefined);
        const versionRes = await getServerVersion(srv.name, token || undefined);
        const playerCountRes = await getServerPlayerCount(srv.name, token || undefined);
        stats[srv.name] = {
          ...stat,
          plugins: pluginsRes.plugins || stat.plugins,
          version: versionRes.version ?? stat.version,
          player_count: playerCountRes.player_count ?? stat.player_count,
          max_players: playerCountRes.max_players ?? stat.max_players,
        };
      }));
      setServerStats(stats);
    };
    fetchStats();
  }, [servers, token]);

  const handleSelect = (name: string) => {
    setSelectedServers((prev: string[]) =>
      prev.includes(name) ? prev.filter((n: string) => n !== name) : [...prev, name]
    );
  };

  // Helper: check if plugin already exists on server
  const checkPluginExists = async (server: string, pluginName: string) => {
    const res = await fetch(`/api/server/plugins?servername=${encodeURIComponent(server)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return false;
    const data = await res.json();
    return (data.plugins || []).includes(pluginName);
  };

  // Helper: check if server is running
  const checkServerRunning = async (server: string) => {
    const res = await fetch(`/api/server/status?servername=${encodeURIComponent(server)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "running";
  };

  // Helper: restart server
  const restartServer = async (server: string) => {
    await fetch(`/api/server/restart?servername=${encodeURIComponent(server)}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  };

  // Upload handler
  const handleContinue = async () => {
    if (!file || !fileBuffer || !selectedServers.length) return;
    setUploading(true);
    // clear old errors
    // 1. Check for duplicate plugin on each server
    const alreadyExists: string[] = [];
    for (const server of selectedServers) {
      const exists = await checkPluginExists(server, file.name);
      if (exists) alreadyExists.push(server);
    }
    if (alreadyExists.length > 0) {
      notify({ type: 'error', message: `Plugin '${file.name}' already exists on: ${alreadyExists.join(", ")}` });
      setUploading(false);
      return;
    }
    // 2. Upload plugin to all selected servers
    for (const server of selectedServers) {
      const formData = new FormData();
      const fileForUpload = new File([fileBuffer], file.name, { type: file.type });
      formData.append("file", fileForUpload);
      const res = await fetch(`/api/server/plugins/upload?servername=${encodeURIComponent(server)}`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        notify({ type: 'error', message: `Upload failed for ${server}` });
      }
    }
    // 3. Check which servers are running
    const running: string[] = [];
    for (const server of selectedServers) {
      const isRunning = await checkServerRunning(server);
      if (isRunning) running.push(server);
    }
    if (running.length > 0) {
      setServersToRestart(running);
      setShowRestartDialog(true);
    } else {
      setUploading(false);
      notify({ type: 'success', message: 'Plugin installed successfully!' });
      setTimeout(() => {
        navigate("/plugins");
      }, 1500);
    }
  };

  // Confirm restart
  const handleRestartConfirm = async () => {
    setShowRestartDialog(false);
    setUploading(true);
    let restartErrors: string[] = [];
    notify({ type: 'waiting', message: 'Waiting for server(s) to restart...' });
    for (const server of serversToRestart) {
      try {
        await restartServer(server);
      } catch (e) {
        restartErrors.push(`Restart failed for ${server}`);
      }
    }
    setUploading(false);
    if (restartErrors.length > 0) {
      restartErrors.forEach(msg => notify({ type: 'error', message: msg }));
    } else {
      notify({ type: 'success', message: 'Server(s) restarted successfully.' });
      setTimeout(() => {
        navigate("/plugins");
      }, 1500);
    }
  };

  // Skip restart
  const handleRestartSkip = () => {
    setShowRestartDialog(false);
    setUploading(false);
    navigate("/plugins");
  };

  // Sidebar aus PanelServers.tsx übernommen (Tooltip, Slide, Logout)
  const SIDEBAR_WIDTH = 72;
  const SIDEBAR_EXPANDED = 200;
  const menuItems = [
    { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
    { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
    { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
  ];
  const handleLogout = async () => {
    try {
      await fetch('/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      // Fehler ignorieren
    } finally {
      clearToken();
      navigate('/login');
    }
  };
  return (
    <Box sx={{ minHeight: "100vh", width: "100vw", display: "flex", background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)" }}>
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
        onMouseLeave={() => setHovered(null)}
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
              onClick={handleLogout}
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
      {/* Main Content */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ background: "#18233a", borderRadius: 6, boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.25)", px: 7, py: 7, minWidth: 700, maxWidth: 1000, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Typography variant="h4" sx={{ color: "#fff", fontWeight: 700, mb: 3, textAlign: "center" }}>
          Choose Servers
        </Typography>
        {loading ? (
          <CircularProgress sx={{ color: "#1976d2" }} />
        ) : (
          <Box sx={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
            {servers.map((s: Server) => {
              const stat = serverStats[s.name];
              return (
                <Card key={s.name} sx={{ minWidth: 500, maxWidth: 600, mb: 2, background: "#22304d", color: "#b0c4de", boxShadow: "0 2px 8px 0 rgba(25, 118, 210, 0.10)", borderRadius: 4 }}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start", mb: 1, gap: 1 }}>
                      <Checkbox
                        checked={selectedServers.includes(s.name)}
                        onChange={() => handleSelect(s.name)}
                        sx={{ color: "#1976d2", p: 0, mr: 1, alignSelf: "center" }}
                      />
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#fff", alignSelf: "center" }}>{s.name}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Status: {stat?.ram_used !== undefined ? (stat.ram_used > 0 ? "Running" : "Stopped") : (s.status || "unknown")}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      RAM: {stat?.ram_allocated ?? stat?.ram ?? "unknown"} MB{stat?.ram_used !== undefined ? ` (Used: ${stat.ram_used} MB)` : ""}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Version: {stat?.version || s.version || "unknown"}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Players: {stat?.player_count != null ? stat.player_count : "-"} / {stat?.max_players != null ? stat.max_players : "-"}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Locale: {stat?.locale ?? "unknown"}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Port: {stat?.port || s.port || "unknown"}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Plugins: {stat?.plugins?.length ? stat.plugins.join(", ") : "None"}
                    </Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
        {/* notifications are now handled globally */}
        <Button
          variant="contained"
          sx={{ mt: 3, background: "#1976d2", color: "#fff", fontWeight: 700, fontSize: 17, borderRadius: 3, px: 4, py: 1.5, boxShadow: "0 2px 8px 0 rgba(25, 118, 210, 0.10)" }}
          onClick={handleContinue}
          disabled={!selectedServers.length || loading || uploading}
        >
          {uploading ? "Uploading..." : "Continue"}
        </Button>
        {/* Restart Dialog */}
        <Dialog open={showRestartDialog} onClose={handleRestartSkip}
          PaperProps={{
            sx: {
              background: '#18233a',
              borderRadius: 4,
              color: '#fff',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
              minWidth: 400,
              px: 3,
              py: 2,
            }
          }}
        >
          <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: 24, background: 'transparent', pb: 1 }}>Restart servers?</DialogTitle>
          <DialogContent sx={{ background: 'transparent', color: '#b0c4de', fontSize: 17, fontWeight: 500, px: 0 }}>
            <Typography sx={{ color: '#b0c4de', mb: 1 }}>
              The following servers are currently running and need a restart for the plugin to take effect:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2, color: '#90caf9', fontWeight: 600, fontSize: 17 }}>
              {serversToRestart.map(s => <li key={s}>{s}</li>)}
            </Box>
            <Typography sx={{ color: '#b0c4de', mt: 1 }}>Do you want to restart them now?</Typography>
          </DialogContent>
          <DialogActions sx={{ background: 'transparent', px: 0, pb: 2, pt: 1 }}>
            <Button onClick={handleRestartSkip} sx={{
              color: '#fff',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 2,
              fontWeight: 700,
              px: 3,
              py: 1,
              mr: 1,
              '&:hover': { background: 'rgba(255,255,255,0.18)' }
            }}>No</Button>
            <Button onClick={handleRestartConfirm} autoFocus sx={{
              color: '#fff',
              background: '#1976d2',
              borderRadius: 2,
              fontWeight: 700,
              px: 3,
              py: 1,
              boxShadow: '0 2px 8px 0 rgba(25, 118, 210, 0.10)',
              '&:hover': { background: '#1565c0' }
            }}>Yes, restart</Button>
          </DialogActions>
        </Dialog>
        </Box>
      </Box>
    </Box>
  );
};

export default ChooseServerPage;
