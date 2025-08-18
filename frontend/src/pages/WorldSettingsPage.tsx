import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { isServerRunning } from "../api/isServerRunning";
import { restartServer } from "../api/restartServer";
import Tooltip from "@mui/material/Tooltip";
import Slide from "@mui/material/Slide";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import StorageIcon from '@mui/icons-material/Storage';
import ExtensionIcon from '@mui/icons-material/Extension';
import TuneIcon from '@mui/icons-material/Tune';
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from "@mui/material";

const difficulties = ["easy", "normal", "peaceful", "hard"];

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;
const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const WorldSettingsPage: React.FC = () => {
  const { servername } = useParams<{ servername: string }>();
  const navigate = useNavigate();
  const [seed, setSeed] = useState("");
  const [netherEnd, setNetherEnd] = useState(false);
  const [difficulty, setDifficulty] = useState("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  // Sidebar state
  const [hovered, setHovered] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    // Fetch current world settings from API
    if (!servername) return;
    setLoading(true);
    setError(null);
    fetch(`/api/server/properties/get?servername=${encodeURIComponent(servername)}`)
      .then(res => res.json())
      .then(data => {
        setSeed(data.seed || "");
        setNetherEnd(data.nether_end ?? false);
        setDifficulty(data.difficulty || "normal");
      })
      .catch(() => setError("Failed to load world settings."))
      .finally(() => setLoading(false));
  }, [servername]);

  const handleSave = async () => {
    if (!servername) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: token ? `Bearer ${token}` : ""
    };
    try {
      await fetch(`/api/server/properties/set-seed`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ servername, seed })
      });
      await fetch(`/api/server/properties/other_dimensions`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ servername, allow: netherEnd ? "true" : "false" })
      });
      await fetch(`/api/server/properties/set-difficulty`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ servername, difficulty })
      });
      setSuccess(true);
      // Check if server is running and show dialog
      const running = await isServerRunning(servername, token || undefined);
      if (running) setShowRestartDialog(true);
    } catch (e) {
      setError("Failed to save world settings.");
    }
    setLoading(false);
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
      {/* Sidebar und Zurück-Button: Button rechts von Sidebar */}
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
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
            mt: 0,
          }}
          onMouseLeave={() => setHovered(undefined)}
        >
          {/* Sidebar-Icons wie PanelServers: links, Text beim Ausfahren */}
          <Box sx={{ width: "100%", flex: 1 }}>
            {menuItems.map(item => (
              <Tooltip key={item.key} title={item.label} placement="right">
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: hovered ? 'flex-start' : 'center',
                    px: hovered ? 2 : 0,
                    py: 1.5,
                    cursor: "pointer",
                    color: hovered === item.key ? "#1976d2" : "#fff",
                    background: hovered === item.key ? "rgba(144,202,249,0.08)" : undefined,
                    borderRadius: 2,
                    my: 1,
                    transition: "background 0.2s, color 0.2s",
                    '&:hover': { background: "rgba(255,255,255,0.08)" },
                  }}
                  onMouseEnter={() => setHovered(item.key)}
                  onClick={() => {
                    if (item.key === "servers") window.location.href = "/servers";
                    if (item.key === "plugins") window.location.href = "/plugins";
                    if (item.key === "controls") window.location.href = "/controls";
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
          {/* Footer: Settings und Logout, zentriert bei eingefahrener Sidebar, links bei ausgefahrener */}
          <Box sx={{ width: "100%", pb: 1 }}>
            <Tooltip title="Settings" placement="right">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: hovered ? 'flex-start' : 'center',
                  px: hovered ? 2 : 0,
                  py: 2,
                  cursor: "pointer",
                  color: hovered === "settings" ? "#1976d2" : "#fff",
                  background: hovered === "settings" ? "rgba(144,202,249,0.08)" : undefined,
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
                  justifyContent: hovered ? 'flex-start' : 'center',
                  px: hovered ? 2 : 0,
                  py: 2,
                  cursor: "pointer",
                  color: hovered === "logout" ? "#f44336" : "#fff",
                  background: hovered === "logout" ? "rgba(244, 67, 54, 0.08)" : undefined,
                  borderRadius: 2,
                  transition: "background 0.2s, color 0.2s",
                  '&:hover': { background: "rgba(255,255,255,0.08)" },
                }}
                onMouseEnter={() => setHovered("logout")}
                onClick={() => window.location.href = '/login'}
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
        <Button
          onClick={() => window.history.back()}
          variant="outlined"
          sx={{
            color: '#b0c4de',
            borderColor: '#334155',
            fontWeight: 600,
            mt: 3,
            ml: 2,
            height: 40,
            zIndex: 2
          }}
        >
          Back
        </Button>
      </Box>
  {/* Main Content */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Paper
          elevation={10}
          sx={{
            p: 5,
            borderRadius: 4,
            background: "rgba(30,40,60,0.92)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            minWidth: 400,
            maxWidth: 500,
            width: "100%",
          }}
        >
          <Typography variant="h5" sx={{ color: "#fff", fontWeight: 700, mb: 3 }}>
            World Settings for <span style={{ color: '#90caf9' }}>{servername}</span>
          </Typography>
          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
          {success && <Typography color="success.main" sx={{ mb: 2 }}>Settings saved!</Typography>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Seed"
              value={seed}
              onChange={e => setSeed(e.target.value)}
              fullWidth
              variant="outlined"
              sx={{
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
              InputLabelProps={{ style: { color: '#b0c4de' } }}
            />
            <FormControlLabel
              control={<Switch checked={netherEnd} onChange={e => setNetherEnd(e.target.checked)} />}
              label={<span style={{ color: '#b0c4de' }}>Nether & End enabled</span>}
            />
            <FormControl fullWidth>
              <InputLabel id="difficulty-label" sx={{ color: '#b0c4de' }}>Difficulty</InputLabel>
              <Select
                labelId="difficulty-label"
                value={difficulty}
                label="Difficulty"
                onChange={e => setDifficulty(e.target.value)}
                sx={{
                  color: '#fff',
                  background: 'rgba(30,40,60,0.92)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#334155',
                  },
                }}
              >
                {difficulties.map(d => (
                  <MenuItem key={d} value={d} sx={{ color: '#b0c4de', background: '#22304a' }}>{d.charAt(0).toUpperCase() + d.slice(1)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
            <Button onClick={() => window.history.back()} sx={{ color: '#b0c4de' }}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" sx={{ fontWeight: 600, minWidth: 100 }} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </Box>
        </Paper>
        <Dialog open={showRestartDialog} onClose={() => setShowRestartDialog(false)}>
          <DialogTitle>Do you want to restart this server?</DialogTitle>
          <DialogContent>
            <Typography>
              This is required for a running server, otherwise your changes will not take effect immediately.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowRestartDialog(false)} color="inherit">Cancel</Button>
            <Button onClick={async () => {
              setShowRestartDialog(false);
              const token = localStorage.getItem("token");
              await restartServer(servername || "", token || undefined);
            }} color="primary" variant="contained">Restart</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default WorldSettingsPage;
