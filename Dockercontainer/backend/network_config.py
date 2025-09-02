import json
import os
import socket
import subprocess
import sys
from pathlib import Path

class NetworkConfigManager:
    def __init__(self, config_path=None):
        if config_path is None:
            # Look for config in multiple locations
            possible_paths = [
                "config/app-config.json",
                "../config/app-config.json",
                os.path.join(os.path.dirname(__file__), "config", "app-config.json"),
                os.path.join(os.path.dirname(__file__), "..", "config", "app-config.json")
            ]
            
            self.config_path = None
            for path in possible_paths:
                if os.path.exists(path):
                    self.config_path = path
                    break
            
            if self.config_path is None:
                # Create default config
                self.config_path = "config/app-config.json"
                os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
                self.create_default_config()
        else:
            self.config_path = config_path
            
        self.config = self.load_config()
    
    def create_default_config(self):
        """Create a default configuration file"""
        default_config = {
            "autoStart": False,
            "networkAccess": "local",
            "publicAccess": False,
            "localIP": self.get_local_ip(),
            "routerIP": "localhost",
            "installDate": ""
        }
        
        with open(self.config_path, 'w') as f:
            json.dump(default_config, f, indent=2)
    
    def load_config(self):
        """Load configuration from file"""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.create_default_config()
            with open(self.config_path, 'r') as f:
                return json.load(f)
    
    def save_config(self):
        """Save current configuration to file"""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def get_local_ip(self):
        """Get the local IP address"""
        try:
            # Connect to a remote address to get local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"
    
    def get_public_ip(self):
        """Get the public IP address"""
        try:
            import requests
            response = requests.get('http://ipinfo.io/ip', timeout=5)
            return response.text.strip()
        except Exception:
            return None
    
    def get_host_binding(self):
        """Get the appropriate host binding based on network configuration"""
        network_access = self.config.get("networkAccess", "local")
        
        if network_access == "local":
            return "127.0.0.1"  # Localhost only
        elif network_access == "network":
            return "0.0.0.0"    # All network interfaces (local network)
        elif network_access == "public":
            return "0.0.0.0"    # All network interfaces (public access)
        else:
            return "127.0.0.1"  # Default to localhost
    
    def get_allowed_origins(self):
        """Get allowed CORS origins based on network configuration"""
        network_access = self.config.get("networkAccess", "local")
        origins = ["http://localhost:1105", "http://127.0.0.1:1105"]
        
        if network_access in ["network", "public"]:
            local_ip = self.config.get("localIP", self.get_local_ip())
            origins.extend([
                f"http://{local_ip}:1105",
                f"http://{local_ip}:5173"  # For development
            ])
            
            # Add common local network ranges
            for i in range(1, 255):
                origins.append(f"http://192.168.1.{i}:1105")
                origins.append(f"http://192.168.0.{i}:1105")
        
        if network_access == "public":
            router_ip = self.config.get("routerIP")
            if router_ip and router_ip != "localhost":
                origins.append(f"http://{router_ip}:1105")
        
        return origins
    
    def get_server_access_info(self):
        """Get information about how servers can be accessed"""
        network_access = self.config.get("networkAccess", "local")
        local_ip = self.config.get("localIP", self.get_local_ip())
        router_ip = self.config.get("routerIP", "localhost")
        
        access_info = {
            "local": {
                "web_interface": "http://localhost:1105",
                "minecraft_servers": "localhost:25565-25575"
            }
        }
        
        if network_access in ["network", "public"]:
            access_info["network"] = {
                "web_interface": f"http://{local_ip}:1105",
                "minecraft_servers": f"{local_ip}:25565-25575"
            }
        
        if network_access == "public" and router_ip != "localhost":
            access_info["public"] = {
                "web_interface": f"http://{router_ip}:1105",
                "minecraft_servers": f"{router_ip}:25565-25575"
            }
        
        return access_info

# Global configuration manager instance
config_manager = None

def get_config_manager():
    """Get the global configuration manager instance"""
    global config_manager
    if config_manager is None:
        config_manager = NetworkConfigManager()
    return config_manager

def apply_network_configuration():
    """Apply network configuration from installer settings"""
    manager = get_config_manager()
    return manager

if __name__ == "__main__":
    # Command line interface for testing
    if len(sys.argv) > 1:
        if sys.argv[1] == "info":
            manager = get_config_manager()
            print("Current Configuration:")
            print(json.dumps(manager.config, indent=2))
            print("\nAccess Information:")
            print(json.dumps(manager.get_server_access_info(), indent=2))
        elif sys.argv[1] == "apply":
            apply_network_configuration()
            print("Network configuration applied")
    else:
        print("Usage: python network_config.py [info|apply]")
