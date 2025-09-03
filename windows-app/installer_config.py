"""
Installer configuration script for Blockpanel
This script will be called during installation to set up initial configuration
"""
import os
import sys
import json
import winreg
from pathlib import Path

class BlockpanelInstaller:
    def __init__(self):
        self.app_name = "Blockpanel"
        self.config_dir = os.path.join(os.environ.get('APPDATA', ''), 'Blockpanel')
        self.config_file = os.path.join(self.config_dir, 'blockpanel_config.json')
        
    def setup_initial_config(self, network_mode="localhost", enable_autostart=False, startup_type="user"):
        """Setup initial configuration during installation"""
        print(f"Setting up Blockpanel with network mode: {network_mode}")
        
        # Create config directory
        os.makedirs(self.config_dir, exist_ok=True)
        
        # Create initial configuration based on network mode
        if network_mode == "localhost":
            bind_address = "127.0.0.1"
            cors_origins = ["http://localhost:8000", "http://127.0.0.1:8000"]
            network_description = "Localhost only - Most secure"
        elif network_mode == "local-network":
            bind_address = "0.0.0.0"
            cors_origins = ["http://localhost:8000", "http://127.0.0.1:8000", "http://192.168.*:8000", "http://10.*:8000", "http://172.*:8000"]
            network_description = "Local network access - WiFi/LAN users can access"
        elif network_mode == "public-internet":
            bind_address = "0.0.0.0"
            cors_origins = ["*"]
            network_description = "Public internet access - Requires port forwarding"
        elif network_mode == "internal":  # Legacy support
            bind_address = "0.0.0.0"
            cors_origins = ["http://localhost:8000", "http://127.0.0.1:8000", "http://192.168.*:8000"]
            network_description = "Internal network access"
        elif network_mode == "public":  # Legacy support
            bind_address = "0.0.0.0"
            cors_origins = ["*"]
            network_description = "Public access"
        else:
            raise ValueError(f"Invalid network mode: {network_mode}")
        
        config = {
            "network": {
                "mode": network_mode,
                "description": network_description,
                "bind_address": bind_address,
                "port": 8000,
                "cors_origins": cors_origins,
                "minecraft_port_range": {
                    "start": 25565,
                    "end": 25575
                }
            },
            "autostart": {
                "enabled": enable_autostart,
                "startup_type": startup_type,
                "description": "Start with Windows" if enable_autostart else "Manual startup"
            },
            "installer": {
                "version": "2.0.0",
                "redesigned": True,
                "install_date": self.get_current_timestamp()
            },
            "security": {
                "firewall_configured": network_mode != "localhost",
                "public_access_warning_shown": network_mode == "public-internet"
            },
            "logging": {
                "level": "INFO",
                "file_logging": True
            }
        }
        
        # Save configuration
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print(f"Configuration saved to: {self.config_file}")
        
        # Setup autostart if requested
        if enable_autostart:
            self.setup_autostart(startup_type)
            
        # Create user-friendly summary file
        self.create_installation_summary(network_mode, enable_autostart)
    
    def get_current_timestamp(self):
        """Get current timestamp for configuration"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def create_installation_summary(self, network_mode, enable_autostart):
        """Create a user-friendly installation summary"""
        summary_file = os.path.join(self.config_dir, 'installation_summary.txt')
        
        # Determine access information
        if network_mode == "localhost":
            access_info = "http://localhost:8000 (This computer only)"
            security_level = "🔒 High Security"
        elif network_mode == "local-network":
            access_info = "http://localhost:8000 or http://YOUR-LOCAL-IP:8000 (Local network)"
            security_level = "🏠 Medium Security"
        else:  # public-internet
            access_info = "http://YOUR-PUBLIC-IP:8000 (Internet - requires port forwarding)"
            security_level = "⚠️ Lower Security"
        
        startup_info = "✅ Enabled" if enable_autostart else "❌ Disabled"
        
        summary = f"""
=====================================
    BLOCKPANEL INSTALLATION SUMMARY
=====================================

📅 Installed: {self.get_current_timestamp()}
🔧 Configuration: Redesigned Installer v2.0

