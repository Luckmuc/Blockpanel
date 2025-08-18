import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Box, Paper, TextField, Button, Typography, Tooltip, Slide, Dialog, Snackbar, Alert } from "@mui/material";
import { Suspense } from 'react';
import ClearIcon from "@mui/icons-material/Clear";
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
// content copy icon used in docs is inside the lazy component
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StorageIcon from "@mui/icons-material/Storage";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { API_BASE } from "../config/api";
const LazyConsoleDocs = React.lazy(() => import('../components/ConsoleDocs'));

type HistoryEntry = { type: "cmd" | "out" | "err" | "info"; text: string; time: number };

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;

const menuItems = [
  { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
  { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
  { key: "controls", label: "Controls", icon: <TuneIcon fontSize="large" /> },
];

const ServerConsolePage: React.FC = () => {
  const { servername } = useParams<{ servername: string }>();
  const navigate = useNavigate();
  const auth: any = useAuth();

  const [hovered, setHovered] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastOutputRef = useRef<string>("");
  const pollingRef = useRef<number | null>(null);
  const [serverRunning, setServerRunning] = useState<boolean | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);

  const copyExamples = async () => {
    const examples = `say Hello everyone\nseed\nstop\nsave-all\nkick <player>\nban <player>\nop <player>\ndeop <player>\nwhitelist add <player>`;
    try {
      await navigator.clipboard.writeText(examples);
      setSnackMsg('Examples copied to clipboard');
      setSnackOpen(true);
    } catch (e) {
      setSnackMsg('Copy failed');
      setSnackOpen(true);
    }
  };

  useEffect(() => {
    const el = document.getElementById("serverconsole-cli-input") as HTMLInputElement | null;
    el?.focus();
  }, []);

  // keyboard shortcut: Ctrl/Cmd+K to focus input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac && e.metaKey && e.key.toLowerCase() === 'k') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        const el = document.getElementById('serverconsole-cli-input') as HTMLInputElement | null;
        el?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history]);

  const push = useCallback((entry: HistoryEntry) => {
    setHistory((h) => [...h, entry]);
  }, []);

  const clearHistory = () => {
    setHistory([]);
    lastOutputRef.current = "";
  };

  const sendCommand = async (cmd: string) => {
    if (!servername) return push({ type: "err", text: "Kein Server ausgewählt.", time: Date.now() });
    setSending(true);
    push({ type: "cmd", text: `/${cmd}`, time: Date.now() });
    try {
      const form = new FormData();
      form.append("servername", servername);
      form.append("command", cmd);

      const headers: Record<string, string> = {};
      const token = auth?.token;
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/server/command`, {
        method: "POST",
        headers,
        body: form,
      });

      const data = await res.json().catch(() => ({ error: "No JSON response" }));
      if (!res.ok) {
        push({ type: "err", text: data?.detail || data?.error || `HTTP ${res.status}`, time: Date.now() });
      } else {
        // Show a small confirmation
        setSnackMsg('Command sent');
        setSnackOpen(true);

        // If backend returned immediate console output lines, show them (deduplicate against lastOutputRef)
        if (data && Array.isArray(data.outputLines)) {
          // normalize and remove empty/whitespace-only lines
          let lines: string[] = data.outputLines.map((l: any) => String(l)).map((s: string) => s.replace(/\r/g, ''))
            .filter((s: string) => s && s.trim() !== '');

          if (lines.length > 0) {
            const lastText = lastOutputRef.current || "";
            const lastLines = lastText ? lastText.split(/\r?\n/).filter(Boolean) : [];

            // find largest overlap where tail of lastLines matches head of lines
            let overlap = 0;
            const maxCheck = Math.min(lastLines.length, lines.length);
            for (let k = maxCheck; k > 0; k--) {
              const tail = lastLines.slice(-k).join('\n');
              const head = lines.slice(0, k).join('\n');
              if (tail === head) { overlap = k; break; }
            }

            const newLines = lines.slice(overlap);
            newLines.forEach((ln) => push({ type: 'out', text: ln, time: Date.now() }));

            // update lastOutputRef to include these lines so polling won't duplicate
            const merged = lastLines.concat(lines.slice(overlap)).join('\n');
            lastOutputRef.current = merged;
          }
        }
      }
    } catch (e: any) {
      push({ type: "err", text: e?.message || "Fehler beim Senden des Befehls", time: Date.now() });
    } finally {
      setSending(false);
    }
  };

  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    await sendCommand(cmd);
    setInput("");
  };

  // Polling for console output
  const fetchOutput = useCallback(async () => {
    if (!servername) return;
    if (serverRunning === false) return; // don't fetch if server is known to be stopped
    try {
      const token = auth?.token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/server/command/output?servername=${encodeURIComponent(servername)}&lines=200`, { headers });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data || typeof data.output !== "string") return;
      const text: string = data.output;

      // If nothing changed, skip
      if (text === lastOutputRef.current) return;

      const oldLines = lastOutputRef.current ? lastOutputRef.current.split(/\r?\n/) : [];
      const newLines = text.split(/\r?\n/);

      let appended: string[] = [];
      if (oldLines.length && text.startsWith(lastOutputRef.current)) {
        appended = newLines.slice(oldLines.length);
      } else {
        // Not a simple append — show last lines as a block
        appended = newLines;
      }

      appended.forEach((ln) => {
        if (ln && ln.trim() !== "") push({ type: "out", text: ln, time: Date.now() });
      });

      lastOutputRef.current = text;
    } catch (e) {
      // ignore polling errors silently
    }
  }, [servername, auth, push, serverRunning]);

  // Poll status + output
  useEffect(() => {
    if (!servername) return;

    const fetchStatusAndMaybeOutput = async () => {
      try {
        const token = auth?.token;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const sres = await fetch(`${API_BASE}/server/status?servername=${encodeURIComponent(servername)}`, { headers });
        if (!sres.ok) {
          setServerRunning(null);
        } else {
          const sdata = await sres.json().catch(() => null);
          const isRunning = sdata && sdata.status === "running";
          setServerRunning(isRunning);
          if (!isRunning) {
            // clear history when server is not running
            setHistory([]);
            lastOutputRef.current = "";
            return;
          }
        }

        // If running, fetch output
        await fetchOutput();
      } catch (e) {
        // ignore
      }
    };

    // initial
    fetchStatusAndMaybeOutput();
    const id = window.setInterval(fetchStatusAndMaybeOutput, 1500);
    pollingRef.current = id;
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [servername, auth, fetchOutput]);

  return (
    <Box sx={{ minHeight: "100vh", width: "100vw", display: "flex", background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)" }}>
      {/* Sidebar (copied style) */}
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
        onMouseLeave={() => setHovered(undefined)}
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
            <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1.5, cursor: "pointer", color: hovered === "settings" ? "#1976d2" : "#fff", background: hovered === "settings" ? "rgba(25, 118, 210, 0.08)" : undefined, borderRadius: 2, mb: 1, transition: "background 0.2s, color 0.2s", '&:hover': { background: "rgba(255,255,255,0.08)" } }} onMouseEnter={() => setHovered("settings")} onClick={() => navigate("/settings")}>
              <SettingsIcon fontSize="large" />
              <Slide direction="right" in={hovered === "settings"} mountOnEnter unmountOnExit>
                <Typography sx={{ ml: 2, fontWeight: 600, color: "#b0c4de", whiteSpace: "nowrap" }}>Settings</Typography>
              </Slide>
            </Box>
          </Tooltip>
          <Tooltip title="Logout" placement="right">
            <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1.5, cursor: "pointer", color: hovered === "logout" ? "#f44336" : "#fff", background: hovered === "logout" ? "rgba(244, 67, 54, 0.08)" : undefined, borderRadius: 2, transition: "background 0.2s, color 0.2s", '&:hover': { background: "rgba(255,255,255,0.08)" } }} onMouseEnter={() => setHovered("logout")} onClick={() => { auth?.clearToken?.(); navigate('/login'); }}>
              <LogoutIcon fontSize="large" />
              <Slide direction="right" in={hovered === "logout"} mountOnEnter unmountOnExit>
                <Typography sx={{ ml: 2, fontWeight: 600, color: "#f44336", whiteSpace: "nowrap" }}>Logout</Typography>
              </Slide>
            </Box>
          </Tooltip>
        </Box>
      </Box>

      {/* Main Content: Console */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {/* Back button next to sidebar */}
        <Box sx={{ position: "absolute", left: hovered ? SIDEBAR_EXPANDED + 12 : SIDEBAR_WIDTH + 12, top: 12 }}>
          <Button
            onClick={() => navigate('/servers')}
            aria-label="back-to-servers"
            startIcon={<ArrowBackIosNewIcon />}
            sx={{
              color: '#90caf9',
              background: 'rgba(9,20,30,0.35)',
              border: '1px solid rgba(144,202,249,0.24)',
              borderRadius: 2,
              px: 2,
              py: 0.8,
              fontWeight: 700,
              letterSpacing: 0.8,
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              textTransform: 'none'
            }}
          >
            Back
          </Button>
        </Box>
        <Paper elevation={10} sx={{ p: 3, borderRadius: 4, background: "rgba(30,40,60,0.92)", boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)", maxWidth: 1000, width: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Typography variant="h6">Server Console — {servername}</Typography>
            <Button startIcon={<ClearIcon />} onClick={clearHistory} sx={{ ml: "auto" }}>
              Clear history
            </Button>
            <Button sx={{ ml: 1 }} onClick={() => setDocsOpen(true)}>Docs</Button>
          </Box>

          <Paper
            sx={{
              height: 520,
              overflow: "auto",
              p: 1,
              background: "rgba(0,0,0,0.45)",
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
              backdropFilter: "blur(6px)",
            }}
            ref={listRef as any}
          >
            {history.length === 0 && (
              <Typography sx={{ color: "#ccc", p: 1 }}>{serverRunning === false ? "Server is not running." : "Type a command and press Enter (e.g. say Hello, seed, kick <name>)."}</Typography>
            )}
            {history.map((h, i) => (
              <Box key={i} sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap", color: h.type === "err" ? "#ff8a80" : h.type === "cmd" ? "#80d8ff" : "#ddd", mb: 0.5 }}>
                <Typography variant="body2">{new Date(h.time).toLocaleTimeString()} {h.type === "cmd" ? ">" : ""} {h.text}</Typography>
              </Box>
            ))}
          </Paper>

          <Box component="form" onSubmit={onSubmit} sx={{ display: "flex", gap: 1, mt: 1 }}>
            <TextField
              id="serverconsole-cli-input"
              placeholder="Enter command, e.g. say Hello"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ spellCheck: "false", autoCapitalize: "off" }}
              sx={{
                input: { color: '#fff', fontFamily: 'monospace' },
                '.MuiInputBase-root': { background: 'rgba(255,255,255,0.03)', borderRadius: 1 }
              }}
            />
            <Button type="submit" variant="contained" startIcon={<PlayArrowIcon />} disabled={sending || serverRunning === false}>
              Send
            </Button>
          </Box>

          <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#666" }}>
            Note: This frontend sends POST /server/command and polls /server/command/output for live logs.
          </Typography>
          <Dialog open={docsOpen} onClose={() => setDocsOpen(false)} maxWidth="sm" fullWidth>
            <Suspense>
              <LazyConsoleDocs onClose={() => setDocsOpen(false)} copyExamples={copyExamples} />
            </Suspense>
          </Dialog>
          <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)}>
            <Alert onClose={() => setSnackOpen(false)} severity={snackMsg === 'Copy failed' ? 'error' : 'success'} sx={{ width: '100%' }}>
              {snackMsg}
            </Alert>
          </Snackbar>
        </Paper>
      </Box>
    </Box>
  );
};

export default ServerConsolePage;