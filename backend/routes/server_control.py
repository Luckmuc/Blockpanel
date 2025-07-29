from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form
from auth import get_current_user
import subprocess
import os
from fastapi.responses import JSONResponse
import glob
import psutil
import requests
import shutil
import re

router = APIRouter()
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form
from auth import get_current_user
import subprocess
import os
from fastapi.responses import JSONResponse
import glob
import psutil
import requests
import shutil
import re



@router.get("/server/uptime")
def get_server_uptime(servername: str, current_user: dict = Depends(get_current_user)):
    """Get the uptime (in seconds) for a running server."""
    pid = get_server_proc(servername)
    if not pid:
        return {"uptime": 0}
    try:
        p = psutil.Process(pid)
        uptime = int((__import__('time').time() - p.create_time()))
        return {"uptime": uptime}
    except Exception as e:
        return {"uptime": 0, "error": str(e)}

@router.get("/server/tmux")
def get_tmux_output(servername: str, current_user: dict = Depends(get_current_user)):
    """Get the tmux session output for a server."""
    session = get_tmux_session(servername)
    try:
        out = subprocess.check_output(["tmux", "capture-pane", "-t", session, "-p"], cwd=safe_server_path(servername))
        return {"output": out.decode(errors="ignore")}
    except Exception as e:
        return {"output": f"Error: {str(e)}"}
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
    if not servername or '/' in servername or '\\' in servername:
        return False
    return re.match(r'^[a-zA-Z0-9_-]+$', servername) is not None

def safe_server_path(servername: str, *paths):
    if not is_valid_servername(servername):
        raise HTTPException(status_code=400, detail="Invalid servername")
    # Cross-platform base dir
    base_dir = os.environ.get("MC_SERVERS_DIR", os.path.join(os.getcwd(), "mc_servers"))
    base = os.path.abspath(os.path.join(base_dir, servername))
    full = os.path.abspath(os.path.join(base, *paths))
    if not full.startswith(base):
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

def save_server_config(servername: str, ram: str):
    """Save server configuration"""
    config_path = safe_server_path(servername, "server.config")
    try:
        with open(config_path, "w") as f:
            f.write(f"ram={ram}\n")
    except Exception as e:
        logging.error(f"Failed to save config for {servername}: {e}")

@router.post("/server/start")
def start_server(servername: str, current_user: dict = Depends(get_current_user)):
    # Prevent multiple servers from starting at once
    import time
    lock_file = safe_server_path(servername, "start.lock")
    if os.path.exists(lock_file):
        logging.warning(f"Start lock exists for {servername}, aborting start.")
        return {"status": "already starting"}
    if get_server_proc(servername):
        return {"status": "already running"}
    try:
        with open(lock_file, "w") as f:
            f.write("locked")
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
        return {"status": "not running"}
    try:
        subprocess.run(["tmux", "kill-session", "-t", session], check=True)
        if os.path.exists(pid_file):
            os.remove(pid_file)
        return {"status": "stopped"}
    except Exception as e:
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
def restart_server(servername: str, current_user: dict = Depends(get_current_user)):
    stop_response = stop_server(servername)
    if stop_response["status"] != "stopped":
        return stop_response
    start_response = start_server(servername)
    if start_response["status"] != "started":
        return start_response
    return {"status": "restarted"}

@router.post("/server/create")
def create_server(
    background_tasks: BackgroundTasks,
    servername: str = Form(...),
    purpur_url: str = Form(...),
    ram: str = Form(default="2048"),
    current_user: dict = Depends(get_current_user)
):
    if not is_valid_servername(servername):
        raise HTTPException(status_code=400, detail="Invalid servername")
    # RAM-Validierung
    try:
        ram_int = int(ram)
        if ram_int < 512 or ram_int > 8192:
            raise HTTPException(status_code=400, detail="RAM must be between 512MB and 8192MB")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid RAM value")
    base_path = safe_server_path(servername)
    jar_path = safe_server_path(servername, "purpur.jar")
    os.makedirs(base_path, exist_ok=True)
    try:
        with requests.get(purpur_url, stream=True, timeout=30) as r:
            r.raise_for_status()
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                for chunk in r.iter_content(chunk_size=8192):
                    tmp.write(chunk)
                tmp_path = tmp.name
        shutil.move(tmp_path, jar_path)
        # Setze Ausführberechtigung für purpur.jar (Linux/WSL)
        try:
            if os.name != "nt":
                os.chmod(jar_path, 0o755)
        except Exception as chmod_err:
            logging.warning(f"chmod für purpur.jar fehlgeschlagen: {chmod_err}")
    except Exception:
        # Keine internen Fehler an den Client
        raise HTTPException(status_code=500, detail="Download failed.")
    # Speichere die RAM-Konfiguration
    save_server_config(servername, ram)
    # Initial-Run um EULA-Datei zu generieren
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
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            logging.info(f"Initial run force-killed for {servername}")
        eula_path = safe_server_path(servername, "eula.txt")
        if not os.path.exists(eula_path):
            with open(eula_path, "w") as f:
                f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                f.write("eula=false\n")
            logging.info(f"Created default EULA file for {servername}")
    except Exception:
        # Keine internen Fehler an den Client
        eula_path = safe_server_path(servername, "eula.txt")
        try:
            with open(eula_path, "w") as f:
                f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                f.write("eula=false\n")
            logging.info(f"Created fallback EULA file for {servername}")
        except Exception:
            pass
    # Versuche, den Server direkt zu starten (Backend-Lösung)
    try:
        start_result = start_server(servername, current_user)
        if isinstance(start_result, dict) and start_result.get("status") == "already running":
            return JSONResponse(content={"message": "Server created and already running."})
        elif isinstance(start_result, dict) and start_result.get("error"):
            return JSONResponse(content={"message": "Server created, but failed to start."})
        else:
            return JSONResponse(content={"message": "Server created and started."})
    except Exception:
        return JSONResponse(content={"message": "Server created, but failed to start automatically. Please accept the EULA and start the server manually."})

@router.post("/server/accept_eula")
def accept_eula(servername: str = Form(...), current_user: dict = Depends(get_current_user)):
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

@router.post("/server/properties/set")
def set_property(servername: str, key: str, value: str, current_user: dict = Depends(get_current_user)):
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
def set_server_ram_config(servername: str, ram: str, current_user: dict = Depends(get_current_user)):
    """Set the RAM configuration for a specific server"""
    try:
        ram_int = int(ram)
        if ram_int < 512 or ram_int > 8192:
            raise HTTPException(status_code=400, detail="RAM must be between 512MB and 8192MB")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid RAM value")
    
    save_server_config(servername, ram)
    return {"message": f"RAM set to {ram}MB for server {servername}"}
