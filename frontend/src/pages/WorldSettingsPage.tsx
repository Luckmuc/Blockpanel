import React, { useState } from "react";
import { useParams } from "react-router-dom";
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

const WorldSettingsPage: React.FC = () => {
  const { servername } = useParams<{ servername: string }>();
  const [seed, setSeed] = useState("");
  const [netherEnd, setNetherEnd] = useState(false);
  const [difficulty, setDifficulty] = useState("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      await fetch(`/api/server/properties/set-nether`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ servername, allow: netherEnd ? "true" : "false" })
      });
      await fetch(`/api/server/properties/set`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ servername, key: "allow-end", value: netherEnd ? "true" : "false" })
      });
      await fetch(`/api/server/properties/set-difficulty`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ servername, difficulty })
      });
      setSuccess(true);
    } catch (e) {
      setError("Failed to save world settings.");
    }
    setLoading(false);
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)" }}>
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
    </Box>
  );
};

export default WorldSettingsPage;
