"""
Configuration manager for Blockpanel settings including network configuration and autostart
"""
import os
import json
import sys
import platform
from typing import Dict, Any, Optional
import winreg
from pathlib import Path

class BlockpanelConfig:
    def __init__(self):
        self.config_file = self._get_config_path()
        self.default_config = {
            "network": {
                "mode": "localhost",  # localhost, lan, public
                "bind_address": "127.0.0.1",
                "port": 8000,
                "cors_origins": ["http://localhost:1105", "http://127.0.0.1:1105", "http://localhost:3000", "http://127.0.0.1:3000"]
            },
            "autostart": {
                "enabled": False
            }
        }
    def set_network_mode(self, mode: str):
        if mode == "localhost":
            self.config["network"]["bind_address"] = "127.0.0.1"
        elif mode == "lan":
            self.config["network"]["bind_address"] = "0.0.0.0"
        elif mode == "public":
            self.config["network"]["bind_address"] = "0.0.0.0"
        self.config["network"]["mode"] = mode
        self.save_config()

    def set_autostart(self, enabled: bool):
        self.config["autostart"]["enabled"] = enabled
        self.save_config()

    def apply_autostart(self):
        import platform
        if platform.system() == "Windows":
            import winreg
            exe_path = sys.executable
            key = r"Software\Microsoft\Windows\CurrentVersion\Run"
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key, 0, winreg.KEY_SET_VALUE) as regkey:
                if self.config["autostart"]["enabled"]:
                    winreg.SetValueEx(regkey, "Blockpanel", 0, winreg.REG_SZ, exe_path)
                else:
                    try:
                        winreg.DeleteValue(regkey, "Blockpanel")
                    except FileNotFoundError:
                        pass

    def apply_firewall(self):
        import subprocess, platform
        if platform.system() == "Windows":
            port = self.config["network"]["port"]
            bind = self.config["network"]["bind_address"]
            # Web port
            subprocess.run(f'netsh advfirewall firewall add rule name="BlockpanelWeb" dir=in action=allow protocol=TCP localport={port}', shell=True)
            # MC ports
            subprocess.run('netsh advfirewall firewall add rule name="BlockpanelMC" dir=in action=allow protocol=TCP localport=25565-25575', shell=True)
    
    def _get_config_path(self) -> str:
        """Get the configuration file path"""
        if getattr(sys, 'frozen', False):
            # Running as compiled executable
            if platform.system() == 'Windows':
                config_dir = os.path.join(os.environ.get('APPDATA', ''), 'Blockpanel')
            else:
                config_dir = os.path.join(os.path.expanduser('~'), '.blockpanel')
        else:
            # Running as script
            config_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config')
        
        os.makedirs(config_dir, exist_ok=True)
        return os.path.join(config_dir, 'blockpanel_config.json')
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file or create default"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)
                # Merge with defaults to ensure all keys exist
                config = self.default_config.copy()
                for key in loaded_config:
                    if key in config and isinstance(config[key], dict):
                        config[key].update(loaded_config[key])
                    else:
                        config[key] = loaded_config[key]
                return config
            else:
                self.save_config(self.default_config)
                return self.default_config.copy()
        except Exception as e:
            print(f"Error loading config: {e}")
            return self.default_config.copy()
    
    def save_config(self, config: Optional[Dict[str, Any]] = None):
        """Save configuration to file"""
        if config is None:
            config = self.config
        
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            self.config = config
        except Exception as e:
            print(f"Error saving config: {e}")
    
    def update_network_config(self, mode: str, port: int = 8000):
        """Update network configuration"""
        if mode == "localhost":
            bind_address = "127.0.0.1"
            cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
        elif mode == "internal":
            bind_address = "0.0.0.0"
            cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.*:3000"]
        elif mode == "public":
            bind_address = "0.0.0.0"
            cors_origins = ["*"]  # Allow all origins for public access
        else:
            raise ValueError(f"Invalid network mode: {mode}")
        
        self.config["network"].update({
            "mode": mode,
            "bind_address": bind_address,
            "port": port,
            "cors_origins": cors_origins
        })
        self.save_config()
    
    def set_autostart(self, enabled: bool, startup_type: str = "user"):
        """Configure autostart setting"""
        self.config["autostart"].update({
            "enabled": enabled,
            "startup_type": startup_type
        })
        self.save_config()
        
        # Apply autostart setting on Windows
        if platform.system() == 'Windows':
            self._apply_windows_autostart(enabled, startup_type)
    
    def _apply_windows_autostart(self, enabled: bool, startup_type: str):
        """Apply autostart setting on Windows registry"""
        try:
            app_name = "Blockpanel"
            exe_path = self._get_executable_path()
            
            if startup_type == "user":
                key_path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
                root_key = winreg.HKEY_CURRENT_USER
            else:  # system
                key_path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
                root_key = winreg.HKEY_LOCAL_MACHINE
            
            if enabled:
                # Add to autostart
                with winreg.OpenKey(root_key, key_path, 0, winreg.KEY_SET_VALUE) as key:
                    winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, exe_path)
                print(f"Autostart enabled for {startup_type}")
            else:
                # Remove from autostart
                try:
                    with winreg.OpenKey(root_key, key_path, 0, winreg.KEY_SET_VALUE) as key:
                        winreg.DeleteValue(key, app_name)
                    print(f"Autostart disabled for {startup_type}")
                except FileNotFoundError:
                    pass  # Key doesn't exist, nothing to remove
                    
        except Exception as e:
            print(f"Error applying autostart setting: {e}")
    
    def _get_executable_path(self) -> str:
        """Get the path to the main executable"""
        if getattr(sys, 'frozen', False):
            return sys.executable
        else:
            # For development, return the python script path
            return f'"{sys.executable}" "{os.path.abspath(__file__)}"'
    
    def get_network_config(self) -> Dict[str, Any]:
        """Get current network configuration"""
        return self.config["network"].copy()
    
    def get_autostart_config(self) -> Dict[str, Any]:
        """Get current autostart configuration"""
        return self.config["autostart"].copy()

# Global configuration instance
_config_instance = None

def get_blockpanel_config() -> BlockpanelConfig:
    """Get the global configuration instance"""
    global _config_instance
    if _config_instance is None:
        _config_instance = BlockpanelConfig()
    return _config_instance

if __name__ == "__main__":
    import sys
    
    # Handle command line configuration setup
    config = get_blockpanel_config()
    
    # Parse command line arguments
    args = sys.argv[1:]
    network_mode = "localhost"
    enable_autostart = False
    startup_type = "user"
    
    for i, arg in enumerate(args):
        if arg == "--network-mode" and i + 1 < len(args):
            network_mode = args[i + 1]
        elif arg == "--enable-autostart":
            enable_autostart = True
        elif arg == "--startup-type" and i + 1 < len(args):
            startup_type = args[i + 1]
    
    # Apply configuration
    try:
        config.update_network_config(network_mode)
        print(f"Network configuration set to: {network_mode}")
        
        if enable_autostart:
            config.set_autostart(True, startup_type)
            print(f"Autostart enabled for {startup_type} level")
        
        print("Configuration setup completed successfully!")
        
    except Exception as e:
        print(f"Configuration setup failed: {e}")
        sys.exit(1)
