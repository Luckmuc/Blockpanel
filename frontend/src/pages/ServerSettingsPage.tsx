import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from "@mui/material";
import { deleteServer } from "../api/servers";
import { useAuth } from "../auth/AuthProvider";

const ServerSettingsPage: React.FC = () => {
  const { servername } = useParams<{ servername: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteServer(servername ?? "", token || undefined);
      setDeleting(false);
      setConfirmOpen(false);
      navigate("/servers");
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to delete server.");
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)" }}>
      <Paper sx={{ p: 5, borderRadius: 4, minWidth: 400, maxWidth: 600 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>Server Settings: {servername}</Typography>
        {/* Example settings, can be expanded */}
        <Box sx={{ mb: 3 }}>
          <TextField label="Max Players" type="number" size="small" sx={{ mb: 2, minWidth: 200 }} />
          <TextField label="RAM (MB)" type="number" size="small" sx={{ mb: 2, minWidth: 200 }} />
          <Button variant="outlined" sx={{ mb: 2 }}>
            Assign Admins (coming soon)
          </Button>
        </Box>
        <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)} sx={{ mt: 2 }}>
          Delete Server
        </Button>
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to delete this server? This action cannot be undone.</Typography>
            {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
};

export default ServerSettingsPage;
