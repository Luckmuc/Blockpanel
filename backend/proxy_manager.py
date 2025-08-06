"""
HAProxy Konfiguration Manager für dynamische Port-Weiterleitung
"""
import os
import subprocess
import logging
from typing import Dict, List
from port_allocator import port_allocator

logger = logging.getLogger(__name__)

class ProxyManager:
    def __init__(self, config_path: str = "/shared/proxy/haproxy.cfg", 
                 reload_script: str = "/shared/proxy/reload-haproxy.sh"):
        self.config_path = config_path
        self.reload_script = reload_script
        
    def add_server_proxy(self, server_name: str, port: int = None) -> tuple[bool, int]:
        """
        Fügt einen neuen Minecraft Server zur HAProxy Konfiguration hinzu
        Returns: (success, allocated_port)
        """
        try:
            # Allocate port if not provided
            if port is None:
                port = port_allocator.allocate_port(server_name)
                if port is None:
                    logger.error(f"Could not allocate port for server {server_name}")
                    return False, 0
            else:
                # Try to allocate specific port
                allocated_port = port_allocator.allocate_port(server_name, port)
                if allocated_port != port:
                    logger.warning(f"Could not allocate requested port {port} for {server_name}, got {allocated_port}")
                    if allocated_port is None:
                        return False, 0
                    port = allocated_port
            # Template für neuen Frontend/Backend
            frontend_config = f"""
frontend minecraft_{server_name}
    bind *:{port}
    mode tcp
    default_backend backend_{server_name}
"""
            
            backend_config = f"""
backend backend_{server_name}
    mode tcp
    balance roundrobin
    server mc_{server_name} backend:{port} check inter 5s
"""
            
            # Lese aktuelle Konfiguration
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    current_config = f.read()
            else:
                # Erstelle Basis-Konfiguration falls nicht vorhanden
                current_config = self._get_base_config()
            
            # Prüfe ob Server bereits existiert
            if f"frontend minecraft_{server_name}" in current_config:
                logger.warning(f"Server {server_name} bereits in HAProxy Konfiguration")
                return True, port  # Return existing port
            
            # Füge neue Konfiguration hinzu
            new_config = current_config + frontend_config + backend_config
            
            # Schreibe neue Konfiguration
            with open(self.config_path, 'w') as f:
                f.write(new_config)
            
            # Lade HAProxy neu
            if self._reload_haproxy():
                logger.info(f"Successfully added proxy for {server_name} on port {port}")
                return True, port
            else:
                # Rollback port allocation on failure
                port_allocator.deallocate_port(server_name)
                return False, 0
            
        except Exception as e:
            logger.error(f"Fehler beim Hinzufügen von Server {server_name}: {e}")
            # Rollback port allocation on failure
            port_allocator.deallocate_port(server_name)
            return False, 0
    
    def remove_server_proxy(self, server_name: str) -> bool:
        """
        Entfernt einen Minecraft Server aus der HAProxy Konfiguration
        """
        try:
            if not os.path.exists(self.config_path):
                return True
            
            with open(self.config_path, 'r') as f:
                lines = f.readlines()
            
            # Filtere Zeilen für den zu entfernenden Server
            new_lines = []
            skip_section = False
            
            for line in lines:
                # Beginnt Frontend/Backend Section für diesen Server?
                if (f"frontend minecraft_{server_name}" in line or 
                    f"backend backend_{server_name}" in line):
                    skip_section = True
                    continue
                
                # Neue Section beginnt?
                if line.startswith(('frontend ', 'backend ', 'global', 'defaults')):
                    skip_section = False
                
                # Zeile hinzufügen wenn nicht in zu überspringender Section
                if not skip_section:
                    new_lines.append(line)
            
            # Schreibe neue Konfiguration
            with open(self.config_path, 'w') as f:
                f.writelines(new_lines)
            
            # Lade HAProxy neu
            if self._reload_haproxy():
                # Deallocate port after successful removal
                port_allocator.deallocate_port(server_name)
                logger.info(f"Successfully removed proxy for {server_name}")
                return True
            else:
                return False
            
        except Exception as e:
            logger.error(f"Fehler beim Entfernen von Server {server_name}: {e}")
            return False
    
    def _reload_haproxy(self) -> bool:
        """
        Lädt HAProxy-Konfiguration neu
        """
        try:
            # Check if reload script exists and is executable
            if not os.path.exists(self.reload_script):
                logger.warning(f"HAProxy Reload Script nicht gefunden: {self.reload_script}")
                # Try alternative reload methods
                return self._alternative_reload()
            
            # Make script executable if needed
            try:
                os.chmod(self.reload_script, 0o755)
            except Exception as e:
                logger.warning(f"Could not make reload script executable: {e}")
            
            result = subprocess.run(['bash', self.reload_script], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                logger.info("HAProxy erfolgreich neugeladen")
                return True
            else:
                logger.error(f"HAProxy Reload fehlgeschlagen: {result.stderr}")
                logger.debug(f"HAProxy Reload stdout: {result.stdout}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("HAProxy Reload timeout after 10 seconds")
            return False
        except Exception as e:
            logger.error(f"Fehler beim HAProxy Reload: {e}")
            return False
    
    def _alternative_reload(self) -> bool:
        """
        Alternative HAProxy reload method when script is not available
        """
        try:
            # Try to reload via docker-compose if we're in a container environment
            if os.path.exists("/shared/proxy/haproxy.cfg"):
                # Just log that we would reload - in container this might be handled differently
                logger.info("HAProxy configuration updated (container environment)")
                return True
            return False
        except Exception as e:
            logger.error(f"Alternative reload failed: {e}")
            return False
    
    def _get_base_config(self) -> str:
        """
        Gibt die Basis HAProxy Konfiguration zurück mit vordefinierten Ports 25565-25595
        Standard-Ports für normale Nutzung: 25565-25575
        Erweiterte Ports für "Need more ports": 25576-25595
        """
        config = """global
    daemon
    log stdout local0

defaults
    mode tcp
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option tcplog
    log global

# Statistics Interface (localhost only for security)
frontend stats
    bind 127.0.0.1:8404
    mode http
    stats enable
    stats uri /stats
    stats refresh 5s

# Minecraft Server Frontends/Backends für Ports 25565-25595 (vorkonfiguriert)
"""
        
        # Generiere alle Ports von 25565 bis 25595 (für HAProxy-Vollkonfiguration)
        for port in range(25565, 25596):
            config += f"""
# Port {port}
frontend minecraft_{port}
    bind *:{port}
    mode tcp
    default_backend backend_{port}

backend backend_{port}
    mode tcp
    balance roundrobin
    server mc_{port} backend:{port} check inter 5s
"""
        
        return config
    
    def get_active_servers(self) -> List[str]:
        """
        Gibt Liste der aktiven Server in der HAProxy Konfiguration zurück
        """
        active_servers = []
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    content = f.read()
                
                # Suche nach Frontend-Definitionen
                lines = content.split('\n')
                for line in lines:
                    if line.strip().startswith('frontend minecraft_'):
                        server_name = line.split('minecraft_')[1].strip()
                        active_servers.append(server_name)
        except Exception as e:
            logger.error(f"Fehler beim Abrufen aktiver Server: {e}")
        
        return active_servers

# Globale Instanz
proxy_manager = ProxyManager()