🌐 NETWORK ACCESS:
   Mode: {network_mode}
   Access URL: {access_info}
   Security Level: {security_level}

🚀 WINDOWS STARTUP:
   Auto-start: {startup_info}

📊 WEB PANEL:
   URL: http://localhost:8000
   Theme: Modern Material Design
   Features: Real-time monitoring, server management

🎮 MINECRAFT SERVERS:
   Port Range: 25565-25575
   Management: Full web-based control

⚙️ CONFIGURATION FILES:
   Main Config: {self.config_file}
   Log Location: {os.path.join(self.config_dir, 'logs')}

🔐 SECURITY NOTES:
   • Change default passwords after first login
   • Review firewall settings if using network access
   • Keep Blockpanel updated for security patches

📞 SUPPORT:
   GitHub: https://github.com/Luckmuc/Blockpanel
   Documentation: Available in web panel

Thank you for choosing Blockpanel!
=====================================
"""
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(summary.strip())
        
        print(f"Installation summary saved to: {summary_file}")

    def setup_autostart(self, startup_type="user"):
        """Setup autostart in Windows registry"""
        try:
            # Find the Blockpanel executable
            exe_path = self.find_blockpanel_exe()
            if not exe_path:
                print("Warning: Could not find Blockpanel executable for autostart setup")
                return
            
            if startup_type == "user":
                key_path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
                root_key = winreg.HKEY_CURRENT_USER
            else:  # system
                key_path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
                root_key = winreg.HKEY_LOCAL_MACHINE
            
            # Add to autostart
            with winreg.OpenKey(root_key, key_path, 0, winreg.KEY_SET_VALUE) as key:
                winreg.SetValueEx(key, self.app_name, 0, winreg.REG_SZ, exe_path)
            
            print(f"Autostart configured for {startup_type} level")
            
        except Exception as e:
            print(f"Error setting up autostart: {e}")
    
    def find_blockpanel_exe(self):
        """Find the Blockpanel executable"""
        # Common installation paths
        possible_paths = [
            os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs', 'Blockpanel', 'Blockpanel.exe'),
            os.path.join(os.environ.get('PROGRAMFILES', ''), 'Blockpanel', 'Blockpanel.exe'),
            os.path.join(os.environ.get('PROGRAMFILES(X86)', ''), 'Blockpanel', 'Blockpanel.exe'),
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        return None
    
    def remove_autostart(self):
        """Remove autostart entries"""
        for root_key in [winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE]:
            try:
                key_path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
                with winreg.OpenKey(root_key, key_path, 0, winreg.KEY_SET_VALUE) as key:
                    winreg.DeleteValue(key, self.app_name)
                print(f"Removed autostart entry from {'user' if root_key == winreg.HKEY_CURRENT_USER else 'system'} registry")
            except FileNotFoundError:
                pass  # Key doesn't exist
            except Exception as e:
                print(f"Error removing autostart: {e}")

def main():
    """Main installer configuration function"""
    installer = BlockpanelInstaller()
    
    # Parse command line arguments
    network_mode = "localhost"
    enable_autostart = False
    startup_type = "user"
    
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--network-mode" and i + 1 < len(args):
            network_mode = args[i + 1]
        elif arg == "--enable-autostart":
            enable_autostart = True
        elif arg == "--startup-type" and i + 1 < len(args):
            startup_type = args[i + 1]
        elif arg == "--remove-autostart":
            installer.remove_autostart()
            return
        elif arg == "--help":
            print("Blockpanel Installer Configuration")
            print("Usage: python installer_config.py [options]")
            print("Options:")
            print("  --network-mode <mode>     Network access mode: localhost, local-network, public-internet")
            print("  --enable-autostart        Enable Windows startup")
            print("  --startup-type <type>     Startup type: user, system")
            print("  --remove-autostart        Remove autostart entries")
            print("  --help                    Show this help message")
            return
    
    # Setup configuration
    installer.setup_initial_config(network_mode, enable_autostart, startup_type)
    print("Blockpanel installation configuration completed successfully!")

if __name__ == "__main__":
    main()
