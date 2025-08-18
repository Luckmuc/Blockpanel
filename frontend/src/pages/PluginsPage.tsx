import React, { useState } from "react";
// Removed unused useAuth import
import { Box, Typography, Tooltip, Slide } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;

const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const PluginsPage: React.FC = () => {
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();
  // Removed token, not needed for upload here

  // Upload-Logik
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [uploadError, setUploadError] = useState<any>(null);
  // Removed server selection state
  const fileInputRef = React.useRef<any>(null);

  // Removed server fetching effect

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.name.endsWith('.jar')) {
      setUploadError('Only .jar files are allowed!');
      setSelectedFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large (max. 10MB)!');
      setSelectedFile(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    // Datei als ArrayBuffer speichern
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileBuffer(e.target?.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  }

  const uploadPlugin = useCallback(() => {
    setUploadError(null);
    if (!selectedFile || !fileBuffer) return;
    // Nach Upload auf neue Seite navigieren und Datei im State übergeben
    navigate("/plugins/choose-server", {
      state: {
        file: selectedFile,
        fileBuffer,
      },
    });
  }, [navigate, selectedFile, fileBuffer]);

  // Removed distributePlugin function

  // Removed showRestartPrompt state

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
        <Box
          sx={{
            background: "#18233a",
            borderRadius: 6,
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.25)",
            px: 5,
            py: 5,
            minWidth: 350,
            maxWidth: 420,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography variant="h4" sx={{ color: "#fff", fontWeight: 700, mb: 3, textAlign: 'center' }}>
            Upload Plugins
          </Typography>
          {/* Server-Auswahl entfernt, stattdessen nach Upload Checkbox-Liste */}
          <Box
            sx={{
              border: "2px dashed #1976d2",
              borderRadius: 4,
              p: 4,
              background: "rgba(25, 118, 210, 0.10)",
              textAlign: "center",
              color: "#b0c4de",
              cursor: "pointer",
              transition: "background 0.2s",
              width: '100%',
              '&:hover': { background: "rgba(25, 118, 210, 0.18)" },
            }}
            onDrop={e => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <Typography variant="body1" sx={{ mb: 1, color: '#b0c4de', fontWeight: 500 }}>
              Drag and drop your <b>.jar</b> file here or click to select (max. 10MB)
            </Typography>
            <input
              type="file"
              accept=".jar"
              multiple={false}
              style={{ display: "none" }}
              ref={fileInputRef}
              onChange={e => handleFiles(e.target.files)}
            />
          </Box>
          {selectedFile && (
            <Box sx={{ mt: 3, color: '#fff', textAlign: 'center', width: '100%' }}>
              <Typography>
                <b>File:</b> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
              {uploadError && <Typography color="error">{typeof uploadError === 'string' ? uploadError : (uploadError.message || JSON.stringify(uploadError))}</Typography>}
              <Box sx={{ mt: 2 }}>
                <button
                  style={{
                    background: '#1976d2', color: '#fff', border: 'none', borderRadius: 5, padding: '10px 28px', fontWeight: 700, cursor: 'pointer', fontSize: 17, letterSpacing: 0.5, boxShadow: '0 2px 8px 0 rgba(25, 118, 210, 0.10)'
                  }}
                  onClick={uploadPlugin}
                  // No uploading state, always enabled
                >
                  Upload
                </button>
              </Box>
            </Box>
          )}
          {/* Server selection removed. After upload, user is redirected to ChooseServerPage. */}
          {/* Keine Server-Auswahl oder Label mehr vor dem Upload */}
        </Box>
      </Box>
    </Box>
  );
};

export default PluginsPage;
