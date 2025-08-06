import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Box
} from "@mui/material";

interface WorldSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  seed: string;
  nether_end: boolean;
  difficulty: string;
  onSave: (settings: { seed: string; nether_end: boolean; difficulty: string }) => void;
}

const difficulties = ["easy", "normal", "peaceful", "hard"];

const WorldSettingsDialog: React.FC<WorldSettingsDialogProps> = ({
  open,
  onClose,
  seed: initialSeed,
  nether_end: initialNetherEnd,
  difficulty: initialDifficulty,
  onSave
}) => {
  const [seed, setSeed] = useState(initialSeed);
  const [netherEnd, setNetherEnd] = useState(initialNetherEnd);
  const [difficulty, setDifficulty] = useState(initialDifficulty);

  React.useEffect(() => {
    setSeed(initialSeed);
    setNetherEnd(initialNetherEnd);
    setDifficulty(initialDifficulty);
  }, [initialSeed, initialNetherEnd, initialDifficulty, open]);

  const { servername } = useParams<{ servername: string }>();

  const handleSave = async () => {
    if (!servername) return;
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: token ? `Bearer ${token}` : ""
    };
    try {
      // Seed setzen
      await fetch(`/api/server/properties/set-seed`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ servername, seed })
      });
      // Nether und End gemeinsam setzen
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
      // Difficulty setzen
      await fetch(`/api/server/properties/set-difficulty`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ servername, difficulty })
      });
    } catch (e) {
      // Fehlerbehandlung kann hier ergänzt werden
    }
    onSave({ seed, nether_end: netherEnd, difficulty });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: '#1e293c',
          color: '#fff',
          borderRadius: 3,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          minWidth: 400,
          p: 2,
        },
      }}
    >
      <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>World Settings</DialogTitle>
      <DialogContent>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: '#b0c4de' }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ fontWeight: 600, minWidth: 100 }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorldSettingsDialog;
