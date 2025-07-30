
import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, Button, CircularProgress, Avatar, IconButton, Tooltip, Slide } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import BarChartIcon from "@mui/icons-material/BarChart";
import TuneIcon from "@mui/icons-material/Tune";
import StorageIcon from "@mui/icons-material/Storage";
import ExtensionIcon from "@mui/icons-material/Extension";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import { fetchServers, startServer, acceptEula, deleteServer, stopServer } from "../api/servers";
import { checkServerPort } from "../api/servers";
import ServerStatusPanel from "./ServerStatusPanel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import type { Server } from "../types/server";
import { SERVER_VERSIONS } from "../data/serverVersions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;
const SERVER_ICON_SIZE = 56;

const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const PanelServers: React.FC = () => {
  const [hovered, setHovered] = useState<string | undefined>(undefined);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showStatusPanel, setShowStatusPanel] = useState<{ open: boolean, server: string | undefined }>({ open: false, server: undefined });
  const { token: rawToken, clearToken } = useAuth();
  const token = rawToken ?? undefined;
  const navigate = useNavigate();

  // Poll server status und Port-Check
  useEffect(() => {
    let active = true;
    const pollAll = async () => {
      try {
        const fetched = await fetchServers(token);
        if (!active) return;
        // Für alle Server, die laut Backend running oder booting sind, Port checken
        const checked = await Promise.all(fetched.map(async (srv) => {
          if (srv.status === "running" || srv.status === "booting") {
            const portRes = await checkServerPort(srv.name, token);
            if (portRes.open) {
              return { ...srv, status: "running" };
            } else {
              return { ...srv, status: "booting" };
            }
          }
          return srv;
        }));
        setServers((prev: Server[]) => {
          if (JSON.stringify(prev) !== JSON.stringify(checked)) {
            return checked;
          }
          return prev;
        });
      } catch (e) {}
      if (active) {
        setTimeout(pollAll, 1000);
      }
    };
    pollAll();
    return () => { active = false; };
  }, [token]);

  // Handler for stopping server
  const handleStopServer = async (server: string) => {
    try {
      await stopServer(server, token);
      setTimeout(() => fetchServers(token).then(setServers), 1000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to stop server.');
      console.error('Failed to stop server:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearToken();
      navigate('/login');
    }
  };

  // EULA Dialog State
  const [eulaDialog, setEulaDialog] = useState<{ open: boolean, server: string | undefined, isNewServer: boolean }>({ open: false, server: undefined, isNewServer: false });
  const [eulaWaiting, setEulaWaiting] = useState(false);
  const [eulaInfo, setEulaInfo] = useState<string | undefined>(undefined);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRam, setNewRam] = useState("2048");
  const [newVersion, setNewVersion] = useState(SERVER_VERSIONS[0].version);
  const [creating, setCreating] = useState(false);

  // Handler for starting server
  const handleStartServer = async (server: string) => {
    // Status sofort auf booting setzen, damit UI direkt reagiert
    setServers((prev: Server[]) => prev.map((s: Server) => s.name === server ? { ...s, status: "booting" } : s));
    try {
      const res = await startServer(server, token);
      // Axios-Response oder direktes Objekt?
      let status: string | undefined = undefined;
      if (res && typeof res === 'object') {
        if ('data' in res && typeof res.data === 'object' && res.data !== null) {
          status = (res.data as any).status;
        } else if ('status' in res) {
          status = (res as any).status;
        }
      }
      if (status === "already running") {
        setServers((prev: Server[]) => prev.map((s: Server) => s.name === server ? { ...s, status: "running" } : s));
        return;
      }
      if (status === "started") {
        setServers((prev: Server[]) => prev.map((s: Server) => s.name === server ? { ...s, status: "running" } : s));
      }
      // Kein eigenes Polling mehr, das übernimmt das useEffect oben
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to start server.');
      console.error('Failed to start server:', err);
    }
  };

  // Handler for EULA dialog
  const handleEulaDecision = async (accept: boolean) => {
    if (!eulaDialog.server) return;
    setEulaWaiting(true);
    setEulaInfo(undefined);
    if (!accept) {
      try {
        await deleteServer(eulaDialog.server, token);
        setEulaInfo("Server deleted because EULA was not accepted.");
        setTimeout(() => {
          setEulaDialog({ open: false, server: undefined, isNewServer: false });
          setEulaWaiting(false);
          fetchServers(token).then(setServers);
        }, 2000);
      } catch (err) {
        setEulaInfo("Failed to delete server.");
        setEulaWaiting(false);
      }
      return;
    }
    try {
      await acceptEula(eulaDialog.server, token);
      if (eulaDialog.isNewServer) {
        await startServer(eulaDialog.server, token);
        setTimeout(() => {
          setEulaDialog({ open: false, server: undefined, isNewServer: false });
          setEulaWaiting(false);
          setShowStatusPanel({ open: true, server: eulaDialog.server });
          fetchServers(token).then(setServers);
        }, 1000);
      } else {
        setEulaDialog({ open: false, server: undefined, isNewServer: false });
        setEulaWaiting(false);
        fetchServers(token).then(setServers);
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.message || "Failed to accept EULA or start server. Please try again.";
      setEulaInfo(errorMsg);
      setEulaWaiting(false);
      console.error('EULA accept/start error:', err);
    }
  };

  // Handler for closing status panel
  const handleCloseStatusPanel = () => {
    setShowStatusPanel({ open: false, server: undefined });
    fetchServers(token).then(setServers);
  };

  useEffect(() => {
    setLoading(true);
    fetchServers(token)
      .then(setServers)
      .catch(() => setError("Could not load servers."))
      .finally(() => setLoading(false));
  }, [token]);

  // Handler for creating server
  const handleCreate = async () => {
    setCreating(true);
    setEulaInfo(undefined);
    try {
      // Dummy create logic, replace with actual API call if needed
      setEulaDialog({ open: true, server: newName, isNewServer: true });
      setShowCreate(false);
      setEulaInfo(undefined);
    } catch (error: any) {
      setEulaInfo(error.message || "Failed to create server. Please try again.");
    }
    setCreating(false);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)",
      }}
    >
      {showStatusPanel.open && showStatusPanel.server && (
        <ServerStatusPanel 
          serverName={showStatusPanel.server} 
          onClose={handleCloseStatusPanel}
          token={token}
        />
      )}
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
            p: 6,
            borderRadius: 4,
            background: "rgba(30,40,60,0.92)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            textAlign: "center",
            maxWidth: 900,
            width: "100%",
            minHeight: 500,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Typography variant="h5" sx={{ color: "#fff", fontWeight: 700 }}>
              Your Servers
            </Typography>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                size="large"
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  px: 3,
                  py: 1.2,
                  fontSize: 18,
                  boxShadow: '0 2px 8px 0 rgba(25, 118, 210, 0.15)',
                  minWidth: 180,
                  letterSpacing: 1.1,
                  ml: 4
                }}
                onClick={() => setShowCreate(true)}
              >
                CREATE NEW SERVER
              </Button>
            </Box>
          </Box>
          {showCreate && (
            <Paper sx={{ p: 3, mb: 3, background: "rgba(30,40,60,0.98)" }}>
              <Typography variant="h6" sx={{ color: "#fff", mb: 2 }}>Create New Server</Typography>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                <TextField
                  label="Server Name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  size="small"
                  sx={{ minWidth: 180 }}
                />
                <TextField
                  label="RAM (MB)"
                  value={newRam}
                  onChange={e => setNewRam(e.target.value)}
                  size="small"
                  type="number"
                  inputProps={{ min: 512, max: 8192, step: 256 }}
                  helperText="512MB - 8192MB"
                  sx={{ minWidth: 140 }}
                />
                <TextField
                  select
                  label="Version"
                  value={newVersion}
                  onChange={e => setNewVersion(e.target.value)}
                  size="small"
                  sx={{ minWidth: 180 }}
                >
                  {SERVER_VERSIONS.map(v => (
                    <MenuItem key={v.version} value={v.version}>{v.label}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-start', mt: 1 }}>
                <Button
                  variant="outlined"
                  onClick={handleCreate}
                  disabled={creating}
                  size="small"
                  sx={{ minWidth: 100 }}
                >
                  {creating ? "Creating..." : "Create"}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowCreate(false)}
                  size="small"
                  sx={{ minWidth: 100 }}
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          )}

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 6, flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography color="error" sx={{ mt: 6, flex: 1 }}>{error}</Typography>
          ) : servers.length === 0 ? (
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ color: "#b0c4de", fontSize: 22 }}>No servers found.</Typography>
            </Box>
          ) : (
            <Box sx={{ width: "100%" }}>
              {servers.map((server) => (
                <Paper
                  key={server.name}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    p: 3,
                    borderRadius: 3,
                    background: "rgba(30,40,60,0.96)",
                    boxShadow: "0 4px 16px 0 rgba(31, 38, 135, 0.18)",
                    mb: 3,
                  }}
                >
                  {/* Server Icon */}
                  <Avatar
                    src={`/mc_servers/${server.name}/server-icon.png`}
                    sx={{
                      width: SERVER_ICON_SIZE,
                      height: SERVER_ICON_SIZE,
                      bgcolor: "#222a3a",
                      mr: 3,
                    }}
                    imgProps={{ onError: (e: any) => { e.target.onerror = null; e.target.src = undefined; } }}
                  >
                    <HelpOutlineIcon fontSize="large" />
                  </Avatar>
                  {/* Server Info */}
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700 }}>
                      {server.name}
                    </Typography>
                    <Typography sx={{ color: "#b0c4de", fontSize: 15 }}>
                      {server.address}
                    </Typography>
                    {/* Status-Anzeige zentriert unter Name/Adresse */}
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                      {server.status === "running" ? (
                        <Typography sx={{ color: "#4caf50", fontWeight: 600, fontSize: 14 }}>Running</Typography>
                      ) : server.status === "booting" ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: '#2196f3', fontWeight: 600, fontSize: 14 }}>Booting up...</Typography>
                          <CircularProgress size={16} color="info" />
                        </Box>
                      ) : server.status === "creating" ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: '#ffb300', fontWeight: 600, fontSize: 14 }}>Creating...</Typography>
                          <CircularProgress size={16} color="warning" />
                        </Box>
                      ) : (
                        <Typography sx={{ color: "#f44336", fontWeight: 600, fontSize: 14 }}>Stopped</Typography>
                      )}
                    </Box>
                  </Box>
                  {/* Action Buttons: Keine Buttons bei booting */}
                  {server.status === "running" ? (
                    <Tooltip title="Stop Server">
                      <Button variant="contained" color="error" size="small" sx={{ mr: 1 }} onClick={() => handleStopServer(server.name)}>
                        Stop
                      </Button>
                    </Tooltip>
                  ) : server.status === "booting" ? null : server.status !== "creating" && (
                    <Tooltip title="Start Server">
                      <Button variant="contained" color="success" size="small" sx={{ mr: 1 }} onClick={() => handleStartServer(server.name)}>
                        Start
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip title="Controls"><IconButton color="primary"><TuneIcon /></IconButton></Tooltip>
                  <Tooltip title="Settings">
                    <IconButton color="primary" onClick={() => navigate(`/servers/${server.name}/settings`)}>
                      <SettingsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Stats">
                    <span>
                      <IconButton 
                        color="primary" 
                        onClick={() => navigate(`/servers/stats/${server.name}`)}
                        sx={{
                          bgcolor: '#1e293b',
                          '&:hover': { bgcolor: '#26334d' },
                          boxShadow: 2,
                          cursor: 'pointer',
                        }}
                      >
                        <BarChartIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
      {/* EULA Dialog */}
      <Dialog open={eulaDialog.open} onClose={() => !eulaWaiting && setEulaDialog({ open: false, server: undefined, isNewServer: false })} maxWidth="sm" fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
            color: '#fff',
            borderRadius: 3,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Do you agree to the EULA of Minecraft?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: '#b0c4de', textAlign: 'center' }}>
            <a href="https://account.mojang.com/documents/minecraft_eula" target="_blank" rel="noopener noreferrer" style={{ color: '#90caf9' }}>Read the EULA</a>
          </Typography>
          {eulaWaiting && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
              <CircularProgress size={22} color="info" sx={{ mb: 1 }} />
              <Typography sx={{ color: '#ffb300', fontSize: 14 }}>Processing...</Typography>
            </Box>
          )}
          {eulaInfo && (
            <Typography sx={{ color: '#f44336', mb: 1, textAlign: 'center', fontSize: 14 }}>
              {eulaInfo}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button onClick={() => handleEulaDecision(false)} color="error" variant="outlined" disabled={eulaWaiting} sx={{ minWidth: 100, fontWeight: 600 }}>
            Decline
          </Button>
          <Button onClick={() => handleEulaDecision(true)} color="success" variant="contained" disabled={eulaWaiting} sx={{ minWidth: 100, fontWeight: 600 }}>
            Agree
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PanelServers;