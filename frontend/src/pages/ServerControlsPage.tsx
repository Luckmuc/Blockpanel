import React, { useState } from "react";
import WorldSettingsDialog from "../components/WorldSettingsDialog";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Tooltip, Slide
} from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsIcon from "@mui/icons-material/Settings";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../auth/AuthProvider";

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;
const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const ServerControlsPage: React.FC = () => {
  const { servername } = useParams<{ servername: string }>();
  const { token, clearToken } = useAuth();
  const [hovered, setHovered] = useState<string | null>(null);
  const [worldDialogOpen, setWorldDialogOpen] = useState(false);
  // Beispielwerte, später aus API laden
  const [worldSettings, setWorldSettings] = useState({
    seed: "",
    nether_end: true,
    difficulty: "normal"
  });
  const navigate = useNavigate();

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
                  if (item.key === "controls") navigate(`/servers/${servername}/controls`);
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
        <Paper sx={{
          p: 5,
          borderRadius: 4,
          minWidth: 600,
          maxWidth: 900,
          width: '80%',
          background: '#1e293c',
          textAlign: 'left',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: '#fff' }}>Server Controls: {servername}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* World Sektor */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#22304a',
              borderRadius: 2,
              p: 3,
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            }}>
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="h6" sx={{ color: '#b0c4de', fontWeight: 600 }}>World</Typography>
                <Typography sx={{ color: '#b0c4de', opacity: 0.8, fontSize: 15, mt: 0.5 }}>
                  Change the seed, restrict nether or end, difficulty, etc.
                </Typography>
              </Box>
              <Box>
                <button
                  style={{
                    background: '#1976d2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 20px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 16
                  }}
                  onClick={() => setWorldDialogOpen(true)}
                >Edit</button>
              </Box>
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
                // Hier später API-Call zum Speichern
              }}
            />
            {/* Rights Sektor */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#22304a',
              borderRadius: 2,
              p: 3,
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            }}>
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="h6" sx={{ color: '#b0c4de', fontWeight: 600 }}>Rights</Typography>
                <Typography sx={{ color: '#b0c4de', opacity: 0.8, fontSize: 15, mt: 0.5 }}>
                  Choose admins, default gamemode and enable or disable cheats
                </Typography>
              </Box>
              <Box>
                <button style={{
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 20px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 16
                }}>Edit</button>
              </Box>
            </Box>
            {/* Server Sektor */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#22304a',
              borderRadius: 2,
              p: 3,
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            }}>
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="h6" sx={{ color: '#b0c4de', fontWeight: 600 }}>Server</Typography>
                <Typography sx={{ color: '#b0c4de', opacity: 0.8, fontSize: 15, mt: 0.5 }}>
                  Create a white/blacklist, ban/unban or kick people.
                </Typography>
              </Box>
              <Box>
                <button style={{
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 20px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 16
                }}>Edit</button>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default ServerControlsPage;
