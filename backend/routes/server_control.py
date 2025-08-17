from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form, Body
from auth import get_current_user
import subprocess
import os
from fastapi.responses import JSONResponse
import glob
import psutil
import requests
import shutil
import re
import socket
import tempfile
import logging
from proxy_manager import proxy_manager
from port_allocator import port_allocator
import threading
import time

router = APIRouter()

def set_property_in_properties(servername: str, key: str, value: str):
    prop_path = safe_server_path(servername, "server.properties")
    lines = []
    found = False
    if os.path.exists(prop_path):
        with open(prop_path, "r") as f:
            for line in f:
                if line.strip().startswith(f"{key}="):
                    lines.append(f"{key}={value}\n")
                    found = True
                else:
                    lines.append(line)
    if not found:
        lines.append(f"{key}={value}\n")
    with open(prop_path, "w") as f:
        f.writelines(lines)

@router.get("/server/players_full")
def get_players_full(servername: str, current_user: dict = Depends(get_current_user)):
    """
    Returns a list of players (name + uuid) for the given server.
    Reads usercache.json from the server directory.
    """
    import json
    usercache_path = safe_server_path(servername, "usercache.json")
    players = []
    if os.path.exists(usercache_path):
        try:
            with open(usercache_path, "r", encoding="utf-8", errors="ignore") as f:
                data = json.load(f)
            for entry in data:
                name = entry.get("name")
                uuid = entry.get("uuid")
                if name and uuid:
                    players.append({"name": name, "uuid": uuid})
        except Exception:
            pass
    return {"players": players}

@router.post("/server/properties/set-seed")
def set_seed(servername: str = Form(...), seed: str = Form(...), current_user: dict = Depends(get_current_user)):
    set_property_in_properties(servername, "level-seed", seed)
    return {"message": f"Seed gesetzt: {seed}"}

@router.post("/server/properties/set-seed-with-world-reset")
def set_seed_with_world_reset(servername: str = Form(...), seed: str = Form(...), current_user: dict = Depends(get_current_user)):
    """
    Setzt einen neuen Seed und löscht die bestehenden World-Ordner,
    damit eine neue Welt mit dem neuen Seed generiert wird.
    """
    import shutil
    
    mc_servers_dir = os.environ.get("MC_SERVERS_DIR", os.path.join(os.getcwd(), "mc_servers"))
    server_path = os.path.join(mc_servers_dir, servername)
    if not os.path.exists(server_path):
        raise HTTPException(status_code=404, detail=f"Server '{servername}' nicht gefunden")
    
    # Prüfen ob Server läuft
    if get_server_proc(servername):
        raise HTTPException(status_code=400, detail="Server muss gestoppt werden bevor die Welt zurückgesetzt werden kann")
    
    try:
        # World-Ordner löschen
        world_folders = ["world", "world_nether", "world_the_end"]
        deleted_folders = []
        
        for folder in world_folders:
            folder_path = os.path.join(server_path, folder)
            if os.path.exists(folder_path):
                shutil.rmtree(folder_path)
                deleted_folders.append(folder)
                logging.info(f"Deleted world folder: {folder_path}")
        
        # Seed setzen
        set_property_in_properties(servername, "level-seed", seed)
        
        return {
            "message": f"Seed auf '{seed}' gesetzt und Welt zurückgesetzt",
            "deleted_folders": deleted_folders,
            "warning": "Die alte Welt wurde unwiderruflich gelöscht"
        }
        
    except Exception as e:
        logging.error(f"Fehler beim Zurücksetzen der Welt für {servername}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fehler beim Zurücksetzen der Welt: {str(e)}")


@router.post("/server/properties/other_dimensions")
def set_other_dimensions(servername: str = Form(...), allow: bool = Form(...), current_user: dict = Depends(get_current_user)):
    # Setze sowohl Nether als auch End
    set_property_in_properties(servername, "allow-nether", "true" if allow else "false")
    set_property_in_properties(servername, "allow-end", "true" if allow else "false")
    return {"message": f"Nether & End {'erlaubt' if allow else 'verboten'}"}


@router.post("/server/properties/set-nether")
def set_nether(servername: str = Form(...), allow: str = Form(...), current_user: dict = Depends(get_current_user)):
    """
    Set only the allow-nether property based on the incoming form value.
    Accepts boolean-like strings: "true"/"false", "1"/"0", etc.
    """
    val = str(allow).lower()
    allow_bool = val in ("1", "true", "yes", "on")
    set_property_in_properties(servername, "allow-nether", "true" if allow_bool else "false")
    return {"message": f"allow-nether set to {str(allow_bool).lower()}"}

@router.post("/server/properties/set-difficulty")
def set_difficulty(servername: str = Form(...), difficulty: str = Form(...), current_user: dict = Depends(get_current_user)):
    allowed = {"easy", "normal", "peaceful", "hard"}
    if difficulty not in allowed:
        raise HTTPException(status_code=400, detail="Ungültige Schwierigkeit. Erlaubt: easy, normal, peaceful, hard")
    set_property_in_properties(servername, "difficulty", difficulty)
    return {"message": f"Schwierigkeit gesetzt: {difficulty}"}

@router.post("/server/properties/set-motd")
def set_motd(servername: str = Form(...), motd: str = Form(...), current_user: dict = Depends(get_current_user)):
    set_property_in_properties(servername, "motd", motd)
    return {"message": f"MOTD gesetzt: {motd}"}

@router.post("/server/properties/set")
def set_property(servername: str = Form(...), key: str = Form(...), value: str = Form(...), current_user: dict = Depends(get_current_user)):
    set_property_in_properties(servername, key, value)
    return {"message": f"Property '{key}' gesetzt: {value}"}
