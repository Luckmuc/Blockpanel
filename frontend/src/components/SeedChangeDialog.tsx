import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  AlertTitle,
  Checkbox,
  FormControlLabel
} from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";

interface SeedChangeDialogProps {
  open: boolean;
  onClose: () => void;
  currentSeed: string;
  onSuccess: (newSeed: string) => void;
}

const SeedChangeDialog: React.FC<SeedChangeDialogProps> = ({
  open,
  onClose,
  currentSeed,
  onSuccess
}) => {
  const [newSeed, setNewSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [confirmReset, setConfirmReset] = useState(false);
  const { servername } = useParams<{ servername: string }>();

  const handleClose = () => {
    setNewSeed("");
    setConfirmReset(false);
    setError(undefined);
    onClose();
  };

  const handleSeedChange = async () => {
    if (!servername || !newSeed.trim()) return;
    if (!confirmReset) {
      setError("You must confirm that you understand the world will be deleted.");
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: token ? `Bearer ${token}` : ""
      };

      // Verwende die neue API mit World-Reset
      const response = await fetch(`/api/server/properties/set-seed-with-world-reset`, {
        method: "POST",
        headers,
        body: new URLSearchParams({ 
          servername, 
          seed: newSeed.trim() 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error setting seed");
      }

      const result = await response.json();
      console.log("Seed successfully changed:", result);
      
      onSuccess(newSeed.trim());
      handleClose();
    } catch (e) {
      console.error("Error changing seed:", e);
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: '#1e293c',
          color: '#fff',
          borderRadius: 3,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          minWidth: 500,
          p: 2,
        },
      }}
    >
      <DialogTitle sx={{ color: '#fff', fontWeight: 700, fontSize: 24, display: 'flex', alignItems: 'center', gap: 2 }}>
        <WarningIcon sx={{ color: '#ff9800', fontSize: 28 }} />
        Change Seed and Reset World
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          {/* Warnung */}
          <Alert 
            severity="warning" 
            sx={{ 
              background: 'rgba(255, 152, 0, 0.1)', 
              border: '1px solid #ff9800',
              '& .MuiAlert-icon': { color: '#ff9800' },
              '& .MuiAlert-message': { color: '#fff' }
            }}
          >
            <AlertTitle sx={{ color: '#ff9800', fontWeight: 600 }}>WARNING!</AlertTitle>
            Changing the seed will <strong>permanently delete all existing world data</strong>:
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Main world (world)</li>
              <li>Nether (world_nether)</li>
              <li>End (world_the_end)</li>
            </ul>
            <strong>This action cannot be undone!</strong>
          </Alert>

          {/* Aktueller Seed */}
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#b0c4de', mb: 1 }}>
              Current Seed:
            </Typography>
            <Typography 
              sx={{ 
                background: 'rgba(30,40,60,0.92)', 
                p: 2, 
                borderRadius: 2, 
                fontFamily: 'monospace',
                color: '#fff',
                wordBreak: 'break-all'
              }}
            >
              {currentSeed || "(no seed set)"}
            </Typography>
          </Box>

          {/* Neuer Seed */}
          <TextField
            label="New Seed"
            value={newSeed}
            onChange={e => setNewSeed(e.target.value)}
            fullWidth
            variant="outlined"
            placeholder="Leave empty for random seed"
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
              '& .MuiInputBase-input::placeholder': {
                color: '#64748b',
                opacity: 1,
              },
            }}
            InputLabelProps={{ style: { color: '#b0c4de' } }}
          />

          {/* Bestätigung */}
          <FormControlLabel
            control={
              <Checkbox 
                checked={confirmReset} 
                onChange={e => setConfirmReset(e.target.checked)}
                sx={{ color: '#ff9800' }}
              />
            }
            label={
              <Typography sx={{ color: '#b0c4de' }}>
                I understand that the existing world will be <strong>completely deleted</strong> and cannot be restored.
              </Typography>
            }
          />

          {/* Fehler */}
          {error && (
            <Alert 
              severity="error"
              sx={{
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid #f44336',
                '& .MuiAlert-icon': { color: '#f44336' },
                '& .MuiAlert-message': { color: '#fff' }
              }}
            >
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ gap: 2, px: 3, pb: 2 }}>
        <Button 
          onClick={handleClose} 
          sx={{ color: '#b0c4de' }}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSeedChange} 
          variant="contained" 
          disabled={!confirmReset || loading}
          sx={{ 
            fontWeight: 600, 
            minWidth: 120,
            background: '#ff9800',
            '&:hover': { background: '#f57c00' },
            '&:disabled': { background: '#424242' }
          }}
        >
          {loading ? "Changing..." : "Change Seed"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SeedChangeDialog;
