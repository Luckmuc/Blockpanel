import React, { useEffect, useState } from "react";
import { useNotification } from "../components/NotificationProvider";
import WorldSettingsDialog from "../components/WorldSettingsDialog";
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
  Box,
  Typography,
  Paper,
  Tooltip,
  Slide,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsIcon from "@mui/icons-material/Settings";
import ExtensionIcon from "@mui/icons-material/Extension";
import TuneIcon from "@mui/icons-material/Tune";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../auth/AuthProvider";

type NameUUID = { name: string; uuid: string };

type RightsSettings = {
  admins: string;
  adminsUUIDs: NameUUID[];
  gamemode: string;
  cheats: boolean;
};

type ServerSettings = {
  listType: "none" | "whitelist" | "blacklist" | string;
  banUUIDs: NameUUID[];
  kickUUIDs: NameUUID[];
};

type WorldSettings = {
  seed: string;
  nether_end: boolean;
  difficulty: "peaceful" | "easy" | "normal" | "hard" | string;
};

const SIDEBAR_WIDTH = 72;
const SIDEBAR_EXPANDED = 200;

const ServerControlsPage: React.FC = () => {
  const { servername: p } = useParams<{ servername?: string }>();
  const servername = p || "";
  const notification: any = useNotification(); // any, weil Hook unterschiedliche Shapes haben kann
  const navigate = useNavigate();
  const auth: any = useAuth(); // any, weil AuthContext unterschiedlich typed sein kann

  // Wrapper: vereinheitlicht Notification-API (callable | .notify | .push)
  const notify = (payload: { type: "success" | "error" | "info" | string; message: string }) => {
    try {
      if (typeof notification === "function") {
        notification(payload);
      } else if (notification && typeof notification.notify === "function") {
        notification.notify(payload);
      } else if (notification && typeof notification.push === "function") {
        notification.push(payload);
      } else {
        // Fallback
        // eslint-disable-next-line no-console
        console.log("notify:", payload);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Notification failed:", e);
    }
  };

  // UI states
  const [hovered, setHovered] = useState<string | null>(null);
  const [worldDialogOpen, setWorldDialogOpen] = useState(false);
  const [rightsDialogOpen, setRightsDialogOpen] = useState(false);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);

  // Rights states
  const [rightsSettings, setRightsSettings] = useState<RightsSettings>({
    admins: "",
    adminsUUIDs: [],
    gamemode: "survival",
    cheats: false,
  });
  const [adminInput, setAdminInput] = useState("");
  const [adminLookupError, setAdminLookupError] = useState<string | null>(null);
  const [rightsSaving, setRightsSaving] = useState(false);
  const [rightsError, setRightsError] = useState<string | null>(null);

  // Server states
  const [serverSettings, setServerSettings] = useState<ServerSettings>({
    listType: "none",
    banUUIDs: [],
    kickUUIDs: [],
  });
  const [banInput, setBanInput] = useState("");
  const [banLookupError, setBanLookupError] = useState<string | null>(null);
  const [kickInput, setKickInput] = useState("");
  const [kickLookupError, setKickLookupError] = useState<string | null>(null);
  const [serverSaving, setServerSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);

  // World settings state (passed to WorldSettingsDialog)
  const [worldSettings, setWorldSettings] = useState<WorldSettings>({
    seed: "",
    nether_end: true,
    difficulty: "normal",
  });

  // Menu items
  const menuItems = [
    { key: "servers", label: "Servers", icon: <StorageIcon fontSize="large" /> },
    { key: "plugins", label: "Plugins", icon: <ExtensionIcon fontSize="large" /> },
    { key: "tools", label: "Tools", icon: <TuneIcon fontSize="large" /> },
  ];

  useEffect(() => {
    // preload world settings when servername changes
    if (servername) {
      loadWorldSettings();
    }
  }, [servername]);

  // Reload world settings whenever the World dialog is opened to ensure freshest values
  useEffect(() => {
    if (worldDialogOpen) {
      loadWorldSettings();
    }
  }, [worldDialogOpen]);

  // --- World settings loader ---
  async function loadWorldSettings() {
    if (!servername) return;
    try {
      const token = (auth && auth.token) || localStorage.getItem("token") || "";
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`/api/server/properties/get?servername=${encodeURIComponent(servername)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        let seedVal = data.seed || "";
        // If server.properties doesn't specify a level-seed, try the dedicated seed endpoint
        if (!seedVal) {
          try {
            const seedRes = await fetch(`/api/server/seed/get?servername=${encodeURIComponent(servername)}`, { headers });
            if (seedRes.ok) {
              const seedData = await seedRes.json();
              seedVal = seedData.seed || seedVal;
            }
          } catch (e) {
            // ignore and keep seedVal empty
          }
        }
        setWorldSettings({
          seed: seedVal,
          nether_end: !!data.nether_end,
          difficulty: data.difficulty || "normal",
        });
      } else {
        setWorldSettings({ seed: "", nether_end: true, difficulty: "normal" });
      }
    } catch (e) {
      setWorldSettings({ seed: "", nether_end: true, difficulty: "normal" });
    }
  }

  // --- Helper: simple username -> uuid lookup (assumes backend endpoint exists) ---
  async function lookupName(username: string): Promise<NameUUID> {
  const res = await fetch(`/api/head/uuid?username=${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error("Lookup failed");
  const data = await res.json();
  return { name: username, uuid: data.uuid || "" };
  }

  // --- Rights handlers ---
  async function handleAddAdmin() {
    setAdminLookupError(null);
    const name = adminInput.trim();
    if (!name) return setAdminLookupError("Enter a username");
    try {
      const found = await lookupName(name);
      setRightsSettings((prev) => {
        if (prev.adminsUUIDs.some((u) => u.uuid === found.uuid || u.name === found.name)) return prev;
        return { ...prev, adminsUUIDs: [...prev.adminsUUIDs, found], admins: "" };
      });
      setAdminInput("");
      notify({ type: "success", message: `Added admin ${found.name}` });
    } catch (e: any) {
      setAdminLookupError(e.message || "Failed to lookup user");
      notify({ type: "error", message: e.message || "Failed to lookup user" });
    }
  }

  function handleRemoveAdmin(uuid: string) {
    setRightsSettings((prev) => ({
      ...prev,
      adminsUUIDs: prev.adminsUUIDs.filter(u => u.uuid !== uuid)
    }));
    notify({ type: "success", message: "Player removed from admin list" });
  }

  async function saveRightsSettings() {
    setRightsSaving(true);
    setRightsError(null);
    
    try {
  const token = auth?.token || "";

      // Save ops (admins) - ALWAYS send to backend, even if empty
      {
        const formData = new FormData();
        formData.append("servername", servername);
        formData.append("ops_data", JSON.stringify(rightsSettings.adminsUUIDs));

        const opsRes = await fetch("/api/server/ops/set", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!opsRes.ok) {
          notify({ type: "error", message: "Failed to save admins" });
          throw new Error("Failed to save operators");
        }
        notify({ type: "success", message: "Admins saved successfully!" });
      }

      // Save gamemode
      {
        const gamemodeData = new FormData();
        gamemodeData.append("servername", servername);
        gamemodeData.append("gamemode", rightsSettings.gamemode);

        const gamemodeRes = await fetch("/api/server/properties/gamemode", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: gamemodeData,
        });
        if (!gamemodeRes.ok) {
          notify({ type: "error", message: "Failed to save gamemode" });
          throw new Error("Failed to save gamemode");
        }
        notify({ type: "success", message: "Gamemode saved successfully" });
      }

      // Save cheats
      {
        const cheatsData = new FormData();
        cheatsData.append("servername", servername);
        cheatsData.append("allow_cheats", rightsSettings.cheats.toString());

        const cheatsRes = await fetch("/api/server/properties/allow-cheats", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: cheatsData,
        });
        if (!cheatsRes.ok) {
          notify({ type: "error", message: "Failed to save cheats setting" });
          throw new Error("Failed to save cheats setting");
        }
        notify({ type: "success", message: "Cheats setting saved successfully" });
      }

  setRightsDialogOpen(false);
  // Kein Restart-Dialog mehr für Admin-Änderungen
  console.log("Rights settings saved successfully");
    } catch (error: any) {
      setRightsError(error?.message || "Failed to save rights settings");
      notify({ type: "error", message: error?.message || "Failed to save rights settings" });
    } finally {
      setRightsSaving(false);
    }
  }

  async function loadRightsSettings() {
    try {
  const token = auth?.token || "";

      const opsRes = await fetch(`/api/server/ops?servername=${encodeURIComponent(servername)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let adminsUUIDs: NameUUID[] = [];
      if (opsRes.ok) {
        const opsData = await opsRes.json();
        adminsUUIDs = opsData.ops || [];
      }

      const propsRes = await fetch(`/api/server/properties?servername=${encodeURIComponent(servername)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let gamemode = "survival";
      let cheats = false;
      if (propsRes.ok) {
        const propsData = await propsRes.json();
        // backend returns a flat map of properties, not nested under `properties`
        gamemode = propsData.gamemode || gamemode;
        cheats = String(propsData["allow-cheats"]).toLowerCase() === "true";
      }

      setRightsSettings({
        admins: "",
        adminsUUIDs,
        gamemode,
        cheats,
      });
    } catch (error: any) {
      console.error("Failed to load rights settings:", error);
      notify({ type: "error", message: "Failed to load rights settings" });
    }
  }

  // --- Server handlers ---
  async function handleAddBan() {
    setBanLookupError(null);
    const name = banInput.trim();
    if (!name) return setBanLookupError("Enter a username");
    try {
      const found = await lookupName(name);
      setServerSettings((prev) => {
        if (prev.banUUIDs.some((u) => u.uuid === found.uuid)) return prev;
        return { ...prev, banUUIDs: [...prev.banUUIDs, found] };
      });
      setBanInput("");
      notify({ type: "success", message: `Added banned player ${found.name}` });
    } catch (e: any) {
      setBanLookupError(e.message || "Failed to lookup user");
      notify({ type: "error", message: e.message || "Failed to lookup user" });
    }
  }

  function handleRemoveBan(uuid: string) {
    setServerSettings((prev) => ({
      ...prev,
      banUUIDs: prev.banUUIDs.filter(u => u.uuid !== uuid)
    }));
    notify({ type: "success", message: "Player removed from ban list" });
  }

  async function handleAddKick() {
    setKickLookupError(null);
    const name = kickInput.trim();
    if (!name) return setKickLookupError("Enter a username");
    try {
      const found = await lookupName(name);
      setServerSettings((prev) => {
        if (prev.kickUUIDs.some((u) => u.uuid === found.uuid)) return prev;
        return { ...prev, kickUUIDs: [...prev.kickUUIDs, found] };
      });
      setKickInput("");
      notify({ type: "success", message: `${found.name} will be kicked immediately` });
    } catch (e: any) {
      setKickLookupError(e.message || "Failed to lookup user");
      notify({ type: "error", message: e.message || "Failed to lookup user" });
    }
  }

  async function saveServerSettings() {
    setServerSaving(true);
    setServerError(null);
    
    
    try {
  const token = auth?.token || "";

      // Load current banned players to compare with new list
      let currentBannedUUIDs: NameUUID[] = [];
      try {
        const currentBannedRes = await fetch(`/api/server/banned-players?servername=${encodeURIComponent(servername)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (currentBannedRes.ok) {
          const currentBannedData = await currentBannedRes.json();
          currentBannedUUIDs = currentBannedData.banned || [];
        }
      } catch (e) {
        console.warn("Failed to load current banned players for comparison:", e);
      }

      // Always send the banned players data (even if empty, to handle unbans)
      const formData = new FormData();
      formData.append("servername", servername);
      formData.append("banned_data", JSON.stringify(serverSettings.banUUIDs));

      const banRes = await fetch("/api/server/banned-players/set", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!banRes.ok) {
        notify({ type: "error", message: "Failed to save banned players" });
        throw new Error("Failed to save banned players");
      }
      
      // Check if any players were unbanned (removed from the list)
      const currentBannedNames = new Set(currentBannedUUIDs.map(u => u.name));
      const newBannedNames = new Set(serverSettings.banUUIDs.map(u => u.name));
      const hasUnbans = Array.from(currentBannedNames).some(name => !newBannedNames.has(name));
      
      if (hasUnbans) {
        const unbannedPlayers = Array.from(currentBannedNames).filter(name => !newBannedNames.has(name));
        notify({ type: "success", message: `Players unbanned: ${unbannedPlayers.join(', ')}. Changes applied immediately.` });
      } else {
        notify({ type: "success", message: "Ban list updated successfully!" });
      }

      // Whitelist handling
      if (serverSettings.listType === "whitelist") {
        const whitelist_data = JSON.stringify([]);
        const formData = new FormData();
        formData.append("servername", servername);
        formData.append("whitelist_data", whitelist_data);

        const whitelistRes = await fetch("/api/server/whitelist/set", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!whitelistRes.ok) {
          notify({ type: "error", message: "Failed to save whitelist" });
          throw new Error("Failed to save whitelist");
        }
        notify({ type: "success", message: "Whitelist saved successfully" });
      }

      // Kick players immediately
      for (const kickPlayer of serverSettings.kickUUIDs) {
        try {
          const kickData = new FormData();
          kickData.append("servername", servername);
          kickData.append("player_name", kickPlayer.name);
          kickData.append("reason", "Kicked by admin");

          const r = await fetch("/api/server/kick-player", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: kickData,
          });

          if (!r.ok) {
            notify({ type: "error", message: `Failed to kick ${kickPlayer.name}` });
          } else {
            notify({ type: "success", message: `${kickPlayer.name} was kicked from the server` });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("Failed to kick player:", e);
          notify({ type: "error", message: `Failed to kick ${kickPlayer.name}` });
        }
      }

      setServerDialogOpen(false);
      setServerSettings((prev) => ({ ...prev, kickUUIDs: [] }));
      
      // No longer automatically show restart dialog for bans
      // Bans and unbans are applied immediately via server commands
      
      console.log("Server settings saved successfully");
    } catch (error: any) {
      setServerError(error?.message || "Failed to save server settings");
      notify({ type: "error", message: error?.message || "Failed to save server settings" });
    } finally {
      setServerSaving(false);
    }
  }

  async function restartServer() {
    try {
      const token = auth?.token || "";
      
      const formData = new FormData();
      formData.append("servername", servername);
      
      const restartRes = await fetch("/api/server/restart", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!restartRes.ok) {
        notify({ type: "error", message: "Failed to restart server" });
        return;
      }
      
      notify({ type: "success", message: `Server ${servername} is restarting...` });
      setRestartDialogOpen(false);
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to restart server" });
    }
  }

  async function loadServerSettings() {
    try {
  const token = auth?.token || "";

      const bannedRes = await fetch(`/api/server/banned-players?servername=${encodeURIComponent(servername)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let banUUIDs: NameUUID[] = [];
      if (bannedRes.ok) {
        const bannedData = await bannedRes.json();
        banUUIDs = bannedData.banned || [];
      }

      const whitelistRes = await fetch(`/api/server/whitelist?servername=${encodeURIComponent(servername)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let listType: ServerSettings["listType"] = "none";
      if (whitelistRes.ok) {
        const whitelistData = await whitelistRes.json();
        if (whitelistData.whitelist && whitelistData.whitelist.length > 0) {
          listType = "whitelist";
        }
      }

      setServerSettings({
        listType,
        banUUIDs,
        kickUUIDs: [],
      });
    } catch (error) {
      console.error("Failed to load server settings:", error);
      notify({ type: "error", message: "Failed to load server settings" });
    }
  }

  // Logout handler: support multiple auth shapes, fallback to clearing token
  function handleLogout() {
    try {
      if (auth) {
        if (typeof auth.logout === "function") {
          auth.logout();
        } else if (typeof auth.signOut === "function") {
          auth.signOut();
        } else if (typeof auth.removeToken === "function") {
          auth.removeToken();
        } else {
          localStorage.removeItem("auth-token");
        }
      } else {
        localStorage.removeItem("auth-token");
      }
    } catch {
      localStorage.removeItem("auth-token");
    }
    navigate("/login");
  }

  // JSX
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
        <Box sx={{ width: "100%", flex: 1, pt: 2 }}>
          {/* Menu Items */}
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
                  mb: 1,
                  transition: "background 0.2s, color 0.2s",
                  '&:hover': { background: "rgba(255,255,255,0.08)" },
                }}
                onMouseEnter={() => setHovered(item.key)}
                onClick={() => {
                  if (item.key === "servers") navigate("/servers");
                  else if (item.key === "plugins") navigate(`/plugins/${servername}`);
                  else if (item.key === "controls") navigate(`/servers/${servername}/controls`);
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
                '&:hover': { background: "rgba(255,255,255,0.08)" },
              }}
              onMouseEnter={() => setHovered("settings")}
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
            maxWidth: 900,
            width: "100%",
            minHeight: 500,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: "#fff" }}>
            Server Controls - {servername || "Unnamed Server"}
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* World */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(30,40,60,0.96)", borderRadius: 3, p: 3, boxShadow: "0 4px 16px 0 rgba(31, 38, 135, 0.18)" }}>
              <Box sx={{ flex: 1, textAlign: "left" }}>
                <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700 }}>
                  World
                </Typography>
                <Typography sx={{ color: "#b0c4de", fontSize: 15 }}>
                  Configure world settings, seed, difficulty and nether/end access
                </Typography>
              </Box>
              <Box>
                <Button
                  variant="contained"
                  sx={{ fontWeight: 700, minWidth: 100, borderRadius: 2, px: 3, py: 1.2, boxShadow: '0 2px 8px 0 rgba(25, 118, 210, 0.15)' }}
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/server/properties/get?servername=${encodeURIComponent(servername)}`);
                      if (res.ok) {
                        const data = await res.json();
                        setWorldSettings({
                          seed: data.seed || "",
                          nether_end: !!data.nether_end,
                          difficulty: data.difficulty || "normal",
                        });
                      } else {
                        // fallback to defaults
                        setWorldSettings({ seed: "", nether_end: true, difficulty: "normal" });
                      }
                    } catch (e) {
                      setWorldSettings({ seed: "", nether_end: true, difficulty: "normal" });
                    }
                    setWorldDialogOpen(true);
                  }}
                >
                  EDIT
                </Button>
              </Box>
            </Box>

            {/* Seed Map removed per request */}

            {/* Rights */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(30,40,60,0.96)", borderRadius: 3, p: 3, boxShadow: "0 4px 16px 0 rgba(31, 38, 135, 0.18)" }}>
              <Box sx={{ flex: 1, textAlign: "left" }}>
                <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700 }}>
                  Rights
                </Typography>
                <Typography sx={{ color: "#b0c4de", fontSize: 15 }}>
                  Choose admins, default gamemode and enable or disable cheats
                </Typography>
              </Box>
              <Box>
                <Button
                  variant="contained"
                  sx={{ fontWeight: 700, minWidth: 100, borderRadius: 2, px: 3, py: 1.2, boxShadow: '0 2px 8px 0 rgba(25, 118, 210, 0.15)' }}
                  onClick={async () => {
                    await loadRightsSettings();
                    setRightsDialogOpen(true);
                  }}
                >
                  EDIT
                </Button>
              </Box>
            </Box>

            {/* Server */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(30,40,60,0.96)", borderRadius: 3, p: 3, boxShadow: "0 4px 16px 0 rgba(31, 38, 135, 0.18)" }}>
              <Box sx={{ flex: 1, textAlign: "left" }}>
                <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700 }}>
                  Server
                </Typography>
                <Typography sx={{ color: "#b0c4de", fontSize: 15 }}>
                  Create a white/blacklist, ban/unban or kick people.
                </Typography>
              </Box>
              <Box>
                <Button
                  variant="contained"
                  sx={{ fontWeight: 700, minWidth: 100, borderRadius: 2, px: 3, py: 1.2, boxShadow: '0 2px 8px 0 rgba(25, 118, 210, 0.15)' }}
                  onClick={async () => {
                    await loadServerSettings();
                    setServerDialogOpen(true);
                  }}
                >
                  EDIT
                </Button>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Rights Dialog */}
      <Dialog open={rightsDialogOpen} onClose={() => setRightsDialogOpen(false)} maxWidth="sm" fullWidth 
        PaperProps={{
          sx: {
            background: '#1e293c',
            color: '#fff',
            borderRadius: 3,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            minWidth: 400,
            p: 2,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#fff', textAlign: 'center' }}>Rights Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
            {/* Admins */}
            <Box>
              <Typography sx={{ color: "#b0c4de", fontWeight: 600, mb: 1 }}>Admins</Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  placeholder="Enter username"
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddAdmin()}
                  size="small"
                  sx={{
                    flex: 1,
                    minWidth: 180
                  }}
                />
                <Button variant="contained" size="small" sx={{ minWidth: 80, fontWeight: 600 }} onClick={handleAddAdmin}>
                  Add
                </Button>
              </Box>
              {adminLookupError && <Typography sx={{ color: "red", fontSize: 13 }}>{adminLookupError}</Typography>}
              {rightsSettings.adminsUUIDs.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  {rightsSettings.adminsUUIDs.map((u) => (
                    <Box key={u.uuid} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, p: 1, borderRadius: 1, bgcolor: "#22304a40" }}>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <img src={`/api/head?username=${u.name}&size=32`} alt={u.name} style={{ width: 32, height: 32, borderRadius: 4, marginRight: 12, background: "#22304a" }} />
                        <Box>
                          <Typography sx={{ color: "#b0c4de", fontWeight: 600 }}>{u.name}</Typography>
                          <Typography sx={{ color: "#b0c4de", fontSize: 12, opacity: 0.6 }}>{u.uuid}</Typography>
                        </Box>
                      </Box>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        color="error"
                        onClick={() => handleRemoveAdmin(u.uuid)}
                        sx={{ minWidth: 80, fontWeight: 600 }}
                      >
                        De-admin
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Gamemode */}
            <FormControl fullWidth>
              <InputLabel id="gamemode-label" sx={{ color: "#b0c4de" }}>
                Default Gamemode
              </InputLabel>
              <Select
                labelId="gamemode-label"
                value={rightsSettings.gamemode}
                label="Default Gamemode"
                onChange={(e) => setRightsSettings({ ...rightsSettings, gamemode: String(e.target.value) })}
                size="small"
                sx={{ minWidth: 180 }}
              >
                {["survival", "creative", "adventure", "spectator"].map((g) => (
                  <MenuItem key={g} value={g}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel control={<Switch checked={rightsSettings.cheats} onChange={(e) => setRightsSettings({ ...rightsSettings, cheats: e.target.checked })} />} label={<span style={{ color: "#b0c4de" }}>Cheats enabled</span>} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 2 }}>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button onClick={() => setRightsDialogOpen(false)} sx={{ color: '#b0c4de' }} disabled={rightsSaving}>
              Cancel
            </Button>
            <Button onClick={saveRightsSettings} variant="contained" sx={{ fontWeight: 600, minWidth: 100 }} disabled={rightsSaving}>
              {rightsSaving ? "Saving..." : "Save"}
            </Button>
          </Box>
        </DialogActions>
        {rightsError && (
          <Box sx={{ p: 2, pt: 0 }}>
            <Typography sx={{ color: "red", fontSize: 14 }}>{rightsError}</Typography>
          </Box>
        )}
      </Dialog>

      {/* Server Dialog */}
      <Dialog open={serverDialogOpen} onClose={() => setServerDialogOpen(false)} maxWidth="sm" fullWidth 
        PaperProps={{
          sx: {
            background: '#1e293c',
            color: '#fff',
            borderRadius: 3,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            minWidth: 400,
            p: 2,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#fff', textAlign: 'center' }}>Server Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="listtype-label" sx={{ color: "#b0c4de" }}>
                White/Blacklist
              </InputLabel>
              <Select
                labelId="listtype-label"
                value={serverSettings.listType}
                label="White/Blacklist"
                onChange={(e) => setServerSettings({ ...serverSettings, listType: String(e.target.value) })}
                size="small"
                sx={{ minWidth: 180 }}
              >
                {["none", "whitelist", "blacklist"].map((l) => (
                  <MenuItem key={l} value={l}>
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Ban Players */}
            <Box>
              <Typography sx={{ color: "#b0c4de", fontWeight: 600, mb: 1 }}>Ban Players</Typography>
              <Typography sx={{ color: "#4caf50", fontSize: 13, mb: 1, fontWeight: 500 }}>
                ✅ Changes applied immediately (no restart required)
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  placeholder="Enter username to ban"
                  value={banInput}
                  onChange={(e) => setBanInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddBan()}
                  size="small"
                  sx={{
                    flex: 1,
                    minWidth: 180
                  }}
                />
                <Button variant="contained" size="small" sx={{ minWidth: 80, fontWeight: 600 }} onClick={handleAddBan}>
                  Add
                </Button>
              </Box>
              {banLookupError && <Typography sx={{ color: "red", fontSize: 13 }}>{banLookupError}</Typography>}
              {serverSettings.banUUIDs.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  {serverSettings.banUUIDs.map((u) => (
                    <Box key={u.uuid} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, p: 1, borderRadius: 1, bgcolor: "#22304a40" }}>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <img src={`/api/head?username=${u.name}&size=32`} alt={u.name} style={{ width: 32, height: 32, borderRadius: 4, marginRight: 12, background: "#22304a" }} />
                        <Box>
                          <Typography sx={{ color: "#b0c4de", fontWeight: 600 }}>{u.name}</Typography>
                          <Typography sx={{ color: "#b0c4de", fontSize: 12, opacity: 0.6 }}>{u.uuid}</Typography>
                        </Box>
                      </Box>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        color="error"
                        onClick={() => handleRemoveBan(u.uuid)}
                        sx={{ minWidth: 80, fontWeight: 600 }}
                      >
                        Unban
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Kick Players */}
            <Box>
              <Typography sx={{ color: "#b0c4de", fontWeight: 600, mb: 1 }}>Kick Players</Typography>
              <Typography sx={{ color: "#4caf50", fontSize: 13, mb: 1, fontWeight: 500 }}>
                ✅ Takes effect immediately (no restart required)
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  placeholder="Enter username to kick"
                  value={kickInput}
                  onChange={(e) => setKickInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddKick()}
                  size="small"
                  sx={{
                    flex: 1,
                    minWidth: 180
                  }}
                />
                <Button variant="contained" size="small" sx={{ minWidth: 80, fontWeight: 600 }} onClick={handleAddKick}>
                  Kick
                </Button>
              </Box>
              {kickLookupError && <Typography sx={{ color: "red", fontSize: 13 }}>{kickLookupError}</Typography>}
              {serverSettings.kickUUIDs.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  {serverSettings.kickUUIDs.map((u) => (
                    <Box key={u.uuid} sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <img src={`/api/head?username=${u.name}&size=32`} alt={u.name} style={{ width: 32, height: 32, borderRadius: 4, marginRight: 12, background: "#22304a" }} />
                      <Box>
                        <Typography sx={{ color: "#b0c4de", fontWeight: 600 }}>{u.name}</Typography>
                        <Typography sx={{ color: "#b0c4de", fontSize: 12, opacity: 0.6 }}>{u.uuid}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 2 }}>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button onClick={() => setServerDialogOpen(false)} sx={{ color: '#b0c4de' }} disabled={serverSaving}>
              Cancel
            </Button>
            <Button onClick={saveServerSettings} variant="contained" sx={{ fontWeight: 600, minWidth: 100 }} disabled={serverSaving}>
              {serverSaving ? "Saving..." : "Save"}
            </Button>
          </Box>
        </DialogActions>
        {serverError && (
          <Box sx={{ p: 2, pt: 0 }}>
            <Typography sx={{ color: "red", fontSize: 14 }}>{serverError}</Typography>
          </Box>
        )}
      </Dialog>

      {/* World Settings Dialog */}
      <WorldSettingsDialog
        open={worldDialogOpen}
        onClose={() => setWorldDialogOpen(false)}
        seed={worldSettings.seed}
        nether_end={worldSettings.nether_end}
        difficulty={worldSettings.difficulty}
        onSave={(settings: WorldSettings) => {
          setWorldSettings(settings);
          setWorldDialogOpen(false);
          notify({ type: "success", message: "World settings updated" });
        }}
      />

      {/* Server Restart Confirmation Dialog */}
      <Dialog
        open={restartDialogOpen}
        onClose={() => setRestartDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: "#1a2332", color: "#b0c4de" }}>
          Server Restart Required
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: "#1a2332", color: "#b0c4de" }}>
          <Typography sx={{ mb: 2, fontSize: 16 }}>
            Do you want to restart the server <strong>{servername}</strong>?
          </Typography>
          <Typography sx={{ color: "#ff9800", fontSize: 14 }}>
            The server needs to be restarted for admin and ban changes to take effect.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: "#1a2332", p: 2 }}>
          <Button 
            onClick={() => setRestartDialogOpen(false)}
            sx={{ color: "#b0c4de" }}
          >
            Cancel
          </Button>
          <Button 
            onClick={restartServer}
            variant="contained"
            color="warning"
            sx={{ fontWeight: 600 }}
          >
            Restart Server
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServerControlsPage;