def is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    """Check if a port is open on the given host"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            return result == 0
    except Exception:
        return False

def scan_port_range(start_port: int, end_port: int, host: str = "localhost") -> set:
    """Scan a range of ports to find which ones are in use"""
    used_ports = set()
    
    def scan_port(port):
        if is_port_open(host, port, timeout=0.1):
            used_ports.add(port)
    
    # Use threading for faster scanning
    threads = []
    for port in range(start_port, min(end_port + 1, 65536)):
        thread = threading.Thread(target=scan_port, args=(port,))
        threads.append(thread)
        thread.start()
        
        # Limit concurrent threads to avoid overwhelming the system
        if len(threads) >= 50:
            for t in threads:
                t.join()
            threads = []
    
    # Wait for remaining threads
    for t in threads:
        t.join()
    
    return used_ports

def is_valid_port(port: int) -> tuple[bool, str]:
    """Check if port is valid and not reserved"""
    # Port range validation
    if not (1 <= port <= 65535):
        return False, "Port must be between 1 and 65535"
    
    # Reserved system ports (avoid conflicts)
    reserved_ports = {
        22: "SSH",
        25: "SMTP", 
        53: "DNS",
        # 80: "HTTP",  # Port 80 is not used, only 1105 is reserved for HTTP
        443: "HTTPS",
        993: "IMAPS",
        995: "POP3S",
        1105: "Blockpanel Frontend",
        8000: "Blockpanel Backend",
        8404: "HAProxy Stats",
        3306: "MySQL",
        5432: "PostgreSQL", 
        6379: "Redis",
        27017: "MongoDB",
    }
    
    # Check if port is reserved
    if port in reserved_ports:
        return False, f"Port reserved for {reserved_ports[port]}"
        
    # Check if port is in dangerous range (system ports)
    if 1 <= port <= 1023:
        return False, "System ports (1-1023) are not allowed"
        
    return True, ""

def get_minecraft_server_ports() -> set:
    """Get all ports currently used by Minecraft servers"""
    used_ports = set()
    mc_servers_dir = os.environ.get("MC_SERVERS_DIR", os.path.join(os.getcwd(), "mc_servers"))
    
    if not os.path.exists(mc_servers_dir):
        return used_ports
    
    for server_name in os.listdir(mc_servers_dir):
        server_path = os.path.join(mc_servers_dir, server_name)
        if os.path.isdir(server_path):
            properties_file = os.path.join(server_path, "server.properties")
            if os.path.exists(properties_file):
                try:
                    with open(properties_file, 'r') as f:
                        for line in f:
                            if line.startswith('server-port='):
                                port = int(line.split('=')[1].strip())
                                used_ports.add(port)
                                break
                except (ValueError, IOError):
                    continue
    
    return used_ports

@router.get("/server/ports/validate")
def validate_port(port: int, current_user: dict = Depends(get_current_user)):
    """Validate if a port can be used for a new server"""
    # Check if port is valid
    valid, reason = is_valid_port(port)
    if not valid:
        suggestion = port_allocator.get_available_ports(1)
        return {
            "valid": False,
            "reason": reason,
            "suggestion": suggestion[0] if suggestion else None,
            "port_status": "invalid"
        }
    
    # Check if port is in use (live scan)
    if is_port_open("localhost", port):
        suggestions = port_allocator.get_available_ports(1)
        return {
            "valid": False,
            "reason": f"Port {port} is already in use",
            "suggestion": suggestions[0] if suggestions else None,
            "port_status": "in_use"
        }
    
    return {
        "valid": True,
        "port": port,
        "port_status": "available"
    }

@router.get("/server/ports/allocations")
def get_port_allocations(current_user: dict = Depends(get_current_user)):
    """Get current port allocation status"""
    return port_allocator.get_allocation_status()

@router.get("/server/ports/available")
def get_available_ports(count: int = 10, current_user: dict = Depends(get_current_user)):
    """Get available ports for new servers"""
    available = port_allocator.get_available_ports(count)
    return {
        "available_ports": available,
        "count": len(available)
    }

@router.get("/server/ports/scan")
def scan_ports(start: int = 25565, end: int = 25600, current_user: dict = Depends(get_current_user)):
    """Scan a range of ports to check availability"""
    try:
        if end - start > 1000:
            raise HTTPException(status_code=400, detail="Port range too large (max 1000 ports)")
        
        used_ports = scan_port_range(start, end)
        minecraft_ports = get_minecraft_server_ports()
        
        results = []
        for port in range(start, min(end + 1, 65536)):
            valid, reason = is_valid_port(port)
            status = "invalid"
            
            if valid:
                if port in used_ports:
                    status = "in_use"
                    if port in minecraft_ports:
                        status = "minecraft_server"
                else:
                    status = "available"
            
            results.append({
                "port": port,
                "status": status,
                "reason": reason if not valid else None
            })
        
        return {
            "scan_range": f"{start}-{end}",
            "total_ports": len(results),
            "available_count": len([r for r in results if r["status"] == "available"]),
            "results": results
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Port scan failed: {str(e)}")

@router.get("/server/ports/suggest")
def suggest_free_port(preferred: int = 25565, current_user: dict = Depends(get_current_user)):
    """Suggest a free port starting from the preferred port"""
    suggestion = find_free_port(preferred)
    valid, reason = is_valid_port(suggestion)
    
    return {
        "suggested_port": suggestion,
        "valid": valid,
        "reason": reason if not valid else None,
        "checked_from": preferred
    }
@router.get("/server/portcheck")
def check_server_port(servername: str, current_user: dict = Depends(get_current_user)):
    """
    Prüft, ob der Minecraft-Server-Port erreichbar ist (TCP connect).
    """
    import time
    prop_path = safe_server_path(servername, "server.properties")
    port = 25565
    if os.path.exists(prop_path):
        with open(prop_path, "r") as f:
            for line in f:
                if line.strip().startswith("server-port="):
                    try:
                        port = int(line.strip().split("=", 1)[1])
                    except Exception:
                        port = 25565
                    break
    # Versuche, den Port zu erreichen (localhost und 0.0.0.0)
    result = False
    for host in ["127.0.0.1", "0.0.0.0"]:
        try:
            with socket.create_connection((host, port), timeout=1):
                result = True
                break
        except Exception:
            continue
    return {"open": result, "port": port}

@router.get("/server/uptime")
def get_server_uptime(servername: str, current_user: dict = Depends(get_current_user)):
    pid = get_server_proc(servername)
    uptime = None
    if pid:
        try:
            p = psutil.Process(pid)
            uptime = int(time.time() - p.create_time())
        except Exception:
            uptime = None
    return {"uptime": uptime}

@router.get("/server/stats")
def server_stats(servername: str, current_user: dict = Depends(get_current_user)):
    import time
    import locale as pylocale
    ram_allocated = get_server_ram(servername)
    pid = get_server_proc(servername)
    ram_used = None
    uptime = None
    if pid:
        try:
            p = psutil.Process(pid)
            # Summe aller Java-Prozesse im tmux-Session
            ram_used = int(p.memory_info().rss / 1024 / 1024)
            for child in p.children(recursive=True):
                try:
                    ram_used += int(child.memory_info().rss / 1024 / 1024)
                except Exception:
                    pass
            uptime = int(time.time() - p.create_time())
        except Exception:
            ram_used = None
            uptime = None
    plugin_dir = safe_server_path(servername, "plugins")
    plugins = []
    if os.path.exists(plugin_dir):
        plugins = [f for f in os.listdir(plugin_dir) if f.endswith(".jar")]
    prop_path = safe_server_path(servername, "server.properties")
    props = {}
    if os.path.exists(prop_path):
        with open(prop_path, "r") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    props[k] = v
    max_players = 0
    if "max-players" in props:
        try:
            max_players = int(props["max-players"])
        except Exception:
            max_players = 0
    log_path = safe_server_path(servername, "logs", "latest.log")
    if not os.path.exists(log_path):
        log_path = safe_server_path(servername, "server.log")
    # Version aus Log extrahieren
    server_version = None
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[-200:]
            for line in lines:
                if "Starting minecraft server version" in line:
                    m = re.search(r"Starting minecraft server version ([^\s]+)", line)
                    if m:
                        server_version = m.group(1)
                        break
        except Exception:
            pass
    # Player count aus Log: joined/left the game
    online_players = 0
    if os.path.exists(log_path):
        try:
            import re
            player_set = set()
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[-500:]
            for line in lines:
                # joined
                m = re.search(r"INFO\]: (?:\\u001b\[[^m]+m)?([A-Za-z0-9_]+) joined the game", line)
                if m:
                    player_set.add(m.group(1))
                # left
                m2 = re.search(r"INFO\]: (?:\\u001b\[[^m]+m)?([A-Za-z0-9_]+) left the game", line)
                if m2:
                    player_set.discard(m2.group(1))
            online_players = len(player_set)
        except Exception:
            online_players = 0
    port = props.get("server-port", "25565")
    address = f"{socket.gethostbyname(socket.gethostname())}:{port}"
    # Live-Log aus tmux, falls Session läuft
    live_log = None
    session = get_tmux_session(servername)
    try:
        out = subprocess.check_output(["tmux", "capture-pane", "-t", session, "-p"], cwd=safe_server_path(servername))
        live_log = out.decode(errors="ignore")
    except Exception:
        if os.path.exists(log_path):
            try:
                with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                    live_log = "".join(f.readlines()[-30:])
            except Exception:
                live_log = ""
        else:
            live_log = ""
    return {
        "ram_allocated": ram_allocated,
        "ram_used": ram_used,
        "uptime": uptime,
        "plugins": plugins,
        "player_count": online_players,
        "max_players": max_players,
        "address": address,
        "port": port,
        "logs": live_log
    }

@router.get("/server/playercount")
def get_player_count(servername: str, current_user: dict = Depends(get_current_user)):
    log_path = safe_server_path(servername, "logs", "latest.log")
    if not os.path.exists(log_path):
        log_path = safe_server_path(servername, "server.log")
    # max_players aus server.properties
    prop_path = safe_server_path(servername, "server.properties")
    max_players = 0
    if os.path.exists(prop_path):
        with open(prop_path, "r") as f:
            for line in f:
                if line.strip().startswith("max-players="):
                    try:
                        max_players = int(line.strip().split("=", 1)[1])
                    except Exception:
                        max_players = 0
                    break
    player_set = set()
    if os.path.exists(log_path):
        try:
            import re
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[-500:]
            for line in lines:
                m = re.search(r"INFO\]: (?:\\u001b\[[^m]+m)?([A-Za-z0-9_]+) joined the game", line)
                if m:
                    player_set.add(m.group(1))
                m2 = re.search(r"INFO\]: (?:\\u001b\[[^m]+m)?([A-Za-z0-9_]+) left the game", line)
                if m2:
                    player_set.discard(m2.group(1))
        except Exception:
            pass
    player_count = len(player_set)
    return {"player_count": player_count, "max_players": max_players}

@router.get("/server/players")
def get_players(servername: str, current_user: dict = Depends(get_current_user)):
    usercache_path = safe_server_path(servername, "usercache.json")
    players = []
    if os.path.exists(usercache_path):
        try:
            import json
            with open(usercache_path, "r", encoding="utf-8", errors="ignore") as f:
                data = json.load(f)
            for entry in data:
                name = entry.get("name")
                uuid = entry.get("uuid")
                if name and uuid:
                    players.append({"name": name, "uuid": uuid})
        except Exception:
            pass
    return {"players": players}

import subprocess
import os
from fastapi.responses import JSONResponse
import glob
import psutil
import requests
import shutil
import re
import socket
import tempfile
import logging

def get_pid_file(servername: str):
    return safe_server_path(servername, "mcserver.pid")

def get_server_proc(servername: str):
    pid_file = get_pid_file(servername)
    if not os.path.exists(pid_file):
        return None
    try:
        with open(pid_file, "r") as f:
            pid = int(f.read().strip())
        os.kill(pid, 0)
        return pid
    except Exception:
        return None
    
def is_valid_servername(servername: str):
    # Servername darf keine Pfadtrennzeichen oder leere Strings enthalten
    # Disallow empty names or path traversal separators; allow dots and other safe chars
    if not servername or '/' in servername or '\\' in servername:
        return False
    # Allow most characters except path separators; keep simple to support names like 'my.server' or 'world-1'
    return True

def safe_server_path(servername: str, *paths):
    if not is_valid_servername(servername):
        raise HTTPException(status_code=400, detail="Invalid servername")
    # Cross-platform base dir
    base_dir = os.environ.get("MC_SERVERS_DIR", os.path.join(os.getcwd(), "mc_servers"))
    # Normalize paths to avoid trailing-slash issues and symlink weirdness
    base = os.path.normpath(os.path.abspath(os.path.join(base_dir, servername)))
    full = os.path.normpath(os.path.abspath(os.path.join(base, *paths)))
    try:
        # Use commonpath to ensure full is inside base
        common = os.path.commonpath([base, full])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if common != base:
        raise HTTPException(status_code=400, detail="Invalid path")
    return full


# Logging setup
LOG_PATH = os.environ.get("BACKEND_LOG", os.path.join(os.getcwd(), "mc_servers", "backend.log"))
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s', 
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler()
    ]
)



def get_tmux_session(servername: str):
    return f"mc_{servername}"

def get_server_ram(servername: str) -> str:
    """Get RAM setting for server, default to 2048MB"""
    config_path = safe_server_path(servername, "server.config")
    default_ram = "2048"
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                for line in f:
                    if line.strip().startswith("ram="):
                        return line.strip().split("=", 1)[1]
        except Exception:
            pass
    return default_ram

def save_server_config(servername: str, ram: str, port: str = None):
    """Save server configuration"""
    config_path = safe_server_path(servername, "server.config")
    try:
        with open(config_path, "w") as f:
            f.write(f"ram={ram}\n")
            if port:
                f.write(f"port={port}\n")
    except Exception as e:
        logging.error(f"Failed to save config for {servername}: {e}")

def get_used_ports():
    """Get all ports currently used by existing servers"""
    used_ports = set()
    mc_servers_dir = os.environ.get("MC_SERVERS_DIR", os.path.join(os.getcwd(), "mc_servers"))
    
    if not os.path.exists(mc_servers_dir):
        return used_ports
    
    for server_dir in os.listdir(mc_servers_dir):
        server_path = os.path.join(mc_servers_dir, server_dir)
        if not os.path.isdir(server_path):
            continue
            
        props_path = os.path.join(server_path, "server.properties")
        if os.path.exists(props_path):
            try:
                with open(props_path, "r") as f:
                    for line in f:
                        if line.strip().startswith("server-port="):
                            port = int(line.strip().split("=", 1)[1])
                            used_ports.add(port)
                            break
            except Exception:
                pass
    return used_ports

def find_free_port(start_port: int = 25565, max_attempts: int = 1000):
    """Find the next free port starting from start_port with improved scanning"""
    for attempt in range(max_attempts):
        port = start_port + attempt
        
        # Check if port is valid
        valid, _ = is_valid_port(port)
        if not valid:
            continue
            
        # Check if port is actually available
        if not is_port_open("localhost", port):
            return port
    
    # If no port found in range, try random ports in valid ranges
    import random
    valid_ranges = [
        (1024, 5000),
        (25565, 25600), 
        (19132, 19200),
        (7000, 8000),
        (9000, 10000)
    ]
    
    for start, end in valid_ranges:
        for _ in range(100):  # Try 100 random ports in each range
            port = random.randint(start, end)
            valid, _ = is_valid_port(port)
            if valid and not is_port_open("localhost", port):
                return port
    
    raise HTTPException(status_code=500, detail="No free ports available")

def set_server_port(servername: str, port: int):
    """Set the port in server.properties"""
    props_path = safe_server_path(servername, "server.properties")
    
    # Read existing properties or create default ones
    lines = []
    port_set = False
    
    if os.path.exists(props_path):
        with open(props_path, "r") as f:
            lines = f.readlines()
        
        # Update existing port line
        for i, line in enumerate(lines):
            if line.strip().startswith("server-port="):
                lines[i] = f"server-port={port}\n"
                port_set = True
                break
    
    # If port wasn't found in existing properties, add it
    if not port_set:
        lines.append(f"server-port={port}\n")
    
    # Write back to file
    with open(props_path, "w") as f:
        f.writelines(lines)

@router.get("/server/ports/check")
def check_port_availability(port: int = 25565, current_user: dict = Depends(get_current_user)):
    """Check if a specific port is available"""
    used_ports = get_used_ports()
    is_available = port not in used_ports
    
    if not is_available:
        # Suggest next free port
        free_port = find_free_port(port)
        return {
            "available": False,
            "suggested_port": free_port,
            "used_ports": sorted(list(used_ports))
        }
    
    return {
        "available": True,
        "port": port,
        "used_ports": sorted(list(used_ports))
    }

@router.get("/server/ports/free")
def get_free_port(current_user: dict = Depends(get_current_user)):
    """Get the next free port starting from 25565"""
    free_port = find_free_port()
    used_ports = get_used_ports()
    return {
        "free_port": free_port,
        "used_ports": sorted(list(used_ports))
    }

@router.post("/server/start")
def start_server_endpoint(servername: str, current_user: dict = Depends(get_current_user)):
    return start_server_internal(servername, current_user)

def start_server_internal(servername: str, current_user: dict):
    # Check if server directory exists first
    server_dir = safe_server_path(servername)
    if not os.path.exists(server_dir):
        logging.error(f"Server directory does not exist for {servername}")
        return JSONResponse(status_code=404, content={"error": "Server not found"})
    
    # Prevent multiple servers from starting at once
    import time
    lock_file = safe_server_path(servername, "start.lock")
    
    # Cleanup stale locks (older than 5 minutes)
    if os.path.exists(lock_file):
        try:
            lock_age = time.time() - os.path.getmtime(lock_file)
            if lock_age > 300:  # 5 minutes
                logging.warning(f"Removing stale lock file for {servername} (age: {lock_age:.1f}s)")
                os.remove(lock_file)
            else:
                logging.warning(f"Start lock exists for {servername}, aborting start.")
                return {"status": "already starting"}
        except Exception as e:
            logging.error(f"Error checking lock file age for {servername}: {e}")
            return {"status": "already starting"}
    
    if get_server_proc(servername):
        return {"status": "already running"}
    
    try:
        # Ensure the server directory exists and has proper permissions
        os.makedirs(server_dir, exist_ok=True)
        with open(lock_file, "w") as f:
            f.write(f"locked at {time.time()}")
    except Exception as e:
        logging.error(f"Could not create start lock for {servername}: {e}")
        return JSONResponse(status_code=500, content={"error": "Could not create start lock."})
    jar_path = safe_server_path(servername, "purpur.jar")
    base_path = safe_server_path(servername)
    pid_file = get_pid_file(servername)
    log_file = safe_server_path(servername, "server.log")
    if not os.path.exists(jar_path):
        logging.error(f"purpur.jar fehlt für {servername}!")
        return JSONResponse(status_code=500, content={"error": "purpur.jar fehlt!"})
    session = get_tmux_session(servername)
    ram_mb = get_server_ram(servername)
    try:
        # Starte Java in tmux und leite stdout/stderr in server.log um
        result = subprocess.run([
            "tmux", "new-session", "-d", "-s", session, "sh", "-c", f"java -Xmx{ram_mb}M -jar purpur.jar nogui > server.log 2>&1"
        ], cwd=base_path, capture_output=True, text=True)
        if result.returncode != 0:
            logging.error(f"tmux/java Fehler (rc={result.returncode}):\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")
            if os.path.exists(lock_file):
                os.remove(lock_file)
            return JSONResponse(status_code=500, content={"error": f"tmux/java Fehler: {result.stderr}"})
        out = subprocess.check_output([
            "tmux", "list-panes", "-t", session, "-F", "#{pane_pid}"
        ], cwd=base_path)
        pid = int(out.decode().strip())
        with open(pid_file, "w") as f:
            f.write(str(pid))
        logging.info(f"Server {servername} gestartet (PID {pid})")

        # Warte auf das letzte "Done" im Log (max 60s)
        done_found = False
        done_count = 0
        max_wait = 60
        waited = 0
        last_done_line = -1
        while waited < max_wait:
            if not os.path.exists(log_file):
                time.sleep(1)
                waited += 1
                continue
            with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            # Suche alle Zeilen mit "Done ("
            done_lines = [i for i, line in enumerate(lines) if "Done (" in line]
            if done_lines:
                # Wenn es neue "Done"-Zeilen gibt, merke dir die letzte
                if last_done_line != done_lines[-1]:
                    last_done_line = done_lines[-1]
                    done_count = len(done_lines)
                # Prüfe, ob nach dem letzten "Done" noch weitere Server-Output-Zeilen kamen (z.B. "You can now connect")
                # oder ob der Server wirklich bereit ist (optional: weitere Checks)
                # Wir nehmen an: Wenn "Done (" das letzte relevante ist, ist der Server bereit
                done_found = True
                break
            time.sleep(1)
            waited += 1
        if done_found:
            status = "started"
        else:
            status = "booting"  # Timeout, aber Prozess läuft
        return {"status": status}
    except Exception as e:
        logging.error(f"Fehler beim Starten von {servername}: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        if os.path.exists(lock_file):
            os.remove(lock_file)
# Health-Check-Endpoint - erfordert Authentifizierung
@router.get("/system/health")
def system_health(current_user: dict = Depends(get_current_user)):
    # Check Java
    try:
        java_out = subprocess.check_output(["java", "-version"], stderr=subprocess.STDOUT)
        java_ok = True
        java_version = java_out.decode(errors="ignore").strip()
    except Exception as e:
        java_ok = False
        java_version = str(e)
    # Check tmux
    try:
        tmux_out = subprocess.check_output(["tmux", "-V"])
        tmux_ok = True
        tmux_version = tmux_out.decode(errors="ignore").strip()
    except Exception as e:
        tmux_ok = False
        tmux_version = str(e)
    # Check mc_servers dir
    mc_dir = "/app/mc_servers"
    mc_dir_exists = os.path.exists(mc_dir)
    mc_dir_writable = os.access(mc_dir, os.W_OK) if mc_dir_exists else False
    return {
        "java": {"ok": java_ok, "version": java_version},
        "tmux": {"ok": tmux_ok, "version": tmux_version},
        "mc_servers": {"exists": mc_dir_exists, "writable": mc_dir_writable}
    }

@router.post("/server/stop")
def stop_server(servername: str, current_user: dict = Depends(get_current_user)):
    session = get_tmux_session(servername)
    pid = get_server_proc(servername)
    pid_file = get_pid_file(servername)
    if not pid:
        logging.info(f"Stop: Server {servername} is not running.")
        return {"status": "not running"}
    try:
        logging.info(f"Stop: Killing tmux session {session} for server {servername} (PID {pid})")
        subprocess.run(["tmux", "kill-session", "-t", session], check=True)
        if os.path.exists(pid_file):
            os.remove(pid_file)
            logging.info(f"Stop: Removed PID file for {servername}")
        else:
            logging.info(f"Stop: No PID file found for {servername}")
        return {"status": "stopped"}
    except Exception as e:
        logging.error(f"Stop: Error stopping server {servername}: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/server/status")
def server_status(servername: str, current_user: dict = Depends(get_current_user)):
    if get_server_proc(servername):
        return {"status": "running"}
    return {"status": "stopped"}

@router.get("/system/ram")
def get_system_ram(current_user: dict = Depends(get_current_user)):
    mem = psutil.virtual_memory()
    return {
        "total_mb": int(mem.total / 1024 / 1024),
        "available_mb": int(mem.available / 1024 / 1024)
    }

@router.post("/server/restart")
def restart_server(servername: str = Form(...), current_user: dict = Depends(get_current_user)):
    logging.info(f"Restart: Stopping server {servername}")
    stop_response = stop_server(servername, current_user)
    if stop_response["status"] != "stopped":
        logging.warning(f"Restart: Stop failed or not running for {servername}: {stop_response}")
        return stop_response
    # Warte 2 Sekunden, damit Prozess wirklich beendet ist
    time.sleep(2)
    logging.info(f"Restart: Starting server {servername}")
    start_response = start_server_internal(servername, current_user)
    if start_response.get("status") != "started":
        logging.warning(f"Restart: Start failed for {servername}: {start_response}")
        return start_response
    logging.info(f"Restart: Server {servername} restarted successfully.")
    return {"status": "restarted"}

@router.post("/server/create_and_start")
def create_and_start_server(
    background_tasks: BackgroundTasks,
    servername: str = Form(...),
    purpur_url: str = Form(...),
    ram: str = Form(default="2048"),
    port: int = Form(default=None),  # Optional port, will be auto-allocated if not provided
    accept_eula: bool = Form(default=True),
    current_user: dict = Depends(get_current_user)
):
    """
    Vereinfachter Endpoint: Erstellt Server, akzeptiert EULA automatisch und startet ihn
    """
    import json
    # 1. Validierung Servername und RAM
    if not is_valid_servername(servername):
        raise HTTPException(status_code=400, detail="Invalid servername")
    try:
        ram_int = int(ram)
        if ram_int < 512 or ram_int > 8192:
            raise HTTPException(status_code=400, detail="RAM must be between 512MB and 8192MB")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid RAM value")

    # 2. Port allocation - use dynamic allocation if no port specified
    if port is None:
        allocated_port = port_allocator.allocate_port(servername)
        if allocated_port is None:
            raise HTTPException(status_code=500, detail="No available ports for server creation")
        port = allocated_port
        logging.info(f"Auto-allocated port {port} for server {servername}")
    else:
        # Try to allocate the requested port
        allocated_port = port_allocator.allocate_port(servername, port)
        if allocated_port is None:
            suggestions = port_allocator.get_available_ports(3)
            raise HTTPException(
                status_code=400, 
                detail=f"Port {port} is not available. Available ports: {suggestions}")
        if allocated_port != port:
            port = allocated_port
            logging.info(f"Requested port not available, allocated port {port} for server {servername}")
        else:
            logging.info(f"Allocated requested port {port} for server {servername}")

    # 3. Check if server already exists
    mc_servers_dir = os.environ.get("MC_SERVERS_DIR", os.path.join(os.getcwd(), "mc_servers"))
    base_path = os.path.abspath(os.path.join(mc_servers_dir, servername))
    if os.path.exists(base_path):
        raise HTTPException(status_code=400, detail="Server already exists")

    # 4. Zielordner anlegen
    try:
        os.makedirs(base_path, exist_ok=True)
    except Exception as e:
        logging.error(f"Could not create server directory {base_path}: {e}")
        raise HTTPException(status_code=500, detail="Could not create server directory.")

    # 5. Download purpur.jar
    jar_path = os.path.join(base_path, "purpur.jar")
    try:
        # Versuche zuerst mit curl
        curl_cmd = [
            "curl", 
            "-L",           # Follow redirects
            "-f",           # Fail silently on HTTP errors
            "--retry", "3", # Retry 3 times
            "--retry-delay", "2",  # Wait 2 seconds between retries
            "--connect-timeout", "30",  # Connection timeout
            "--max-time", "300",    # Max total time (5 minutes)
            "-o", jar_path, 
            purpur_url
        ]
        logging.info(f"Downloading JAR from {purpur_url} using curl")
        result = subprocess.run(curl_cmd, capture_output=True, text=True, timeout=360)
        
        if result.returncode != 0:
            logging.warning(f"curl failed with return code {result.returncode}, trying Python requests")
            logging.warning(f"curl stderr: {result.stderr}")
            
            # Fallback zu Python requests
            import requests
            logging.info(f"Downloading JAR from {purpur_url} using requests")
            response = requests.get(purpur_url, stream=True, timeout=300)
            response.raise_for_status()
            
            with open(jar_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            logging.info("Successfully downloaded JAR using requests")
            
        if not os.path.exists(jar_path):
            logging.error(f"JAR file was not created at {jar_path}")
            raise HTTPException(status_code=500, detail="JAR file was not downloaded")
            
        # Prüfe ob die Datei eine vernünftige Größe hat (mindestens 1MB)
        file_size = os.path.getsize(jar_path)
        if file_size < 1024 * 1024:  # 1MB
            logging.error(f"Downloaded file is too small: {file_size} bytes")
            os.remove(jar_path)
            raise HTTPException(status_code=500, detail="Downloaded file is too small")
            
        logging.info(f"Successfully downloaded JAR file: {file_size} bytes")
        
        if os.name != "nt":
            try:
                os.chmod(jar_path, 0o755)
            except Exception as chmod_err:
                logging.warning(f"chmod für purpur.jar fehlgeschlagen: {chmod_err}")
    except subprocess.TimeoutExpired:
        logging.error("Download timeout after 6 minutes")
        raise HTTPException(status_code=500, detail="Download timeout")
    except Exception as e:
        logging.error(f"Download/Write error: {e}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

    # 6. RAM-Konfiguration speichern
    try:
        save_server_config(servername, ram, str(port))
    except Exception as e:
        logging.error(f"Failed to save RAM config: {e}")
        raise HTTPException(status_code=500, detail="Failed to save RAM config.")

    # 7. Set port in server.properties first (before initial run)
    try:
        set_server_port(servername, port)
        logging.info(f"Set port {port} for server {servername}")
    except Exception as e:
        logging.error(f"Failed to set port for {servername}: {e}")
        raise HTTPException(status_code=500, detail="Failed to set server port")
    
    # 8. HAProxy Konfiguration aktualisieren (before server start)
    try:
        proxy_success, allocated_port = proxy_manager.add_server_proxy(servername, port)
        if proxy_success:
            # Update port if it was changed by the allocator
            if allocated_port != port:
                port = allocated_port
                # Update server.properties with the actually allocated port
                set_server_port(servername, port)
                logging.info(f"Updated server.properties with allocated port {port}")
            
            logging.info(f"Added HAProxy configuration for {servername} on port {allocated_port}")
        else:
            logging.warning(f"Failed to add HAProxy configuration for {servername}")
            # Don't fail the entire operation, but log the issue
    except Exception as e:
        logging.warning(f"HAProxy configuration failed for {servername}: {e}")
        # Dies ist nicht kritisch für die Server-Erstellung

    # 9. Initial-Run für EULA-Generierung (optimized)
    eula_path = safe_server_path(servername, "eula.txt")
    try:
        logging.info(f"Starting initial run for server {servername} with {ram}MB RAM on port {port}")
        process = subprocess.Popen([
            "java", f"-Xmx{ram}M", "-jar", "purpur.jar", "nogui"
        ], cwd=base_path, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        import time
        # Reduced wait time from 10 to 5 seconds
        time.sleep(5)
        try:
            process.stdin.write("stop\n")
            process.stdin.flush()
            # Reduced timeout from 10 to 5 seconds
            process.wait(timeout=5)
            logging.info(f"Initial run completed gracefully for {servername}")
        except subprocess.TimeoutExpired:
            logging.warning(f"Initial run timeout for {servername}, force killing")
            process.kill()
            process.wait()
            logging.info(f"Initial run force-killed for {servername}")
        except Exception as e:
            logging.warning(f"Error during initial run stop for {servername}: {e}")
            process.kill()
            process.wait()
            logging.info(f"Initial run force-killed for {servername}")
        
        # 10. EULA automatisch akzeptieren wenn gewünscht
        if accept_eula:
            if not os.path.exists(eula_path):
                with open(eula_path, "w") as f:
                    f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                    f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                    f.write("eula=true\n")
                logging.info(f"Created and accepted EULA file for {servername}")
            else:
                # EULA auf true setzen
                with open(eula_path, "r") as f:
                    lines = f.readlines()
                with open(eula_path, "w") as f:
                    for line in lines:
                        if line.startswith("eula="):
                            f.write("eula=true\n")
                        else:
                            f.write(line)
                logging.info(f"Accepted EULA for {servername}")
        else:
            # EULA-Datei erstellen aber nicht akzeptieren
            if not os.path.exists(eula_path):
                with open(eula_path, "w") as f:
                    f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                    f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                    f.write("eula=false\n")
                logging.info(f"Created EULA file for {servername} (not accepted)")
    except Exception as e:
        logging.error(f"Initial run/EULA error: {e}")
        if not accept_eula:
            return JSONResponse(content={
                "message": "Server created successfully. Please accept the EULA manually.",
                "server_name": servername,
                "port": port,
                "eula_required": True
            })
        else:
            # Continue with server start even if initial run had issues
            logging.warning(f"Initial run failed but continuing with server creation for {servername}")

    # 11. Server starten wenn EULA akzeptiert wurde (with improved error handling)
    if accept_eula:
        try:
            # Check if EULA is properly set before starting
            if os.path.exists(eula_path):
                with open(eula_path, "r") as f:
                    eula_content = f.read()
                if "eula=true" not in eula_content:
                    # Force set EULA to true
                    with open(eula_path, "w") as f:
                        f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                        f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                        f.write("eula=true\n")
                    logging.info(f"Fixed EULA for {servername}")
            
            start_result = start_server_internal(servername, current_user)
            if isinstance(start_result, JSONResponse):
                return JSONResponse(content={
                    "message": "Server created successfully! Starting server...",
                    "server_name": servername,
                    "port": port,
                    "status": "starting",
                    "eula_accepted": True
                })
            elif isinstance(start_result, dict):
                if start_result.get("status") == "already running":
                    return JSONResponse(content={
                        "message": "Server created and is running!",
                        "server_name": servername,
                        "port": port,
                        "status": "running",
                        "eula_accepted": True
                    })
                elif start_result.get("status") in ["started", "booting"]:
                    return JSONResponse(content={
                        "message": "Server created and started successfully!",
                        "server_name": servername,
                        "port": port,
                        "status": start_result.get("status", "starting"),
                        "eula_accepted": True
                    })
                else:
                    return JSONResponse(content={
                        "message": "Server created successfully! Please start it manually.",
                        "server_name": servername,
                        "port": port,
                        "status": "created",
                        "eula_accepted": True
                    })
            else:
                return JSONResponse(content={
                    "message": "Server created and started successfully!",
                    "server_name": servername,
                    "port": port,
                    "status": "starting",
                    "eula_accepted": True
                })
        except Exception as e:
            logging.error(f"Start error: {e}")
            return JSONResponse(content={
                "message": "Server created successfully! Please start it manually from the control panel.",
                "server_name": servername,
                "port": port,
                "status": "created",
                "eula_accepted": True
            })
    else:
        return JSONResponse(content={
            "message": "Server created successfully. Please accept the EULA and start manually.",
            "server_name": servername,
            "port": port,
            "eula_required": True
        })

@router.post("/server/create")
def create_server(
    background_tasks: BackgroundTasks,
    servername: str = Form(...),
    purpur_url: str = Form(...),
    ram: str = Form(default="2048"),
    current_user: dict = Depends(get_current_user)
):
    import json
    # 1. Validierung Servername und RAM
    if not is_valid_servername(servername):
        raise HTTPException(status_code=400, detail="Invalid servername")
    try:
        ram_int = int(ram)
        if ram_int < 512 or ram_int > 8192:
            raise HTTPException(status_code=400, detail="RAM must be between 512MB and 8192MB")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid RAM value")

    # 2. Port allocation - use dynamic allocation
    port = port_allocator.allocate_port(servername)
    if port is None:
        raise HTTPException(status_code=500, detail="No available ports for server creation")
    logging.info(f"Auto-allocated port {port} for server {servername}")

    # 3. Zielordner anlegen (vor jeglicher weiterer Aktion!)
    mc_servers_dir = os.environ.get("MC_SERVERS_DIR", os.path.join(os.getcwd(), "mc_servers"))
    base_path = os.path.abspath(os.path.join(mc_servers_dir, servername))
    try:
        os.makedirs(base_path, exist_ok=True)
    except Exception as e:
        logging.error(f"Could not create server directory {base_path}: {e}")
        raise HTTPException(status_code=500, detail="Could not create server directory.")

    # 3. Download purpur.jar
    jar_path = os.path.join(base_path, "purpur.jar")
    try:
        curl_cmd = ["curl", "-L", "-o", jar_path, purpur_url]
        result = subprocess.run(curl_cmd, capture_output=True, text=True)
        if result.returncode != 0 or not os.path.exists(jar_path):
            logging.error(f"curl Fehler: {result.stderr}")
            raise HTTPException(status_code=500, detail="Download failed.")
        if os.name != "nt":
            try:
                os.chmod(jar_path, 0o755)
            except Exception as chmod_err:
                logging.warning(f"chmod für purpur.jar fehlgeschlagen: {chmod_err}")
    except Exception as e:
        logging.error(f"Download/Write error: {e}")
        raise HTTPException(status_code=500, detail="Download failed.")

    # 4. RAM-Konfiguration speichern
    try:
        save_server_config(servername, ram)
    except Exception as e:
        logging.error(f"Failed to save RAM config: {e}")
        raise HTTPException(status_code=500, detail="Failed to save RAM config.")

    # 5. Initial-Run für EULA-Generierung
    eula_path = safe_server_path(servername, "eula.txt")
    try:
        logging.info(f"Starting initial run for server {servername} with {ram}MB RAM")
        process = subprocess.Popen([
            "java", f"-Xmx{ram}M", "-jar", "purpur.jar", "nogui"
        ], cwd=base_path, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        import time
        time.sleep(10)
        try:
            process.stdin.write("stop\n")
            process.stdin.flush()
            process.wait(timeout=10)
            logging.info(f"Initial run completed gracefully for {servername}")
        except Exception:
            process.kill()
            process.wait()
            logging.info(f"Initial run force-killed for {servername}")
        # EULA-Datei prüfen/erstellen
        if not os.path.exists(eula_path):
            with open(eula_path, "w") as f:
                f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                f.write("eula=false\n")
            logging.info(f"Created default EULA file for {servername}")
    except Exception as e:
        logging.error(f"Initial run/EULA error: {e}")
        # Fallback: EULA-Datei anlegen
        try:
            with open(eula_path, "w") as f:
                f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                f.write("eula=false\n")
            logging.info(f"Created fallback EULA file for {servername}")
        except Exception as e2:
            logging.error(f"Could not create fallback EULA: {e2}")

    # 6. Server starten (optional, Backend-Lösung)
    try:
        start_result = start_server_internal(servername, current_user)
        if isinstance(start_result, dict) and start_result.get("status") == "already running":
            return JSONResponse(content={"message": "Server created and already running.", "port": port})
        elif isinstance(start_result, dict) and start_result.get("error"):
            return JSONResponse(content={"message": "Server created, but failed to start.", "port": port})
        else:
            return JSONResponse(content={"message": "Server created and started.", "port": port})
    except Exception as e:
        logging.error(f"Start error: {e}")
        return JSONResponse(content={"message": "Server created, but failed to start automatically. Please accept the EULA and start the server manually.", "port": port})

@router.post("/server/accept_eula")
def accept_eula(servername: str = Form(...), current_user: dict = Depends(get_current_user)):
    # Check if server directory exists
    server_dir = safe_server_path(servername)
    if not os.path.exists(server_dir):
        raise HTTPException(status_code=404, detail="Server directory not found")
    
    eula_path = safe_server_path(servername, "eula.txt")
    if not os.path.exists(eula_path):
        raise HTTPException(status_code=404, detail="eula.txt not found")
    
    with open(eula_path, "r") as f:
        lines = f.readlines()
    with open(eula_path, "w") as f:
        for line in lines:
            if line.startswith("eula="):
                f.write("eula=true\n")
            else:
                f.write(line)
    return {"message": "EULA accepted"}

@router.delete("/server/delete")
def delete_server(servername: str, current_user: dict = Depends(get_current_user)):
    base_path = safe_server_path(servername)
    if not os.path.exists(base_path):
        raise HTTPException(status_code=404, detail="Server not found")
    
    # HAProxy Konfiguration entfernen
    try:
        proxy_success = proxy_manager.remove_server_proxy(servername)
        if proxy_success:
            logging.info(f"Removed HAProxy configuration for {servername}")
        else:
            logging.warning(f"Failed to remove HAProxy configuration for {servername}")
    except Exception as e:
        logging.warning(f"HAProxy cleanup failed for {servername}: {e}")
        # Dies ist nicht kritisch für die Server-Löschung
    
    try:
        shutil.rmtree(base_path)
        return { "message": f"Server '{servername}' deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting server: {e}")
    
@router.get("/server/list")
def list_servers_full(current_user: dict = Depends(get_current_user)):
    base_dir = "/app/mc_servers"
    servers = []
    if not os.path.exists(base_dir):
        return {"servers":[]}
    for d in os.listdir(base_dir):
        if not os.path.isdir(os.path.join(base_dir, d)):
            continue
        prop_path = safe_server_path(d, "server.properties")
        port = "25565"
        if os.path.exists(prop_path):
            with open(prop_path, "r") as f:
                for line in f:
                    if line.strip().startswith("server-port="):
                        port = line.strip().split("=", 1)[1]
                        break
        status = "running" if get_server_proc(d) else "stopped"
        servers.append({
            "name": d,
            "port": port,
            "address": f"{socket.gethostbyname(socket.gethostname())}:{port}",
            "status": status
        })
    return {"servers": servers}

@router.get("/server/properties")
def get_properties(servername: str, current_user: dict = Depends(get_current_user)):
    prop_path = safe_server_path(servername, "server.properties")
    if not os.path.exists(prop_path):
        raise HTTPException(status_code=404, detail="server.properties not found")
    props = {}
    with open(prop_path, "r") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                props[k] = v
    return props


@router.get("/server/properties/get")
def get_world_properties(servername: str, current_user: dict = Depends(get_current_user)):
    """
    Return a small set of world-related properties for the frontend World Settings dialog.
    Fields: seed (level-seed), nether_end (derived from allow-nether and allow-end), difficulty
    """
    prop_path = safe_server_path(servername, "server.properties")
    if not os.path.exists(prop_path):
        raise HTTPException(status_code=404, detail="server.properties not found")
    props = {}
    with open(prop_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                props[k] = v

    seed = props.get("level-seed", "")
    # allow-nether and allow-end are strings like 'true'/'false'
    allow_nether = props.get("allow-nether", "true").lower() == "true"
    allow_end = props.get("allow-end", "true").lower() == "true"
    # We'll expose a single boolean indicating whether both dimensions are enabled
    nether_end = allow_nether and allow_end
    difficulty = props.get("difficulty", "normal")

    return {"seed": seed, "nether_end": nether_end, "difficulty": difficulty}

@router.post("/server/properties/set")
def set_property(
    servername: str = Form(...),
    key: str = Form(...),
    value: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    prop_path = safe_server_path(servername, "server.properties")
    if not os.path.exists(prop_path):
        raise HTTPException(status_code=404, detail="server.properties not found")
    lines = []
    found = False
    with open(prop_path, "r") as f:
        for line in f:
            if line.strip().startswith(f"{key}="):
                lines.append(f"{key}={value}\n")
                found = True
            else:
                lines.append(line)
    if not found:
        lines.append(f"{key}={value}\n")
    with open(prop_path, "w") as f:
        f.writelines(lines)
    return {"message": f"{key} set to {value}"}

@router.get("/server/log")
def get_log(servername: str, lines: int = 50, current_user: dict = Depends(get_current_user)):
    log_path = safe_server_path(servername, "logs", "latest.log")
    if not os.path.exists(log_path):
        return {"log": ""}
    with open(log_path, "r") as f:
        content = f.readlines()
    return {"log": "".join(content[-lines:])}

@router.get("/server/plugins")
def list_plugins(servername: str, current_user: dict = Depends(get_current_user)):
    plugin_dir = safe_server_path(servername, "plugins")
    if not os.path.exists(plugin_dir):
        return {"plugins": []}
    return {"plugins": [f for f in os.listdir(plugin_dir) if f.endswith(".jar")]}

# API: Server-Version abrufen
@router.get("/server/version")
def get_server_version(servername: str, current_user: dict = Depends(get_current_user)):
    log_path = safe_server_path(servername, "logs", "latest.log")
    if not os.path.exists(log_path):
        log_path = safe_server_path(servername, "server.log")
    version = None
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[-200:]
            for line in lines:
                if "Starting minecraft server version" in line:
                    m = re.search(r"Starting minecraft server version ([^\s]+)", line)
                    if m:
                        version = m.group(1)
                        # Purpur-Variante
                        if "Purpur" in line:
                            version += " Purpur"
                        break
        except Exception:
            pass
    return {"version": version}
@router.delete("/server/plugins/delete")
def delete_plugin(servername: str, plugin: str, current_user: dict = Depends(get_current_user)):
    plugin_path = safe_server_path(servername, "plugins", plugin)
    if not os.path.exists(plugin_path):
        raise HTTPException(status_code=404, detail="Plugin not found")
    os.remove(plugin_path)
    return {"message": f"{plugin} deleted"}

@router.post("/server/kill")
def kill_server(servername: str, current_user: dict = Depends(get_current_user)):
    session = get_tmux_session(servername)
    pid = get_server_proc(servername)
    pid_file = get_pid_file(servername)
    if not pid:
        return {"status": "not running"}
    try:
        subprocess.run(["tmux", "kill-session", "-t", session], check=True)
        if os.path.exists(pid_file):
            os.remove(pid_file)
        return {"status": "killed"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/server/ops")
def get_server_ops(servername: str, current_user: dict = Depends(get_current_user)):
    """Get current server operators (admins) from ops.json"""
    import json
    try:
        ops_path = safe_server_path(servername, "ops.json")
        if os.path.exists(ops_path):
            with open(ops_path, "r", encoding="utf-8") as f:
                ops_data = json.load(f)
                return {"ops": ops_data}
        return {"ops": []}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/server/banned-players")
def get_server_banned_players(servername: str, current_user: dict = Depends(get_current_user)):
    """Get current banned players from banned-players.json"""
    import json
    try:
        banned_path = safe_server_path(servername, "banned-players.json")
        if os.path.exists(banned_path):
            with open(banned_path, "r", encoding="utf-8") as f:
                banned_data = json.load(f)
                return {"banned": banned_data}
        return {"banned": []}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/server/whitelist")
def get_server_whitelist(servername: str, current_user: dict = Depends(get_current_user)):
    """Get current whitelist from whitelist.json"""
    import json
    try:
        whitelist_path = safe_server_path(servername, "whitelist.json")
        if os.path.exists(whitelist_path):
            with open(whitelist_path, "r", encoding="utf-8") as f:
                whitelist_data = json.load(f)
                return {"whitelist": whitelist_data}
        return {"whitelist": []}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.post("/server/ops/set")
def set_server_ops(
    servername: str = Form(...),
    ops_data: str = Form(...),  # JSON string of admin UUIDs
    current_user: dict = Depends(get_current_user)
):
    """Set server operators (admins) in ops.json"""
    import json
    try:
        # Parse the ops data
        ops_list = json.loads(ops_data)
        
        # Create ops.json format
        ops_entries = []
        for op in ops_list:
            ops_entries.append({
                "uuid": op["uuid"],
                "name": op["name"],
                "level": 4,  # Full operator privileges
                "bypassesPlayerLimit": False
            })
        
        # Lade vorherige Admins VOR dem Überschreiben
        ops_path = safe_server_path(servername, "ops.json")
        old_ops = []
        if os.path.exists(ops_path):
            with open(ops_path, "r", encoding="utf-8") as f:
                try:
                    old_ops = json.load(f)
                except Exception:
                    old_ops = []

        # Schreibe neue ops.json
        with open(ops_path, "w") as f:
            json.dump(ops_entries, f, indent=2)

        logging.info(f"Updated ops.json for {servername} with {len(ops_entries)} operators")

        # Wenn Server läuft: entfernte Admins deoppen, neue Admins oppen
        if get_server_proc(servername):
            try:
                session = get_tmux_session(servername)

                old_names = set(o["name"] for o in old_ops if "name" in o)
                new_names = set(o["name"] for o in ops_entries if "name" in o)

                logging.info(f"[DEBUG] Alte Admins: {old_names}")
                logging.info(f"[DEBUG] Neue Admins: {new_names}")
                logging.info(f"[DEBUG] Zu entfernen: {old_names - new_names}")
                logging.info(f"[DEBUG] Hinzuzufügen: {new_names - old_names}")

                # Deop für entfernte Admins
                for removed_name in old_names - new_names:
                    tmux_cmd = [
                        "tmux", "send-keys", "-t", session, f"deop {removed_name}", "C-m"
                    ]
                    logging.info(f"[DEBUG] Running tmux command: {' '.join(tmux_cmd)}")
                    try:
                        result = subprocess.run(tmux_cmd, capture_output=True, text=True)
                        logging.info(f"[DEBUG] tmux stdout: {result.stdout}")
                        logging.info(f"[DEBUG] tmux stderr: {result.stderr}")
                        if result.returncode != 0:
                            logging.error(f"[ERROR] tmux deop command failed for {removed_name} (rc={result.returncode})")
                    except Exception as e:
                        logging.error(f"[ERROR] Exception beim Senden von deop an tmux: {e}")
                    logging.info(f"Sent deop command for player {removed_name}")

                # Op nur für wirklich neue Admins (die vorher nicht drin waren)
                for added_name in new_names - old_names:
                    tmux_cmd = [
                        "tmux", "send-keys", "-t", session, f"op {added_name}", "C-m"
                    ]
                    logging.info(f"[DEBUG] Running tmux command: {' '.join(tmux_cmd)}")
                    try:
                        result = subprocess.run(tmux_cmd, capture_output=True, text=True)
                        logging.info(f"[DEBUG] tmux stdout: {result.stdout}")
                        logging.info(f"[DEBUG] tmux stderr: {result.stderr}")
                        if result.returncode != 0:
                            logging.error(f"[ERROR] tmux op command failed for {added_name} (rc={result.returncode})")
                    except Exception as e:
                        logging.error(f"[ERROR] Exception beim Senden von op an tmux: {e}")
                    logging.info(f"Sent op command for player {added_name}")

                # Reload für Sicherheit
                tmux_cmd = [
                    "tmux", "send-keys", "-t", session, "reload", "C-m"
                ]
                logging.info(f"[DEBUG] Running tmux command: {' '.join(tmux_cmd)}")
                try:
                    result = subprocess.run(tmux_cmd, capture_output=True, text=True)
                    logging.info(f"[DEBUG] tmux stdout: {result.stdout}")
                    logging.info(f"[DEBUG] tmux stderr: {result.stderr}")
                    if result.returncode != 0:
                        logging.error(f"[ERROR] tmux reload command failed (rc={result.returncode})")
                except Exception as e:
                    logging.error(f"[ERROR] Exception beim Senden von reload an tmux: {e}")
                logging.info(f"Sent reload command for ops in server {servername}")
            except Exception as e:
                logging.error(f"[ERROR] Fehler im tmux-Admin-Update: {e}")
        else:
            # Server offline: Nur Listen aktualisieren, keine tmux-Kommandos
            old_names = set(o["name"] for o in old_ops if "name" in o)
            new_names = set(o["name"] for o in ops_entries if "name" in o)
            logging.info(f"[DEBUG] (OFFLINE) Alte Admins: {old_names}")
            logging.info(f"[DEBUG] (OFFLINE) Neue Admins: {new_names}")
            logging.info(f"[DEBUG] (OFFLINE) Zu entfernen: {old_names - new_names}")
            logging.info(f"[DEBUG] (OFFLINE) Hinzuzufügen: {new_names - old_names}")
            logging.info(f"[DEBUG] Server offline, nur ops.json aktualisiert für {servername}")

        return {"message": f"Successfully updated {len(ops_entries)} operators"}
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in ops_data")
    except Exception as e:
        logging.error(f"Error setting ops for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/server/banned-players/set")
def set_banned_players(
    servername: str = Form(...),
    banned_data: str = Form(...),  # JSON string of banned player UUIDs
    current_user: dict = Depends(get_current_user)
):
    """Set banned players in banned-players.json"""
    import json
    from datetime import datetime
    try:
        logging.info(f"set_banned_players called by user: {current_user.get('username', 'unknown')}")
        logging.info(f"Form data: servername={servername}, banned_data={banned_data}")
        
        # Parse the banned data
        banned_list = json.loads(banned_data)
        logging.info(f"Parsed banned_list: {banned_list}")
        
        # Load current banned players list for comparison
        banned_path = safe_server_path(servername, "banned-players.json")
        current_banned = []
        try:
            with open(banned_path, "r") as f:
                current_banned = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            logging.info(f"No existing banned-players.json found for {servername}, starting fresh")
        
        # Create banned-players.json format
        banned_entries = []
        for banned in banned_list:
            banned_entries.append({
                "uuid": banned["uuid"],
                "name": banned["name"],
                "created": datetime.now().strftime("%Y-%m-%d %H:%M:%S +0000"),
                "source": "Server",
                "expires": "forever",
                "reason": "Banned by admin"
            })
        
        # Compare and log changes
        current_banned_names = {entry.get("name") for entry in current_banned if entry.get("name")}
        new_banned_names = {entry.get("name") for entry in banned_entries if entry.get("name")}
        
        added_bans = new_banned_names - current_banned_names
        removed_bans = current_banned_names - new_banned_names
        
        if added_bans:
            logging.info(f"Adding bans for players: {', '.join(added_bans)}")
        if removed_bans:
            logging.info(f"Removing bans for players: {', '.join(removed_bans)}")
        if not added_bans and not removed_bans:
            logging.info("No changes to banned players list")
        
        # Write to banned-players.json
        with open(banned_path, "w") as f:
            json.dump(banned_entries, f, indent=2)
        logging.info(f"Updated banned-players.json for {servername} with {len(banned_entries)} banned players")
        
        # Check if server is running
        is_running = get_server_proc(servername) is not None
        logging.info(f"Server {servername} is {'running' if is_running else 'offline'}")
        
        # If server is running, apply changes via tmux commands
        if is_running and (added_bans or removed_bans):
            try:
                session = get_tmux_session(servername)
                logging.info(f"Applying banned players changes to running server {servername}")
                
                # Unban removed players
                for player_name in removed_bans:
                    subprocess.run([
                        "tmux", "send-keys", "-t", session, 
                        f"pardon {player_name}", "Enter"
                    ], check=True)
                    logging.info(f"Sent pardon command for player {player_name}")
                
                # Ban added players
                for player_name in added_bans:
                    subprocess.run([
                        "tmux", "send-keys", "-t", session, 
                        f"ban {player_name} Banned by admin", "Enter"
                    ], check=True)
                    logging.info(f"Sent ban command for player {player_name}")
                    
                    # Kick if currently online
                    subprocess.run([
                        "tmux", "send-keys", "-t", session, 
                        f"kick {player_name} You have been banned from this server", "Enter"
                    ], check=True)
                    logging.info(f"Sent kick command for banned player {player_name}")
                
                # Reload banlist to ensure consistency
                subprocess.run([
                    "tmux", "send-keys", "-t", session, 
                    "banlist reload", "Enter"
                ], check=True)
                logging.info(f"Sent banlist reload command for running server {servername}")
                
            except Exception as e:
                logging.warning(f"Failed to apply banned players changes to running server {servername}: {e}")
                # Still return success since file was updated
        
        return {"message": f"Successfully updated {len(banned_entries)} banned players"}
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in banned_data")
    except Exception as e:
        logging.error(f"Error setting banned players for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/server/whitelist/set")
def set_whitelist(
    servername: str = Form(...),
    whitelist_data: str = Form(...),  # JSON string of whitelisted player UUIDs
    current_user: dict = Depends(get_current_user)
):
    """Set whitelisted players in whitelist.json"""
    import json
    try:
        logging.info(f"set_whitelist called by user: {current_user.get('username', 'unknown')}")
        logging.info(f"Form data: servername={servername}, whitelist_data={whitelist_data}")
        
        # Parse the whitelist data
        whitelist_list = json.loads(whitelist_data)
        logging.info(f"Parsed whitelist_list: {whitelist_list}")
        
        # Load current whitelist for comparison
        whitelist_path = safe_server_path(servername, "whitelist.json")
        current_whitelist = []
        try:
            with open(whitelist_path, "r") as f:
                current_whitelist = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            logging.info(f"No existing whitelist.json found for {servername}, starting fresh")
        
        # Create whitelist.json format
        whitelist_entries = []
        for player in whitelist_list:
            whitelist_entries.append({
                "uuid": player["uuid"],
                "name": player["name"]
            })
        
        # Compare and log changes
        current_whitelist_names = {entry.get("name") for entry in current_whitelist if entry.get("name")}
        new_whitelist_names = {entry.get("name") for entry in whitelist_entries if entry.get("name")}
        
        added_whitelist = new_whitelist_names - current_whitelist_names
        removed_whitelist = current_whitelist_names - new_whitelist_names
        
        if added_whitelist:
            logging.info(f"Adding to whitelist: {', '.join(added_whitelist)}")
        if removed_whitelist:
            logging.info(f"Removing from whitelist: {', '.join(removed_whitelist)}")
        if not added_whitelist and not removed_whitelist:
            logging.info("No changes to whitelist")
        
        # Write to whitelist.json
        with open(whitelist_path, "w") as f:
            json.dump(whitelist_entries, f, indent=2)
        logging.info(f"Updated whitelist.json for {servername} with {len(whitelist_entries)} whitelisted players")
        
        # Check if server is running
        is_running = get_server_proc(servername) is not None
        logging.info(f"Server {servername} is {'running' if is_running else 'offline'}")
        
        # If server is running, apply changes via tmux commands
        if is_running and (added_whitelist or removed_whitelist):
            try:
                session = get_tmux_session(servername)
                logging.info(f"Applying whitelist changes to running server {servername}")
                
                # Remove players from whitelist
                for player_name in removed_whitelist:
                    subprocess.run([
                        "tmux", "send-keys", "-t", session, 
                        f"whitelist remove {player_name}", "Enter"
                    ], check=True)
                    logging.info(f"Sent whitelist remove command for player {player_name}")
                
                # Add players to whitelist
                for player_name in added_whitelist:
                    subprocess.run([
                        "tmux", "send-keys", "-t", session, 
                        f"whitelist add {player_name}", "Enter"
                    ], check=True)
                    logging.info(f"Sent whitelist add command for player {player_name}")
                
                # Reload whitelist to ensure consistency
                subprocess.run([
                    "tmux", "send-keys", "-t", session, 
                    "whitelist reload", "Enter"
                ], check=True)
                logging.info(f"Sent whitelist reload command for running server {servername}")
                
            except Exception as e:
                logging.warning(f"Failed to apply whitelist changes to running server {servername}: {e}")
                # Still return success since file was updated
        
        return {"message": f"Successfully updated {len(whitelist_entries)} whitelisted players"}
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in whitelist_data")
    except Exception as e:
        logging.error(f"Error setting whitelist for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in whitelist_data")
    except Exception as e:
        logging.error(f"Error setting whitelist for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/server/properties/gamemode")
def set_gamemode(
    servername: str = Form(...),
    gamemode: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Set default gamemode in server.properties"""
    try:
        if gamemode not in ["survival", "creative", "adventure", "spectator"]:
            raise HTTPException(status_code=400, detail="Invalid gamemode")
        # If server is running, send the command to the server console via tmux
        if get_server_proc(servername):
            session = get_tmux_session(servername)
            logging.info(f"Server {servername} is running - sending gamemode commands via tmux")
            try:
                # Set the server default for future players
                cmd1 = ["tmux", "send-keys", "-t", session, f"defaultgamemode {gamemode}", "Enter"]
                result1 = subprocess.run(cmd1, capture_output=True, text=True)

                # Also change current players' gamemode immediately
                cmd2 = ["tmux", "send-keys", "-t", session, f"gamemode {gamemode} @a", "Enter"]
                result2 = subprocess.run(cmd2, capture_output=True, text=True)

                # ALWAYS update server.properties for persistence (even if tmux succeeds)
                set_property_in_properties(servername, "gamemode", gamemode)

                if result1.returncode == 0 and result2.returncode == 0:
                    return {"message": f"Gamemode applied to running server: {gamemode}"}
                else:
                    logging.warning(f"tmux commands had issues; server.properties updated for {servername}")
                    return {"message": f"Gamemode written to server.properties: {gamemode}"}
            except Exception as e:
                logging.error(f"Exception while running tmux commands for {servername}: {e}")
                # Best-effort: persist to server.properties
                try:
                    set_property_in_properties(servername, "gamemode", gamemode)
                except Exception as e2:
                    logging.error(f"Also failed to write server.properties fallback for {servername}: {e2}")
                raise HTTPException(status_code=500, detail=f"Failed to apply gamemode via tmux: {e}")

        # Server is offline - persist to server.properties
        set_property_in_properties(servername, "gamemode", gamemode)
        logging.info(f"Set gamemode to {gamemode} for {servername} (server offline)")
        return {"message": f"Gamemode set to {gamemode} in server.properties"}
    except Exception as e:
        logging.error(f"Error setting gamemode for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/server/properties/allow-cheats")
