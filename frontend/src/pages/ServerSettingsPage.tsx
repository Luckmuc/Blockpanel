
import React, { useState } from "react";
import WorldSettingsDialog from "../components/WorldSettingsDialog";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Slider, Chip, Stack, Tooltip, Slide
} from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsIcon from "@mui/icons-material/Settings";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import LogoutIcon from "@mui/icons-material/Logout";
import { deleteServer } from "../api/servers";
import { setServerProperty } from "../api/serverProperties";
import axios from "axios";
import { API_BASE } from "../config/api";
import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "../components/NotificationProvider";





const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;
const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const ServerSettingsPage: React.FC = () => {
  const { servername } = useParams<{ servername: string }>();
  const { token, clearToken } = useAuth();
  // const username = getUsernameFromToken(token) || "User";
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State for settings
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [ramMb, setRamMb] = useState(2048);
  const [serverNameInput, setServerNameInput] = useState(servername ?? "");
  const ramPresets = [1024, 2048, 3072, 4096, 8192];
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  // World Settings Dialog State
  const [worldDialogOpen, setWorldDialogOpen] = useState(false);
  const [worldSettings, setWorldSettings] = useState({
    seed: "",
    nether_end: true,
    difficulty: "normal"
  });

  const { notify } = useNotification();
  // Simulate fetching current settings (replace with real API call)
  React.useEffect(() => {
    // TODO: fetch real settings from backend
    setMaxPlayers(20);
    setRamMb(2048);
    setServerNameInput(servername ?? "");
  }, [servername, token]);

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


  // Save settings to backend
  const saveSettings = async () => {
    setSaveError(null);
    try {
      // Save max-players
      await setServerProperty(servername ?? "", "max-players", String(maxPlayers), token ?? undefined);
      // Save RAM (ramMb) via /server/ram/set
      await axios.post(
        `${API_BASE}/server/ram/set`,
        new URLSearchParams({ servername: servername ?? "", ram: String(ramMb) }),
        { headers: token ? { Authorization: `Bearer ${token ?? undefined}` } : {} }
      );
      // Servername ändern, falls geändert und nicht leer und anders als vorher
      if (serverNameInput && serverNameInput !== servername) {
        await axios.post(
          `${API_BASE}/server/rename`,
          new URLSearchParams({ old_name: servername ?? "", new_name: serverNameInput }),
          { headers: token ? { Authorization: `Bearer ${token ?? undefined}` } : {} }
        );
      }
      // Simulate: if RAM, maxPlayers oder Name geändert, restart required
      return { restartRequired: true };
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail || e?.message || 'Failed to save settings.');
      return { restartRequired: false };
    }
  };

  // Save settings, open restart dialog if nötig
  const handleSave = async () => {
    setSaveLoading(true);
    setSaveError(null);
    const result = await saveSettings();
    setSaveLoading(false);
    if (result.restartRequired) {
      setRestartDialogOpen(true);
    } else {
      notify({ type: 'error', message: saveError || 'Failed to save settings.' });
    }
  };

  // Restart only, settings already saved
  const handleConfirmRestart = async () => {
    setRestartDialogOpen(false);
    setSaveLoading(true);
    setSaveError(null);
    try {
      // Hole aktuellen Serverstatus
      const statusResp = await axios.get(`${API_BASE}/server/status?servername=${servername}`, {
        headers: token ? { Authorization: `Bearer ${token ?? undefined}` } : {}
      });
      const isRunning = statusResp.data?.status === "running";
      if (isRunning) {
        // Nutze den dedizierten Restart-Endpoint
        await axios.post(
          `${API_BASE}/server/restart?servername=${servername}`,
          {},
          { headers: token ? { Authorization: `Bearer ${token ?? undefined}` } : {} }
        );
        notify({ type: 'success', message: 'Settings saved and server restarted.' });
      } else {
        notify({ type: 'success', message: 'Settings saved.' });
      }
      await new Promise(res => setTimeout(res, 700));
      navigate('/servers');
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail || e?.message || "Failed to restart server.");
      notify({ type: 'error', message: e?.response?.data?.detail || e?.message || 'Failed to restart server.' });
    }
    setSaveLoading(false);
  };

  const handleCancelRestart = () => {
    setRestartDialogOpen(false);
  };


  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteServer(servername ?? "", token ?? undefined);
      setDeleting(false);
      setConfirmOpen(false);
      navigate("/servers");
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to delete server.");
      setDeleting(false);
    }
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
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Paper sx={{ p: 5, borderRadius: 4, minWidth: 600, maxWidth: 900, width: '80%', background: '#1e293c' }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: '#fff' }}>Server Settings: {servername}</Typography>
          {/* Example settings, can be expanded */}
          <Box sx={{ mb: 3 }}>
            {/* World Settings Edit Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="outlined" color="primary" onClick={() => setWorldDialogOpen(true)}>
                Edit World Settings
              </Button>
            </Box>
            <WorldSettingsDialog
              open={worldDialogOpen}
              onClose={() => setWorldDialogOpen(false)}
              seed={worldSettings.seed}
              nether_end={worldSettings.nether_end}
              difficulty={worldSettings.difficulty}
              onSave={settings => {
                setWorldSettings(settings);
                setWorldDialogOpen(false);
              }}
            />
            <Typography sx={{ mb: 1, fontWeight: 500, color: '#b0c4de' }}>Server Name</Typography>
            <TextField
              label="Server Name"
              value={serverNameInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerNameInput(e.target.value)}
              size="small"
              sx={{ mb: 2, minWidth: 200 }}
              inputProps={{ maxLength: 32 }}
              helperText={serverNameInput !== servername ? 'Will be renamed on save.' : 'Current name.'}
            />
            {/* Max Players Slider */}
            <Typography sx={{ mb: 1, fontWeight: 500, color: '#b0c4de' }}>Max Players</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Slider
                value={maxPlayers}
                min={1}
                max={30}
                step={1}
                onChange={(_, val) => setMaxPlayers(val as number)}
                sx={{ flex: 1, mr: 2 }}
                valueLabelDisplay="auto"
                aria-label="Max Players"
              />
              <Box sx={{ minWidth: 40, textAlign: 'center', color: '#fff', fontWeight: 600 }}>{maxPlayers}</Box>
            </Box>
            {/* RAM Selection */}
            <Typography sx={{ mb: 1, fontWeight: 500, color: '#b0c4de' }}>RAM</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {ramPresets.map((mb) => (
                <Chip
                  key={mb}
                  label={`${mb / 1024} GB`}
                  clickable
                  color={ramMb === mb ? 'primary' : 'default'}
                  onClick={() => setRamMb(mb)}
                  sx={{ fontWeight: 600, color: ramMb === mb ? '#fff' : '#b0c4de', background: ramMb === mb ? 'linear-gradient(90deg, #1976d2 0%, #1e293b 100%)' : '#232b3b' }}
                />
              ))}
            </Stack>
            <TextField
              label="Custom RAM (MB)"
              type="number"
              size="small"
              sx={{ minWidth: 200 }}
              value={ramMb}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRamMb(Number(e.target.value))}
              inputProps={{ min: 256, max: 65536 }}
              helperText="Enter a value or select a preset above."
            />
          </Box>
          {saveError && <Typography color="error" sx={{ mb: 1 }}>{saveError}</Typography>}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 6 }}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setConfirmOpen(true)}
              sx={{ alignSelf: 'flex-start', minWidth: 120 }}
            >
              Delete Server
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={saveLoading}
              sx={{ alignSelf: 'flex-end', minWidth: 120, position: 'relative' }}
            >
              {saveLoading ? (
                <>
                  <span style={{ opacity: 0 }}>{'Save'}</span>
                  <span style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" stroke="#fff">
                      <g fill="none" fillRule="evenodd" strokeWidth="4">
                        <circle cx="22" cy="22" r="18" strokeOpacity=".5"/>
                        <path d="M40 22c0-9.94-8.06-18-18-18">
                          <animateTransform attributeName="transform" type="rotate" from="0 22 22" to="360 22 22" dur="1s" repeatCount="indefinite"/>
                        </path>
                      </g>
                    </svg>
                  </span>
                </>
              ) : 'Save'}
            </Button>
          </Box>
          {/* Restart warning dialog */}
          <Dialog
            open={restartDialogOpen}
            onClose={handleCancelRestart}
            PaperProps={{
              sx: {
                background: '#1e293c',
                color: '#fff',
                borderRadius: 3,
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                minWidth: 400,
                p: 2,
              },
            }}
          >
            <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>Server Restart Required</DialogTitle>
            <DialogContent>
              <Typography sx={{ color: '#b0c4de', mb: 2 }}>
                Changing these settings requires a server restart. Are you sure you want to apply the changes and restart the server now?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCancelRestart} disabled={saveLoading} sx={{ color: '#b0c4de' }}>Cancel</Button>
              <Button onClick={handleConfirmRestart} color="error" variant="contained" disabled={saveLoading} sx={{ fontWeight: 600, minWidth: 120 }}>
                Restart &amp; Apply
              </Button>
            </DialogActions>
          </Dialog>
          {/* Delete confirmation dialog with name input */}
          <Dialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            PaperProps={{
              sx: {
                background: '#1e293c',
                color: '#fff',
                borderRadius: 3,
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                minWidth: 400,
                p: 2,
              }
            }}
          >
            <DialogTitle sx={{ fontWeight: 700, color: '#fff', textAlign: 'center', pb: 1 }}>
              Confirm Delete
            </DialogTitle>
            <DialogContent sx={{ px: 3, pb: 2 }}>
              <Typography color="error" sx={{ mb: 2, fontWeight: 500, textAlign: 'center' }}>
                This action cannot be undone.<br />
                To confirm, please type the server name below:
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="Server Name"
                value={error || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setError(e.target.value)}
                sx={{ mb: 2,
                  '& .MuiInputBase-root': {
                    background: 'rgba(30,40,60,0.92)',
                    color: '#fff',
                    borderRadius: 2,
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b0c4de',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#334155',
                  },
                }}
                error={!!error && error !== servername}
                helperText={error && error !== servername ? 'Name does not match.' : ''}
                InputLabelProps={{ style: { color: '#b0c4de' } }}
              />
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
              <Button onClick={() => setConfirmOpen(false)} disabled={deleting} sx={{ color: '#b0c4de' }}>Cancel</Button>
              <Button
                onClick={handleDelete}
                color="error"
                variant="contained"
                disabled={deleting || error !== servername}
                sx={{ minWidth: 100, fontWeight: 600 }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Box>
    </Box>
  );
};

export default ServerSettingsPage;
