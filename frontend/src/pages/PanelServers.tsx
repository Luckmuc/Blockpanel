
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
import { fetchServers, startServer, acceptEula, deleteServer, stopServer, createAndStartServer, validatePort, suggestFreePort } from "../api/servers";
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
      await fetch('/api/logout', {
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

  // Pre-Creation EULA Dialog State
  const [preCreationEulaDialog, setPreCreationEulaDialog] = useState(false);
  const [pendingServerCreation, setPendingServerCreation] = useState<{
    name: string;
    purpurUrl: string;
    ram: string;
    port: number;
  } | null>(null);

  // Server Creation Progress Dialog State
  const [creationProgressDialog, setCreationProgressDialog] = useState(false);
  const [creationProgress, setCreationProgress] = useState({
    downloadData: false,
    initialRun: false,
    acceptEula: false,
    startServer: false,
    completed: false,
    currentStep: ""
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRam, setNewRam] = useState("2048");
  const [newPort, setNewPort] = useState("25565");
  const [newVersion, setNewVersion] = useState(SERVER_VERSIONS[0].version);
  const [creating, setCreating] = useState(false);
  
  // Port validation state
  const [portValidation, setPortValidation] = useState<{
    isValidating: boolean;
    isValid: boolean;
    message: string;
    suggestedPort?: number;
  }>({
    isValidating: false,
    isValid: true,
    message: "",
    suggestedPort: undefined
  });
  
  const [portConflictDialog, setPortConflictDialog] = useState<{
    open: boolean;
    suggestedPort: number;
    requestedPort: number;
  }>({ open: false, suggestedPort: 25566, requestedPort: 25565 });

  // Port validation function
  const validatePortInput = async (port: string) => {
    const portNum = parseInt(port);
    
    if (isNaN(portNum)) {
      setPortValidation({
        isValidating: false,
        isValid: false,
        message: "Port must be a number",
        suggestedPort: undefined
      });
      return;
    }

    if (portNum < 1 || portNum > 65535) {
      setPortValidation({
        isValidating: false,
        isValid: false,
        message: "Port must be between 1 and 65535",
        suggestedPort: undefined
      });
      return;
    }

    setPortValidation({
      isValidating: true,
      isValid: true,
      message: "Checking port availability...",
      suggestedPort: undefined
    });

    try {
      const result = await validatePort(portNum, token);
      if (result.valid) {
        setPortValidation({
          isValidating: false,
          isValid: true,
          message: "Port is available",
          suggestedPort: undefined
        });
      } else {
        // Get a suggestion
        const suggestion = await suggestFreePort(portNum, token);
        setPortValidation({
          isValidating: false,
          isValid: false,
          message: result.reason || "Port is not available",
          suggestedPort: suggestion.suggested_port
        });
      }
    } catch (err) {
      setPortValidation({
        isValidating: false,
        isValid: false,
        message: "Failed to validate port",
        suggestedPort: undefined
      });
    }
  };

  // Handler for port change with validation
  const handlePortChange = (newPort: string) => {
    setNewPort(newPort);
    
    // Debounce validation to avoid too many API calls
    const timeoutId = setTimeout(() => {
      validatePortInput(newPort);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  };

  // Handler for accepting suggested port
  const handleAcceptSuggestedPortFromValidation = () => {
    if (portValidation.suggestedPort) {
      setNewPort(portValidation.suggestedPort.toString());
      setPortValidation({
        isValidating: false,
        isValid: true,
        message: "",
        suggestedPort: undefined
      });
    }
  };

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

  // Handler for creating server - now shows EULA dialog first
  const handleCreate = async () => {
    // Find the selected version's purpur URL
    const selectedVersion = SERVER_VERSIONS.find(v => v.version === newVersion);
    if (!selectedVersion) {
      setEulaInfo("Invalid server version selected");
      return;
    }

    // Validate port one final time before creating
    const portNum = parseInt(newPort);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError("Invalid port number. Must be between 1 and 65535.");
      return;
    }

    // Check if port validation indicates the port is invalid
    if (!portValidation.isValid && !portValidation.isValidating) {
      setError(portValidation.message);
      return;
    }

    // Final port validation via API
    try {
      const result = await validatePort(portNum, token);
      if (!result.valid) {
        // Show port conflict dialog with suggestion
        const suggestion = await suggestFreePort(portNum, token);
        setPortConflictDialog({
          open: true,
          suggestedPort: suggestion.suggested_port,
          requestedPort: portNum
        });
        return;
      }
    } catch (err) {
      setError("Failed to validate port availability.");
      return;
    }

    // Store pending creation data and show EULA dialog
    setPendingServerCreation({
      name: newName,
      purpurUrl: selectedVersion.purpurURL,
      ram: newRam,
      port: portNum
    });
    
    setShowCreate(false);
    setPreCreationEulaDialog(true);
  };

  // Handler to accept port suggestion and create server
  const handleAcceptSuggestedPort = async () => {
    const suggestedPort = portConflictDialog.suggestedPort;
    setNewPort(suggestedPort.toString());
    setPortConflictDialog({ open: false, suggestedPort: 25566, requestedPort: 25565 });
    
    // Update port validation state to show new port is valid
    setPortValidation({
      isValidating: false,
      isValid: true,
      message: "Port is available",
      suggestedPort: undefined
    });
    
    // Re-trigger creation with new port
    setTimeout(() => handleCreate(), 100);
  };

  // Handler for accepting EULA and creating server
  const handleAcceptEulaAndCreate = async () => {
    if (!pendingServerCreation) return;
    
    setCreating(true);
    setEulaInfo(undefined);
    setPreCreationEulaDialog(false);
    
    // Show creation progress dialog
    setCreationProgressDialog(true);
    setCreationProgress({
      downloadData: false,
      initialRun: false,
      acceptEula: false,
      startServer: false,
      completed: false,
      currentStep: "Starting server creation..."
    });
    
    try {
      // Step 1: Download Data
      setCreationProgress(prev => ({ ...prev, currentStep: "Downloading server data..." }));
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
      setCreationProgress(prev => ({ ...prev, downloadData: true }));

      // Step 2: Initial Run
      setCreationProgress(prev => ({ ...prev, currentStep: "Running initial server setup..." }));
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
      setCreationProgress(prev => ({ ...prev, initialRun: true }));

      // Step 3: Accept EULA
      setCreationProgress(prev => ({ ...prev, currentStep: "Accepting EULA..." }));
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
      setCreationProgress(prev => ({ ...prev, acceptEula: true }));

      // Step 4: Start Server
      setCreationProgress(prev => ({ ...prev, currentStep: "Starting the server..." }));
      
      // Call the simplified create and start server API with port
      const result = await createAndStartServer(
        pendingServerCreation.name, 
        pendingServerCreation.purpurUrl, 
        pendingServerCreation.ram, 
        pendingServerCreation.port,
        true, 
        token
      );
      
      setCreationProgress(prev => ({ ...prev, startServer: true }));
      
      // Completion
      setCreationProgress(prev => ({ 
        ...prev, 
        completed: true,
        currentStep: `Server "${pendingServerCreation.name}" created successfully!`
      }));
      
      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Close dialogs and reset
      setCreationProgressDialog(false);
      setEulaInfo(result.message || `Server "${pendingServerCreation.name}" created and started successfully!`);
      
      // Reset form and pending data
      setNewName("");
      setNewRam("2048");
      setNewPort("25565");
      setNewVersion(SERVER_VERSIONS[0].version);
      
      // Reset and validate default port
      setPortValidation({
        isValidating: false,
        isValid: true,
        message: "",
        suggestedPort: undefined
      });
      
      // Validate the default port
      setTimeout(() => validatePortInput("25565"), 100);
      setPendingServerCreation(null);
      
      // Refresh server list
      fetchServers(token).then(setServers);
      
    } catch (error: any) {
      setCreationProgress(prev => ({ 
        ...prev, 
        currentStep: "Error: " + (error.message || "Failed to create server")
      }));
      
      // Wait a moment then close
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCreationProgressDialog(false);
      setEulaInfo(error.message || "Failed to create server. Please try again.");
      setPendingServerCreation(null);
    }
    setCreating(false);
  };

  // Handler for declining EULA
  const handleDeclineEula = () => {
    setPreCreationEulaDialog(false);
    setPendingServerCreation(null);
    setEulaInfo("Server creation cancelled. You must accept the EULA to create a Minecraft server.");
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
                  label="Port"
                  value={newPort}
                  onChange={e => handlePortChange(e.target.value)}
                  size="small"
                  type="number"
                  inputProps={{ min: 1, max: 65535 }}
                  helperText={
                    portValidation.isValidating ? (
                      <Box display="flex" alignItems="center" gap={1}>
                        <CircularProgress size={12} />
                        {portValidation.message}
                      </Box>
                    ) : portValidation.isValid ? (
                      portValidation.message || "Default: 25565"
                    ) : (
                      <Box>
                        <Typography variant="caption" color="error">
                          {portValidation.message}
                        </Typography>
                        {portValidation.suggestedPort && (
                          <Box>
                            <Button
                              size="small"
                              variant="text"
                              onClick={handleAcceptSuggestedPortFromValidation}
                              sx={{ p: 0, fontSize: '0.7rem', textTransform: 'none' }}
                            >
                              Use {portValidation.suggestedPort}
                            </Button>
                          </Box>
                        )}
                      </Box>
                    )
                  }
                  error={!portValidation.isValid && !portValidation.isValidating}
                  sx={{ minWidth: 120 }}
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
      
      {/* Server Creation Progress Dialog */}
      <Dialog 
        open={creationProgressDialog} 
        disableEscapeKeyDown
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            color: '#fff',
            borderRadius: 4,
            boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.5)',
            minHeight: '400px'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#fff', textAlign: 'center', pb: 1 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            🚀 Creating Server: {pendingServerCreation?.name}
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ px: 4, pb: 4 }}>
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography sx={{ color: '#b0c4de', fontSize: 16 }}>
              Please wait while we set up your Minecraft server...
            </Typography>
          </Box>

          {/* Progress Checklist */}
          <Box sx={{ maxWidth: 500, mx: 'auto' }}>
            {[
              { key: 'downloadData', label: 'Download Data', icon: '📦' },
              { key: 'initialRun', label: 'Initial Run', icon: '⚙️' },
              { key: 'acceptEula', label: 'Accept EULA', icon: '📋' },
              { key: 'startServer', label: 'Start the Server', icon: '🎮' }
            ].map((step) => (
              <Box
                key={step.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  background: creationProgress[step.key as keyof typeof creationProgress] 
                    ? 'linear-gradient(90deg, #2e7d32 0%, #4caf50 100%)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${creationProgress[step.key as keyof typeof creationProgress] ? '#4caf50' : '#444'}`,
                  transition: 'all 0.3s ease'
                }}
              >
                <Box sx={{ mr: 3, fontSize: 24 }}>
                  {creationProgress[step.key as keyof typeof creationProgress] ? '✅' : step.icon}
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 18 }}>
                    {step.label}
                  </Typography>
                </Box>

                <Box sx={{ ml: 2 }}>
                  {creationProgress[step.key as keyof typeof creationProgress] ? (
                    <Typography sx={{ color: '#4caf50', fontWeight: 600 }}>✓ Done</Typography>
                  ) : (
                    <CircularProgress size={20} color="info" />
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Current Step Info */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography sx={{ 
              color: creationProgress.completed ? '#4caf50' : '#ffb300', 
              fontSize: 16, 
              fontWeight: 500,
              minHeight: 24
            }}>
              {creationProgress.currentStep}
            </Typography>
          </Box>

          {/* Completion Message */}
          {creationProgress.completed && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography sx={{ color: '#4caf50', fontSize: 18, fontWeight: 600 }}>
                🎉 Server created successfully!
              </Typography>
              <Typography sx={{ color: '#b0c4de', fontSize: 14, mt: 1 }}>
                Returning to panel...
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Pre-Creation EULA Dialog */}
      <Dialog open={preCreationEulaDialog} onClose={() => !creating && handleDeclineEula()} maxWidth="sm" fullWidth
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
          🚀 Create Minecraft Server
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 3, color: '#b0c4de', textAlign: 'center', fontSize: 16 }}>
            {pendingServerCreation && (
              <>Server: <strong style={{ color: '#90caf9' }}>{pendingServerCreation.name}</strong><br/>
              RAM: <strong style={{ color: '#90caf9' }}>{pendingServerCreation.ram}MB</strong><br/>
              Port: <strong style={{ color: '#90caf9' }}>{pendingServerCreation.port}</strong></>
            )}
          </Typography>
          
          <Typography sx={{ mb: 2, color: '#fff', textAlign: 'center', fontSize: 15 }}>
            Do you agree to the <strong>Minecraft End User License Agreement (EULA)</strong>?
          </Typography>
          
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <a 
              href="https://account.mojang.com/documents/minecraft_eula" 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ 
                color: '#90caf9', 
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              📄 Read the Minecraft EULA →
            </a>
          </Box>
          
          <Typography sx={{ color: '#ffab91', fontSize: 13, textAlign: 'center', fontStyle: 'italic' }}>
            By creating a Minecraft server, you must agree to the EULA.
            If you decline, the server will not be created.
          </Typography>
          
          {creating && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
              <CircularProgress size={24} color="info" sx={{ mb: 1 }} />
              <Typography sx={{ color: '#ffb300', fontSize: 14 }}>Creating server...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 2 }}>
          <Button 
            onClick={handleDeclineEula} 
            color="error" 
            variant="outlined" 
            disabled={creating} 
            sx={{ minWidth: 120, fontWeight: 600, textTransform: 'none' }}
          >
            ❌ Decline
          </Button>
          <Button 
            onClick={handleAcceptEulaAndCreate} 
            color="success" 
            variant="contained" 
            disabled={creating} 
            sx={{ minWidth: 120, fontWeight: 600, textTransform: 'none' }}
          >
            ✅ Accept & Create
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Port Conflict Dialog */}
      <Dialog 
        open={portConflictDialog.open} 
        onClose={() => setPortConflictDialog({ open: false, suggestedPort: 25566, requestedPort: 25565 })}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(26, 32, 44, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Port Conflict Detected
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: '#b0c4de', textAlign: 'center' }}>
            Port {portConflictDialog.requestedPort} is already in use by another server.
          </Typography>
          <Typography sx={{ mb: 2, color: '#90caf9', textAlign: 'center' }}>
            Would you like to use port {portConflictDialog.suggestedPort} instead?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button 
            onClick={() => setPortConflictDialog({ open: false, suggestedPort: 25566, requestedPort: 25565 })} 
            color="error" 
            variant="outlined" 
            sx={{ minWidth: 100, fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAcceptSuggestedPort} 
            color="success" 
            variant="contained" 
            sx={{ minWidth: 100, fontWeight: 600 }}
          >
            Use Port {portConflictDialog.suggestedPort}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PanelServers;