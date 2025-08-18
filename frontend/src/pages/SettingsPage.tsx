import React, { useState } from "react";
import { Box, Typography, Paper, Tooltip, Slide, TextField, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, InputAdornment } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsIcon from "@mui/icons-material/Settings";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import LogoutIcon from "@mui/icons-material/Logout";
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from "../auth/AuthProvider";
import { getUsernameFromToken } from "../auth/jwtUtils";
import { useNotification } from "../components/NotificationProvider";
import { useNavigate } from "react-router-dom";

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;

const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const SettingsPage: React.FC = () => {
  const { token, clearToken } = useAuth();
  const { notify } = useNotification();
  const [showPasswords, setShowPasswords] = useState(false);
  const [fieldHover, setFieldHover] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();
  const currentUsername = getUsernameFromToken(token) || "User";

  // Password change states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Username change states
  const [newUsername, setNewUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [usernameConfirmDialog, setUsernameConfirmDialog] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const formData = new FormData();
      formData.append("old_password", oldPassword);
      formData.append("new_password", newPassword);

      const response = await fetch("/api/change_password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error changing password");
      }

      setPasswordSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Notify the user and then log them out so they can re-login with new credentials
      notify({ type: 'success', message: 'Password changed successfully. Please log in with your new credentials.' });
      // Small delay so the user can briefly see the success state before redirect
      setTimeout(() => {
        clearToken();
        navigate('/login');
      }, 800);
    } catch (error: any) {
      setPasswordError(error.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUsernameChange = async () => {
    if (newUsername.length < 5) {
      setUsernameError("Username must be at least 5 characters long");
      return;
    }

    setUsernameLoading(true);
    setUsernameError(null);

    try {
      const formData = new FormData();
      formData.append("new_username", newUsername);

      const response = await fetch("/api/change_username", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error changing username");
      }

      setUsernameSuccess(true);
      setNewUsername("");
      setUsernameConfirmDialog(false);
      setTimeout(() => {
        setUsernameSuccess(false);
        // After username change, logout as the token becomes invalid
        clearToken();
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      setUsernameError(error.message);
    } finally {
      setUsernameLoading(false);
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
                '&:hover': { background: "rgba(25, 118, 210, 0.15)" },
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
          p: 3,
        }}
      >
        <Box sx={{ maxWidth: 600, width: "100%" }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 4, textAlign: "center" }}>
            Account Settings
          </Typography>

          {/* Current User Info */}
          <Paper
            elevation={10}
            sx={{
              p: 3,
              borderRadius: 4,
              background: "rgba(30,40,60,0.92)",
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
              mb: 3,
            }}
          >
            <Typography variant="h6" sx={{ color: "#fff", mb: 1 }}>
              Current User
            </Typography>
            <Typography variant="body1" sx={{ color: "#b0c4de" }}>
              {currentUsername}
            </Typography>
          </Paper>

          {/* Password Change Form */}
          <Paper
            elevation={10}
            sx={{
              p: 4,
              borderRadius: 4,
              background: "rgba(30,40,60,0.92)",
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
              mb: 3,
            }}
          >
            <Typography variant="h6" sx={{ color: "#fff", mb: 3 }}>
              Change Password
            </Typography>
            {passwordSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Password changed successfully!
              </Alert>
            )}
            {passwordError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {passwordError}
              </Alert>
            )}
            <TextField
              fullWidth
              type={showPasswords ? "text" : "password"}
              label="Old Password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              onMouseEnter={() => setFieldHover('old')}
              onMouseLeave={() => setFieldHover(null)}
              sx={{ 
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "#b0c4de" },
                  "&:hover fieldset": { borderColor: "#1976d2" },
                  "&.Mui-focused fieldset": { borderColor: "#1976d2" },
                },
              }}
              InputProps={{
                style: { color: "#fff" },
                endAdornment: (
                  fieldHover === 'old' ? (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPasswords ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPasswords((s) => !s)}
                        edge="end"
                        sx={{ color: '#b0c4de' }}
                      >
                        {showPasswords ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ) : null
                ),
              }}
              InputLabelProps={{
                style: { color: "#b0c4de" },
              }}
            />
            <TextField
              fullWidth
              type={showPasswords ? "text" : "password"}
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onMouseEnter={() => setFieldHover('new')}
              onMouseLeave={() => setFieldHover(null)}
              sx={{ 
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "#b0c4de" },
                  "&:hover fieldset": { borderColor: "#1976d2" },
                  "&.Mui-focused fieldset": { borderColor: "#1976d2" },
                },
              }}
              InputProps={{
                style: { color: "#fff" },
                endAdornment: (
                  fieldHover === 'new' ? (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPasswords ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPasswords((s) => !s)}
                        edge="end"
                        sx={{ color: '#b0c4de' }}
                      >
                        {showPasswords ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ) : null
                ),
              }}
              InputLabelProps={{
                style: { color: "#b0c4de" },
              }}
            />
            <TextField
              fullWidth
              type={showPasswords ? "text" : "password"}
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onMouseEnter={() => setFieldHover('confirm')}
              onMouseLeave={() => setFieldHover(null)}
              sx={{ 
                mb: 3,
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "#b0c4de" },
                  "&:hover fieldset": { borderColor: "#1976d2" },
                  "&.Mui-focused fieldset": { borderColor: "#1976d2" },
                },
              }}
              InputProps={{
                style: { color: "#fff" },
                endAdornment: (
                  fieldHover === 'confirm' ? (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPasswords ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPasswords((s) => !s)}
                        edge="end"
                        sx={{ color: '#b0c4de' }}
                      >
                        {showPasswords ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ) : null
                ),
              }}
              InputLabelProps={{
                style: { color: "#b0c4de" },
              }}
            />
            <Button
              variant="contained"
              onClick={handlePasswordChange}
              disabled={passwordLoading || !oldPassword || !newPassword || !confirmPassword}
              sx={{
                bgcolor: "#1976d2",
                "&:hover": { bgcolor: "#1565c0" },
                "&:disabled": { bgcolor: "rgba(255,255,255,0.12)" },
              }}
            >
              {passwordLoading ? "Changing..." : "Change Password"}
            </Button>
          </Paper>

          {/* Username Change Form */}
          <Paper
            elevation={10}
            sx={{
              p: 4,
              borderRadius: 4,
              background: "rgba(30,40,60,0.92)",
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            }}
          >
            <Typography variant="h6" sx={{ color: "#fff", mb: 3 }}>
              Change Username
            </Typography>
            {usernameSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Username changed successfully! You will be logged out automatically.
              </Alert>
            )}
            {usernameError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {usernameError}
              </Alert>
            )}
            <TextField
              fullWidth
              label="New Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              sx={{ 
                mb: 3,
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "#b0c4de" },
                  "&:hover fieldset": { borderColor: "#1976d2" },
                  "&.Mui-focused fieldset": { borderColor: "#1976d2" },
                },
              }}
              InputProps={{
                style: { color: "#fff" },
              }}
              InputLabelProps={{
                style: { color: "#b0c4de" },
              }}
              helperText="At least 5 characters, only letters, numbers and underscores"
              FormHelperTextProps={{
                style: { color: "#b0c4de" },
              }}
            />
            <Button
              variant="contained"
              onClick={() => setUsernameConfirmDialog(true)}
              disabled={usernameLoading || !newUsername || newUsername.length < 5}
              sx={{
                bgcolor: "#f57c00",
                "&:hover": { bgcolor: "#ef6c00" },
                "&:disabled": { bgcolor: "rgba(255,255,255,0.12)" },
              }}
            >
              Change Username
            </Button>
          </Paper>

          {/* Username Confirm Dialog */}
          <Dialog
            open={usernameConfirmDialog}
            onClose={() => setUsernameConfirmDialog(false)}
            PaperProps={{
              sx: {
                background: "rgba(30,40,60,0.95)",
                color: "#fff",
              },
            }}
          >
            <DialogTitle sx={{ color: "#fff" }}>
              Confirm Username Change
            </DialogTitle>
            <DialogContent>
              <Typography sx={{ color: "#b0c4de" }}>
                Do you really want to change your username from "{currentUsername}" to "{newUsername}"?
              </Typography>
              <Typography sx={{ color: "#f44336", mt: 2, fontSize: "0.875rem" }}>
                Warning: After the change, you will be automatically logged out and must log in with the new username.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setUsernameConfirmDialog(false)}
                sx={{ color: "#b0c4de" }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUsernameChange}
                disabled={usernameLoading}
                sx={{
                  bgcolor: "#f57c00",
                  color: "#fff",
                  "&:hover": { bgcolor: "#ef6c00" },
                  "&:disabled": { bgcolor: "rgba(255,255,255,0.12)" },
                }}
              >
                {usernameLoading ? "Changing..." : "Confirm"}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Box>
    </Box>
  );
};

export default SettingsPage;
