import React, { useState } from "react";
import { Box, Button, TextField, Typography, Alert, Paper } from "@mui/material";
import axios from "axios";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

const ChangeCredentialsPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { token, setToken } = useAuth();
  const navigate = useNavigate();

  const handleChange = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  setSuccess("");
  
  // Frontend-Validierung
  if (!/^[a-zA-Z0-9_]{5,20}$/.test(username)) {
    setError("Username must be 5-20 characters long and contain only letters, numbers, and underscores.");
    return;
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    setError("Password must be at least 8 characters and contain both letters and numbers.");
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    formData.append("security_question", securityQuestion);
    formData.append("security_answer", securityAnswer);

    const res = await axios.post(
      "/api/change_user",
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (res.data && res.data.access_token) {
      setToken(res.data.access_token);
    }
    setSuccess("Username, password & security question changed!");
    setTimeout(() => navigate("/panel"), 1500);
  } catch (err: any) {
    // Backend-Fehlermeldung anzeigen, falls vorhanden
    if (err.response && err.response.data && err.response.data.detail) {
      setError(err.response.data.detail);
    } else {
      setError("Change failed!");
    }
  }
};

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)",
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
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, color: "#fff" }}>
          Change Username & Password
        </Typography>
        <form onSubmit={handleChange}>
          <TextField
            label="New Username"
            fullWidth
            margin="normal"
            value={username}
            onChange={e => setUsername(e.target.value)}
            InputProps={{ sx: { color: "#fff" } }}
            InputLabelProps={{ sx: { color: "#b0c4de" } }}
          />
          <TextField
            label="New Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
            InputProps={{ sx: { color: "#fff" } }}
            InputLabelProps={{ sx: { color: "#b0c4de" } }}
          />
          <TextField
            label="Security question (e.g. Name of your first pet)"
            fullWidth
            margin="normal"
            value={securityQuestion}
            onChange={e => setSecurityQuestion(e.target.value)}
            InputProps={{ sx: { color: "#fff" } }}
            InputLabelProps={{ sx: { color: "#b0c4de" } }}
          />
          <TextField
            label="Answer to the security question"
            fullWidth
            margin="normal"
            value={securityAnswer}
            onChange={e => setSecurityAnswer(e.target.value)}
            InputProps={{ sx: { color: "#fff" } }}
            InputLabelProps={{ sx: { color: "#b0c4de" } }}
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2, py: 1.5, fontSize: 18, borderRadius: 2 }}>
            Save
          </Button>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
        </form>
      </Paper>
    </Box>
  );
};

export default ChangeCredentialsPage;