def set_allow_cheats(
    servername: str = Form(...),
    allow_cheats: bool = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Set allow cheats in server.properties"""
    try:
        set_property_in_properties(servername, "allow-cheats", "true" if allow_cheats else "false")
        logging.info(f"Set allow-cheats to {allow_cheats} for {servername}")
        
        # If server is running, apply the change via tmux as well
        if get_server_proc(servername):
            try:
                session = get_tmux_session(servername)
                # Send reload command to apply the change
                cmd = ["tmux", "send-keys", "-t", session, "reload", "Enter"]
                result = subprocess.run(cmd, capture_output=True, text=True)
                logging.info(f"tmux reload for cheats change rc={result.returncode}; stdout={result.stdout}; stderr={result.stderr}")
                if result.returncode == 0:
                    return {"message": f"Allow cheats set to {allow_cheats} and reloaded on running server"}
                else:
                    return {"message": f"Allow cheats set to {allow_cheats} in server.properties (reload failed, restart may be needed)"}
            except Exception as e:
                logging.error(f"Exception while reloading server for cheats change: {e}")
                return {"message": f"Allow cheats set to {allow_cheats} in server.properties (reload failed, restart may be needed)"}
        else:
            return {"message": f"Allow cheats set to {allow_cheats}"}
    except Exception as e:
        logging.error(f"Error setting allow-cheats for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/server/kick-player")
def kick_player(
    servername: str = Form(...),
    player_name: str = Form(...),
    reason: str = Form(default="Kicked by admin"),
    current_user: dict = Depends(get_current_user)
):
    """Kick a player from the server (immediate action)"""
    try:
        # Check if server is running
        if not get_server_proc(servername):
            raise HTTPException(status_code=400, detail="Server is not running")
        
        session = get_tmux_session(servername)
        kick_command = f"kick {player_name} {reason}"
        
        subprocess.run([
            "tmux", "send-keys", "-t", session, 
            kick_command, "Enter"
        ], check=True)
        
        logging.info(f"Kicked player {player_name} from {servername}: {reason}")
        return {"message": f"Player {player_name} has been kicked"}
    
    except Exception as e:
        logging.error(f"Error kicking player {player_name} from {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/server/command")
def run_server_command(
    servername: str = Form(...),
    command: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Execute an arbitrary server command in the server tmux session.

    Expects form data: servername, command
    Returns JSON with status and optional stdout/stderr if available.
    """
    try:
        # Ensure server is running
        if not get_server_proc(servername):
            raise HTTPException(status_code=400, detail="Server is not running")

        session = get_tmux_session(servername)
        # Try to capture current pane text so we can detect any new output caused by the command.
        initial_text = ""
        try:
            out = subprocess.check_output(["tmux", "capture-pane", "-p", "-t", session, "-S", "-200"], cwd=safe_server_path(servername))
            initial_text = out.decode(errors="ignore")
        except Exception:
            # If capture fails, continue — we'll still send the command and possibly fall back to logs
            initial_text = ""

        # Send the command to tmux (Enter / C-m)
        tmux_cmd = ["tmux", "send-keys", "-t", session, command, "Enter"]
        logging.info(f"Running tmux command: {' '.join(tmux_cmd)}")
        try:
            result = subprocess.run(tmux_cmd, capture_output=True, text=True)
        except Exception as e:
            logging.error(f"Exception running tmux send-keys: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        if result.returncode != 0:
            logging.error(f"tmux send-keys returned rc={result.returncode}; stderr={result.stderr}")
            return JSONResponse(status_code=500, content={"error": "tmux send-keys failed", "stderr": result.stderr})

        # After sending, poll the tmux pane briefly for any new output produced by the server.
        appended_lines: list[str] = []
        try:
            # small polling loop: configurable via environment variables
            # COMMAND_POST_POLL_ITERATIONS (default 8)
            # COMMAND_POST_POLL_INTERVAL_MS (default 100)
            iterations = int(os.getenv('COMMAND_POST_POLL_ITERATIONS', '8'))
            interval_ms = int(os.getenv('COMMAND_POST_POLL_INTERVAL_MS', '100'))
            for _ in range(iterations):
                time.sleep(interval_ms / 1000.0)
                try:
                    out = subprocess.check_output(["tmux", "capture-pane", "-p", "-t", session, "-S", "-200"], cwd=safe_server_path(servername))
                    text = out.decode(errors="ignore")
                except Exception:
                    text = ""

                if text and text != initial_text:
                    # compute appended lines
                    old_lines = initial_text.splitlines()
                    new_lines = text.splitlines()
                    if len(new_lines) > len(old_lines):
                        appended = new_lines[len(old_lines):]
                    else:
                        appended = new_lines
                    appended_lines = appended
                    break
        except Exception:
            appended_lines = []

        resp = {"status": "sent", "command": command}
        if appended_lines:
            resp["outputLines"] = appended_lines
        return resp

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in run_server_command: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/server/command/output")
def get_console_output(servername: str, lines: int = 100, current_user: dict = Depends(get_current_user)):
    """Return the last `lines` of console output for the server.

    Tries to use `tmux capture-pane` for live consoles; falls back to reading
    `logs/latest.log` or `server.log` when tmux is not available or session not running.
    """
    # Validate servername
    if not is_valid_servername(servername):
        raise HTTPException(status_code=400, detail="Invalid servername")

    # Prefer live tmux output if session exists
    try:
        if get_server_proc(servername):
            session = get_tmux_session(servername)
            try:
                # Capture last `lines` lines from tmux pane
                out = subprocess.check_output(["tmux", "capture-pane", "-p", "-t", session, "-S", f"-{lines}"], cwd=safe_server_path(servername))
                text = out.decode(errors="ignore")
                return {"output": text}
            except subprocess.CalledProcessError as e:
                logging.warning(f"tmux capture-pane failed for {servername}: {e}")
            except FileNotFoundError:
                logging.warning("tmux not installed on system; falling back to log file")
            except Exception as e:
                logging.warning(f"tmux read error for {servername}: {e}")
    except Exception:
        # If get_server_proc or safe_server_path raises, ignore and fallback to logs
        pass

    # Fallback: read from server log files
    log_path = safe_server_path(servername, "logs", "latest.log")
    if not os.path.exists(log_path):
        log_path = safe_server_path(servername, "server.log")
    if not os.path.exists(log_path):
        return {"output": ""}

    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.readlines()
        return {"output": "".join(content[-lines:])}
    except Exception as e:
        logging.error(f"Failed to read log for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/server/plugins/upload")
def upload_plugin(servername: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    plugin_dir = safe_server_path(servername, "plugins")
    os.makedirs(plugin_dir, exist_ok=True)
    filename = os.path.basename(file.filename)
    # Path Traversal verhindern
    if not filename.endswith(".jar") or '/' in filename or '\\' in filename:
        raise HTTPException(status_code=400, detail="Only .jar files allowed")
    dest = safe_server_path(servername, "plugins", filename)
    if os.path.exists(dest):
        raise HTTPException(status_code=409, detail="Plugin already exists")
    try:
        with tempfile.NamedTemporaryFile(delete=False, dir=plugin_dir) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        shutil.move(tmp_path, dest)
        # Setze Ausführberechtigung für Plugin (Linux/WSL)
        try:
            if os.name != "nt":
                os.chmod(dest, 0o755)
        except Exception as chmod_err:
            logging.warning(f"chmod für Plugin fehlgeschlagen: {chmod_err}")
    except Exception:
        raise HTTPException(status_code=500, detail="Upload failed.")
    return JSONResponse(content={"message": f"{filename} uploaded"})

@router.get("/server/ram")
def get_server_ram_config(servername: str, current_user: dict = Depends(get_current_user)):
    """Get the RAM configuration for a specific server"""
    ram = get_server_ram(servername)
    return {"ram": ram}

@router.post("/server/ram/set")
def set_server_ram_config(
    servername: str = Form(...),
    ram: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Set the RAM configuration for a specific server"""
    try:
        ram_int = int(ram)
        if ram_int < 512 or ram_int > 8192:
            raise HTTPException(status_code=400, detail="RAM must be between 512MB and 8192MB")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid RAM value")
    
    save_server_config(servername, ram)
    return {"message": f"RAM set to {ram}MB for server {servername}"}

@router.post("/server/proxy/add")
def add_server_to_proxy(
    servername: str = Form(...),
    port: int = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Manually add a server to HAProxy configuration"""
    try:
        # Check if server exists
        server_dir = safe_server_path(servername)
        if not os.path.exists(server_dir):
            raise HTTPException(status_code=404, detail="Server not found")
        
        # Get port from server.properties if not provided
        if port is None:
            props_path = safe_server_path(servername, "server.properties")
            if os.path.exists(props_path):
                with open(props_path, "r") as f:
                    for line in f:
                        if line.strip().startswith("server-port="):
                            try:
                                port = int(line.strip().split("=", 1)[1])
                                break
                            except:
                                pass
            if port is None:
                port = 25565  # Default port
        
        # Add to HAProxy
        success, allocated_port = proxy_manager.add_server_proxy(servername, port)
        if success:
            # Update server.properties if port changed
            if allocated_port != port:
                set_server_port(servername, allocated_port)
                port = allocated_port
            
            return {
                "message": f"Server {servername} added to proxy on port {port}",
                "port": port,
                "success": True
            }
        else:
            return {
                "message": f"Failed to add server {servername} to proxy",
                "success": False
            }
    except Exception as e:
        logging.error(f"Error adding server {servername} to proxy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/server/proxy/remove")
def remove_server_from_proxy(
    servername: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Manually remove a server from HAProxy configuration"""
    try:
        success = proxy_manager.remove_server_proxy(servername)
        if success:
            return {
                "message": f"Server {servername} removed from proxy",
                "success": True
            }
        else:
            return {
                "message": f"Failed to remove server {servername} from proxy",
                "success": False
            }
    except Exception as e:
        logging.error(f"Error removing server {servername} from proxy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/server/proxy/status")
def get_proxy_status(current_user: dict = Depends(get_current_user)):
    """Get HAProxy configuration status"""
    try:
        active_servers = proxy_manager.get_active_servers()
        return {
            "active_servers": active_servers,
            "proxy_config_path": proxy_manager.config_path,
            "reload_script_path": proxy_manager.reload_script
        }
    except Exception as e:
        logging.error(f"Error getting proxy status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/server/seed/get")
def get_server_seed(servername: str, current_user: dict = Depends(get_current_user)):
    """Get the world seed for a Minecraft server"""
    import json
    import struct
    import gzip
    from pathlib import Path
    
    try:
        logging.info(f"Getting seed for server: {servername}")
        
        # Check if we have a cached seed first
        server_dir = safe_server_path(servername, "")
        seed_cache_path = os.path.join(server_dir, ".blockpanel_seed_cache.json")
        
        # Try to load cached seed
        cached_seed = None
        if os.path.exists(seed_cache_path):
            try:
                with open(seed_cache_path, "r") as f:
                    cache_data = json.load(f)
                    cached_seed = cache_data.get("seed")
                    cache_time = cache_data.get("timestamp", 0)
                    # Cache is valid for 24 hours
                    if time.time() - cache_time < 86400:
                        logging.info(f"Returning cached seed for {servername}: {cached_seed}")
                        return {"seed": cached_seed, "source": "cache"}
            except Exception as e:
                logging.warning(f"Failed to read seed cache: {e}")
        
        # Check if server is running and try to get seed via command
        is_running = get_server_proc(servername) is not None
        if is_running:
            try:
                session = get_tmux_session(servername)
                
                # Send seed command and capture output
                # We'll use a unique marker to identify our output
                marker = f"BLOCKPANEL_SEED_{int(time.time())}"
                
                # Send the seed command
                subprocess.run([
                    "tmux", "send-keys", "-t", session, 
                    f"say {marker}_START", "Enter"
                ], check=True)
                
                time.sleep(0.1)  # Small delay
                
                subprocess.run([
                    "tmux", "send-keys", "-t", session, 
                    "seed", "Enter"
                ], check=True)
                
                time.sleep(0.1)  # Small delay
                
                subprocess.run([
                    "tmux", "send-keys", "-t", session, 
                    f"say {marker}_END", "Enter"
                ], check=True)
                
                # Wait a bit for the command to execute
                time.sleep(1)
                
                # Try to read from the latest log file
                log_path = safe_server_path(servername, "logs/latest.log")
                if os.path.exists(log_path):
                    try:
                        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                            lines = f.readlines()
                        
                        # Look for the seed output between our markers
                        start_found = False
                        for line in reversed(lines[-100:]):  # Check last 100 lines
                            if f"{marker}_END" in line:
                                start_found = True
                                continue
                            if start_found and f"{marker}_START" in line:
                                break
                            if start_found and "Seed:" in line:
                                # Extract seed from line like "[INFO] Seed: [1234567890]"
                                import re
                                seed_match = re.search(r'Seed:\s*\[?(-?\d+)\]?', line)
                                if seed_match:
                                    seed = seed_match.group(1)
                                    logging.info(f"Got seed from running server {servername}: {seed}")
                                    
                                    # Cache the seed
                                    cache_data = {
                                        "seed": seed,
                                        "timestamp": time.time(),
                                        "source": "server_command"
                                    }
                                    with open(seed_cache_path, "w") as f:
                                        json.dump(cache_data, f)
                                    
                                    return {"seed": seed, "source": "server_command"}
                    except Exception as e:
                        logging.warning(f"Failed to read server log for seed: {e}")
                
                logging.info(f"Could not extract seed from server command output, falling back to level.dat")
                
            except Exception as e:
                logging.warning(f"Failed to get seed from running server: {e}")
        
        # Fallback: Read seed from level.dat file
        world_path = safe_server_path(servername, "world")
        level_dat_path = os.path.join(world_path, "level.dat")
        
        if not os.path.exists(level_dat_path):
            raise HTTPException(status_code=404, detail="World data not found (level.dat missing)")
        
        try:
            # Try to read level.dat using nbtlib
            try:
                import nbtlib
                with nbtlib.load(level_dat_path) as nbt_file:
                    seed = nbt_file.root["Data"]["WorldGenSettings"]["seed"].value
                    logging.info(f"Got seed from level.dat using nbtlib for {servername}: {seed}")
                    
                    # Cache the seed
                    cache_data = {
                        "seed": str(seed),
                        "timestamp": time.time(),
                        "source": "level_dat_nbtlib"
                    }
                    with open(seed_cache_path, "w") as f:
                        json.dump(cache_data, f)
                    
                    return {"seed": str(seed), "source": "level_dat"}
            except ImportError:
                logging.warning("nbtlib not available, trying manual parsing")
            except Exception as e:
                logging.warning(f"Failed to read level.dat with nbtlib: {e}")
            
            # Fallback: Manual NBT parsing (basic implementation)
            with open(level_dat_path, "rb") as f:
                # Skip gzip header and try to find seed
                data = f.read()
                
                # level.dat is gzip compressed
                try:
                    import gzip
                    with gzip.open(level_dat_path, "rb") as gz_file:
                        nbt_data = gz_file.read()
                        
                        # This is a very basic approach - look for "seed" string in the data
                        # and extract the 8-byte long that follows
                        seed_pos = nbt_data.find(b"seed")
                        if seed_pos != -1:
                            # Skip the string "seed" and its length indicator
                            # NBT format: tag type (1 byte) + name length (2 bytes) + name + data
                            # Look for the pattern and extract the long value
                            for i in range(seed_pos + 4, len(nbt_data) - 8):
                                try:
                                    # Try to extract an 8-byte signed long
                                    potential_seed = struct.unpack(">q", nbt_data[i:i+8])[0]
                                    # Validate that this looks like a reasonable seed
                                    if -9223372036854775808 <= potential_seed <= 9223372036854775807:
                                        logging.info(f"Got seed from manual level.dat parsing for {servername}: {potential_seed}")
                                        
                                        # Cache the seed
                                        cache_data = {
                                            "seed": str(potential_seed),
                                            "timestamp": time.time(),
                                            "source": "level_dat_manual"
                                        }
                                        with open(seed_cache_path, "w") as f:
                                            json.dump(cache_data, f)
                                        
                                        return {"seed": str(potential_seed), "source": "level_dat"}
                                except struct.error:
                                    continue
                except Exception as e:
                    logging.warning(f"Failed to decompress level.dat: {e}")
                    
        except Exception as e:
            logging.error(f"Failed to read level.dat file: {e}")
        
        # If we have a cached seed from before, return it even if it's old
        if cached_seed:
            logging.info(f"Returning old cached seed for {servername}: {cached_seed}")
            return {"seed": cached_seed, "source": "cache_fallback"}
        
        raise HTTPException(status_code=404, detail="Unable to determine world seed")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting seed for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/server/seed/cache/clear")
def clear_seed_cache(
    servername: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Clear the cached seed for a server"""
    try:
        server_dir = safe_server_path(servername, "")
        seed_cache_path = os.path.join(server_dir, ".blockpanel_seed_cache.json")
        
        if os.path.exists(seed_cache_path):
            os.remove(seed_cache_path)
            logging.info(f"Cleared seed cache for {servername}")
            return {"message": "Seed cache cleared"}
        else:
            return {"message": "No seed cache found"}
            
    except Exception as e:
        logging.error(f"Error clearing seed cache for {servername}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
