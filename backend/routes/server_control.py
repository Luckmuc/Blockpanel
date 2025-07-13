from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form
import subprocess
import os
from fastapi.responses import JSONResponse
import glob
import psutil
from auth import get_current_user
import requests
import shutil
import re
import socket
import tempfile
import shutil
import subprocess
import logging

router = APIRouter()

@router.get("/server/stats")
def server_stats(servername: str, current_user: dict = Depends(get_current_user)):
    # RAM allocation (from config)
    import time
    import locale as pylocale
    ram_allocated = get_server_ram(servername)
    # RAM usage (from process)
    pid = get_server_proc(servername)
    ram_used = None
    uptime = None
    if pid:
        try:
            p = psutil.Process(pid)
            ram_used = int(p.memory_info().rss / 1024 / 1024)  # MB
            uptime = int(time.time() - p.create_time())  # seconds
        except Exception:
            ram_used = None
            uptime = None
    # Plugins
    plugin_dir = safe_server_path(servername, "plugins")
    plugins = []
    if os.path.exists(plugin_dir):
        plugins = [f for f in os.listdir(plugin_dir) if f.endswith(".jar")]
    # Properties
    prop_path = safe_server_path(servername, "server.properties")
    props = {}
    if os.path.exists(prop_path):
        with open(prop_path, "r") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    props[k] = v
    # Player count (try to get from properties or logs)
    max_players = props.get("max-players")
    online_players = None
    # Try to parse from latest.log
    log_path = safe_server_path(servername, "logs", "latest.log")
    # Fallback: if logs/latest.log does not exist, use server.log
    if not os.path.exists(log_path):
        log_path = safe_server_path(servername, "server.log")
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[-100:]
            for line in reversed(lines):
                if "There are" in line and "of a max of" in line:
                    import re
                    m = re.search(r"There are (\d+)/(\d+) players", line)
                    if m:
                        online_players = int(m.group(1))
                        max_players = m.group(2)
                        break
        except Exception:
            pass
    # IP/Port
    port = props.get("server-port", "25565")
    address = f"{socket.gethostbyname(socket.gethostname())}:{port}"
    # Locale
    locale = props.get("language", pylocale.getdefaultlocale()[0] or "en_US")
    # Uptime (already calculated)
    # Logs (last 30 lines)
    logs = []
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            logs = f.readlines()[-30:]
    # Web link (address)
    web_link = f"http://{address}"
    return {
        "ram_allocated": ram_allocated,
        "ram_used": ram_used,
        "uptime": uptime,
        "plugins": plugins,
        "player_count": online_players,
        "max_players": max_players,
        "address": address,
        "port": port,
        "locale": locale,
        "logs": "".join(logs),
        "web_link": web_link
    }


from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form
import subprocess
import os
from fastapi.responses import JSONResponse
import glob
import psutil
from auth import get_current_user
import requests
import shutil
import re
import socket
import tempfile
import shutil
import subprocess
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
    return re.match(r'^[a-zA-Z0-9_-]+$', servername) is not None

def safe_server_path(servername: str, *paths):
    if not is_valid_servername(servername):
        raise HTTPException(status_code=400, detail="Invalid servername")
    base = os.path.abspath(f"/app/mc_servers/{servername}")
    full = os.path.abspath(os.path.join(base, *paths))
    if not full.startswith(base):
        raise HTTPException(status_code=400, detail="Invalid path")
    return full


# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s', 
    handlers=[
        logging.FileHandler("/app/mc_servers/backend.log"),
        logging.StreamHandler()
    ]
)

router = APIRouter()

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
    if get_server_proc(servername):
        return {"status": "already running"}
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
            return JSONResponse(status_code=500, content={"error": f"tmux/java Fehler: {result.stderr}"})
        out = subprocess.check_output([
            "tmux", "list-panes", "-t", session, "-F", "#{pane_pid}"
        ], cwd=base_path)
        pid = int(out.decode().strip())
        with open(pid_file, "w") as f:
            f.write(str(pid))
        logging.info(f"Server {servername} gestartet (PID {pid})")
        return {"status": "started"}
    except Exception as e:
        logging.error(f"Fehler beim Starten von {servername}: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")
    
    # Speichere die RAM-Konfiguration
    save_server_config(servername, ram)
    
    # Initial-Run um EULA-Datei zu generieren
    try:
        logging.info(f"Starting initial run for server {servername} with {ram}MB RAM")
        
        # Start Java process and let it run briefly to generate EULA
        process = subprocess.Popen([
            "java", f"-Xmx{ram}M", "-jar", "purpur.jar", "nogui"
        ], cwd=base_path, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Wait 10 seconds for server to start and generate files
        import time
        time.sleep(10)
        
        # Try to stop gracefully first
        try:
            process.stdin.write("stop\n")
            process.stdin.flush()
            # Wait max 10 more seconds for graceful shutdown
            process.wait(timeout=10)
            logging.info(f"Initial run completed gracefully for {servername}")
        except subprocess.TimeoutExpired:
            # Force kill if it doesn't stop
            process.kill()
            process.wait()
            logging.info(f"Initial run force-killed for {servername}")
        
        # Check if EULA file was created
        eula_path = safe_server_path(servername, "eula.txt")
        if os.path.exists(eula_path):
            logging.info(f"EULA file successfully created for {servername}")
        else:
            logging.warning(f"EULA file not found after initial run for {servername}")
            # Create a basic EULA file if it doesn't exist
            with open(eula_path, "w") as f:
                f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                f.write("eula=false\n")
            logging.info(f"Created default EULA file for {servername}")
            
    except Exception as e:
        logging.warning(f"Initial run failed for {servername}: {e}")
        # Create EULA file anyway so the process can continue
        eula_path = safe_server_path(servername, "eula.txt")
        try:
            with open(eula_path, "w") as f:
                f.write("#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n")
                f.write("#Mon Jan 01 00:00:00 UTC 2024\n")
                f.write("eula=false\n")
            logging.info(f"Created fallback EULA file for {servername}")
        except Exception as fallback_error:
            logging.error(f"Failed to create fallback EULA file for {servername}: {fallback_error}")
    
    # Versuche, den Server direkt zu starten (Backend-Lösung)
    try:
        from fastapi import Request
        # Starte den Server direkt nach Erstellung und EULA-Generierung
        start_result = start_server(servername, current_user)
        if isinstance(start_result, dict) and start_result.get("status") == "already running":
            return {"message": "Server created and already running."}
        elif isinstance(start_result, dict) and start_result.get("error"):
            return {"message": "Server created, but failed to start: " + start_result["error"]}
        else:
            return {"message": "Server created and started."}
    except Exception as e:
        # Falls Start fehlschlägt, trotzdem Erfolg für Erstellung melden
        return {"message": f"Server created, but failed to start automatically: {e}. Please accept the EULA and start the server manually."}

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
    if not filename.endswith(".jar"):
        raise HTTPException(status_code=400, detail="Only .jar files allowed")
    dest = safe_server_path(servername, "plugins", filename)
    if os.path.exists(dest):
        raise HTTPException(status_code=409, detail="Plugin already exists")
    try:
        with tempfile.NamedTemporaryFile(delete=False, dir=plugin_dir) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        shutil.move(tmp_path, dest)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    return {"message": f"{filename} uploaded"}

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
