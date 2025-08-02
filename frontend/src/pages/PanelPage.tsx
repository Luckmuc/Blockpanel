import React, { useState } from "react";
import { Box, Typography, Paper, Tooltip, Slide } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsIcon from "@mui/icons-material/Settings";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../auth/AuthProvider";
import { getUsernameFromToken } from "../auth/jwtUtils";
import { useNavigate } from "react-router-dom";

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;

const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const PanelPage: React.FC = () => {
  const { token, clearToken } = useAuth();
  const username = getUsernameFromToken(token) || "User";
  const [hovered, setHovered] = useState<string | null>(null);
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
            maxWidth: 480,
            width: "100%",
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 2 }}>
            Hey, {username}
          </Typography>
          <Typography variant="h6" sx={{ color: "#b0c4de" }}>
            Welcome to your Blockpanel!
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default PanelPage;