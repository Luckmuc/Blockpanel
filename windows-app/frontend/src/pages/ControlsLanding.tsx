import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, Button, CircularProgress, Tooltip, Slide } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsIcon from "@mui/icons-material/Settings";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../auth/AuthProvider";
import { fetchServers } from "../api/servers";
import { useNavigate } from "react-router-dom";
import type { Server } from "../types/server";

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;

const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const ControlsLanding: React.FC = () => {
  const { token, clearToken } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchServers(token || undefined)
      .then((data: Server[]) => { 
        if (mounted) setServers(data || []); 
      })
      .catch(() => { 
        if (mounted) setServers([]); 
      })
      .finally(() => { 
        if (mounted) setLoading(false); 
      });
    return () => { mounted = false; };
  }, [token]);

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
                  background: hovered === item.key ? "rgba(25, 118, 210, 0.08)" : 
                           item.key === "controls" ? "rgba(25, 118, 210, 0.15)" : undefined,
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
        <Paper sx={{
          p: 5,
          borderRadius: 4,
          minWidth: 600,
          maxWidth: 900,
          width: '80%',
          background: '#1e293c',
          textAlign: 'center',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        }}>
          <Typography variant="h4" sx={{ mb: 4, fontWeight: 700, color: '#fff' }}>
            Server Controls
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, color: '#b0c4de', fontSize: 16 }}>
            Select a server to manage its settings, world configuration, and permissions.
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#1976d2' }} />
            </Box>
          ) : servers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#b0c4de', mb: 3, fontSize: 18 }}>
                No servers found. Create a server first.
              </Typography>
              <Button 
                variant="contained" 
                size="large"
                sx={{ 
                  background: '#1976d2',
                  '&:hover': { background: '#1565c0' },
                  borderRadius: 3,
                  px: 4,
                  py: 1.5,
                  fontSize: 16,
                  fontWeight: 600
                }}
                onClick={() => navigate('/servers')}
              >
                Go to Servers
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {servers.map((server: Server) => (
                <Box
                  key={server.name}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#22304a',
                    borderRadius: 3,
                    p: 3,
                    boxShadow: '0 4px 16px 0 rgba(31, 38, 135, 0.3)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px 0 rgba(31, 38, 135, 0.4)',
                    }
                  }}
                >
                  <Box sx={{ flex: 1, textAlign: 'left' }}>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>
                      {server.name}
                    </Typography>
                    <Typography sx={{ color: '#b0c4de', opacity: 0.8, fontSize: 14 }}>
                      {server.address || 'No address configured'}
                    </Typography>
                    <Typography sx={{ color: '#b0c4de', opacity: 0.6, fontSize: 12, mt: 0.5 }}>
                      Status: {server.status || 'Unknown'}
                    </Typography>
                  </Box>
                  <Box>
                    <Button
                      variant="contained"
                      size="large"
                      sx={{
                        background: '#1976d2',
                        '&:hover': { background: '#1565c0' },
                        borderRadius: 2,
                        px: 3,
                        py: 1,
                        fontSize: 14,
                        fontWeight: 600,
                        textTransform: 'none'
                      }}
                      onClick={() => navigate(`/servers/${server.name}/controls`)}
                    >
                      Manage Controls
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default ControlsLanding;
