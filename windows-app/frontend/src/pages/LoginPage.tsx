import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Paper } from '@mui/material';
import axios from 'axios';
import { useAuth } from '../auth/AuthProvider';
import { useNavigate, Link } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setToken } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post(
        '/api/login',
        new URLSearchParams({ username, password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      console.log("Full axios response:", res);
      console.log("res.data:", res.data);
      if (res.data && res.data.access_token) {
        setToken(res.data.access_token);
        console.log("Token in localStorage after setToken:", localStorage.getItem('token'));
        if (res.data.must_change) {
          navigate('/change-credentials');
        } else {
          navigate('/panel');
        }
      } else {
        setError('Login failed: No token received!');
        console.log("No token received! res.data:", res.data);
      }
    } catch (err: any) {
      setError('Login failed!');
      console.error("Login error:", err);
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
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: "#fff" }}>
          Login
        </Typography>
        <form onSubmit={handleLogin}>
          <TextField
            label="Username"
            fullWidth
            margin="normal"
            value={username}
            onChange={e => setUsername(e.target.value)}
            InputProps={{ sx: { color: "#fff" } }}
            InputLabelProps={{ sx: { color: "#b0c4de" } }}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
            InputProps={{ sx: { color: "#fff" } }}
            InputLabelProps={{ sx: { color: "#b0c4de" } }}
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2, py: 1.5, fontSize: 18, borderRadius: 2 }}>
            Login
          </Button>
          <Box sx={{ mt: 2 }}>
            <Link to="/forgot-password" style={{ color: '#b0c4de', textDecoration: 'underline', fontSize: 15 }}>
              Forgot password?
            </Link>
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </form>
      </Paper>
    </Box>
  );
};

export default LoginPage;