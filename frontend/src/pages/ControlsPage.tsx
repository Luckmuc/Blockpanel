import React, { useState, useEffect } from 'react';
import { Paper, Typography, CircularProgress, Box, Tooltip, Slide } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import StorageIcon from "@mui/icons-material/Storage";
import ExtensionIcon from "@mui/icons-material/Extension";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { fetchServers } from "../api/servers";
import type { Server } from "../types/server";
import { useAuth } from "../auth/AuthProvider";

const ControlsPage: React.FC = () => {
  // Sidebar states
  const SIDEBAR_WIDTH = 72;
  const SIDEBAR_EXPANDED = 200;
  const [hovered, setHovered] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const menuItems = [
    { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
    { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
    { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
  ];

  // Server State
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const { token: rawToken } = useAuth();
  const token = rawToken ?? undefined;
  useEffect(() => {
    setLoading(true);
    fetchServers(token)
      .then(setServers)
      .catch(() => setError("Could not load servers."))
      .finally(() => setLoading(false));
  }, [token]);

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
              // onClick={handleLogout} // Logout-Logik ggf. später ergänzen
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
          elevation={8}
          sx={{
            p: 5,
            borderRadius: 4,
            background: "#1e293c",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            minWidth: 400,
            maxWidth: 600,
            width: "100%",
            textAlign: "center",
          }}
        >
          <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700, mb: 2 }}>
            Choose the server from which you want to change the controls
          </Typography>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography color="error" sx={{ mt: 4 }}>{error}</Typography>
          ) : servers.length === 0 ? (
            <Typography sx={{ color: "#b0c4de", fontSize: 18, mt: 2 }}>No servers found.</Typography>
          ) : (
            <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
              {servers.map(server => (
                <Paper
                  key={server.name}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: "rgba(30,40,60,0.96)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px 0 rgba(25, 118, 210, 0.10)",
                    transition: "background 0.2s",
                    '&:hover': { background: "#26334d" },
                  }}
                  onClick={() => navigate(`/servers/${server.name}/controls`)}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: 17 }}>{server.name}</Typography>
                  <Typography sx={{ color: "#b0c4de", fontSize: 14 }}>{server.address}</Typography>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default ControlsPage;
