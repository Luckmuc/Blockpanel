import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, CircularProgress, Button } from "@mui/material";
// import { fetchServers } from "../api/servers";
import { getServerLog } from "../api/getServerLog";

interface ServerStatusPanelProps {
  serverName: string;
  onClose: () => void;
  token?: string | null;
}

const POLL_INTERVAL = 2000;

const ServerStatusPanel: React.FC<ServerStatusPanelProps> = ({ serverName, onClose, token }) => {
  const [log, setLog] = useState("");
  const [status, setStatus] = useState<string>("booting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        // const servers = await fetchServers(token || null);
        // const server = servers.find((s) => s.name === serverName);
        const logRes = await getServerLog(serverName, token);
        const logText = logRes.log || "";
        setLog(logText);
        setError(null);

        // Improved status logic: show "booting up" until the final Done (xx.xxs)! line
        const doneMatch = logText.match(/\[.*?\] \[Server thread\/INFO\]: Done \((\d+\.?\d*)s\)!/g);
        if (doneMatch && doneMatch.length > 0) {
          setStatus("running");
          setLoading(false);
        } else {
          setStatus("booting");
          setLoading(true);
        }
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Error loading logs or status.");
      }
      if (active && status !== "running") {
        setTimeout(poll, POLL_INTERVAL);
      }
    }
    poll();
    return () => { active = false; };
  }, [serverName, token]);

  return (
    <Box sx={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 2000,
      background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)", display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <Paper sx={{ p: 4, minWidth: 500, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", borderRadius: 4, boxShadow: 8 }}>
        <Typography variant="h5" gutterBottom>Server is starting: {serverName}</Typography>
        <Typography variant="subtitle1" color={status === "running" ? "success.main" : "warning.main"}>
          Status: {status === "running" ? "Server is running!" : "Booting up..."}
        </Typography>
        {error && (
          <Typography color="error" sx={{ my: 2 }}>{error}</Typography>
        )}
        {loading && !error && <Box sx={{ my: 2, display: "flex", alignItems: "center" }}><CircularProgress size={24} sx={{ mr: 2 }} />Waiting for server to start...</Box>}
        <Box sx={{ mt: 2, mb: 2, background: "#181f2a", color: "#b0c4de", p: 2, borderRadius: 2, fontFamily: "monospace", fontSize: 14, maxHeight: 300, overflow: "auto" }}>
          {log.split("\n").map((line, i) => <div key={i}>{line}</div>)}
        </Box>
        <Button variant="contained" color="primary" onClick={() => { console.log('Go to Panel clicked'); onClose(); }}>
          Go to Panel
        </Button>
        {error && (
          <Button variant="outlined" color="secondary" sx={{ mt: 2 }} onClick={() => window.location.reload()}>
            Retry
          </Button>
        )}
      </Paper>
    </Box>
  );
};

export default ServerStatusPanel;
