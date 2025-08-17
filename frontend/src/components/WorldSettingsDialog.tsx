import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Box,
  IconButton,
  Tooltip
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SeedChangeDialog from "./SeedChangeDialog";

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
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);

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

  const handleSeedChangeSuccess = (newSeed: string) => {
    setSeed(newSeed);
    // Aktualisiere auch die parent component
    onSave({ seed: newSeed, nether_end: netherEnd, difficulty });
  };

  return (
    <>
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
            {/* Seed Anzeige mit Edit Button */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <InputLabel sx={{ color: '#b0c4de', fontSize: 14 }}>Seed</InputLabel>
                <Tooltip title="Change seed (will delete world!)">
                  <IconButton
                    size="small"
                    onClick={() => setSeedDialogOpen(true)}
                    sx={{ 
                      color: '#1976d2', 
                      p: 0.5,
                      '&:hover': { background: 'rgba(25, 118, 210, 0.08)' }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  p: 2,
                  background: 'rgba(30,40,60,0.92)',
                  borderRadius: 2,
                  border: '1px solid #334155',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  wordBreak: 'break-all',
                  cursor: 'pointer',
                  '&:hover': { background: 'rgba(40,50,70,0.92)' }
                }}
                onClick={() => setSeedDialogOpen(true)}
              >
                {seed || "(no seed set)"}
              </Box>
            </Box>

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

      {/* Seed Change Dialog */}
      <SeedChangeDialog
        open={seedDialogOpen}
        onClose={() => setSeedDialogOpen(false)}
        currentSeed={seed}
        onSuccess={handleSeedChangeSuccess}
      />
    </>
  );
};

export default WorldSettingsDialog;
