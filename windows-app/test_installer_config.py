#!/usr/bin/env python3
"""
Test script for the redesigned Blockpanel installer configuration
"""

import os
import sys
import json
import tempfile
import shutil
from pathlib import Path

# Add the project directory to the path so we can import the installer config
project_dir = Path(__file__).parent.parent
sys.path.insert(0, str(project_dir))

try:
    from installer_config import BlockpanelInstaller
except ImportError as e:
    print(f"❌ Could not import installer_config: {e}")
    sys.exit(1)

def test_network_configurations():
    """Test all network configuration modes"""
    print("🌐 Testing network configurations...")
    
    test_configs = [
        ("localhost", "Localhost only access"),
        ("local-network", "Local network access"),
        ("public-internet", "Public internet access"),
        ("internal", "Legacy internal mode"),
        ("public", "Legacy public mode")
    ]
    
    for network_mode, description in test_configs:
        print(f"  Testing {network_mode}: {description}")
        
        # Create temporary config directory for testing
        with tempfile.TemporaryDirectory() as temp_dir:
            installer = BlockpanelInstaller()
            installer.config_dir = temp_dir
            installer.config_file = os.path.join(temp_dir, 'test_config.json')
            
            try:
                installer.setup_initial_config(network_mode, False, "user")
                
                # Verify config file was created
                if not os.path.exists(installer.config_file):
                    print(f"    ❌ Config file not created for {network_mode}")
                    continue
                
                # Load and verify configuration
                with open(installer.config_file, 'r') as f:
                    config = json.load(f)
                
                # Basic validation
                assert 'network' in config
                assert 'autostart' in config
                assert 'installer' in config
                assert config['network']['mode'] == network_mode
                assert config['network']['port'] == 8000
                
                print(f"    ✅ {network_mode} configuration valid")
                
            except Exception as e:
                print(f"    ❌ Failed to configure {network_mode}: {e}")
                return False
    
    return True

def test_autostart_configurations():
    """Test autostart configuration options"""
    print("🚀 Testing autostart configurations...")
    
    test_configs = [
        (True, "user", "User-level autostart"),
        (False, "user", "No autostart"),
        (True, "system", "System-level autostart")
    ]
    
    for enable_autostart, startup_type, description in test_configs:
        print(f"  Testing {description}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            installer = BlockpanelInstaller()
            installer.config_dir = temp_dir
            installer.config_file = os.path.join(temp_dir, 'test_config.json')
            
            try:
                installer.setup_initial_config("localhost", enable_autostart, startup_type)
                
                # Load and verify configuration
                with open(installer.config_file, 'r') as f:
                    config = json.load(f)
                
                assert config['autostart']['enabled'] == enable_autostart
                assert config['autostart']['startup_type'] == startup_type
                
                # Check if summary file was created
                summary_file = os.path.join(temp_dir, 'installation_summary.txt')
                if os.path.exists(summary_file):
                    with open(summary_file, 'r') as f:
                        summary_content = f.read()
                        if enable_autostart:
                            assert "✅ Enabled" in summary_content
                        else:
                            assert "❌ Disabled" in summary_content
                
                print(f"    ✅ {description} configuration valid")
                
            except Exception as e:
                print(f"    ❌ Failed to configure {description}: {e}")
                return False
    
    return True

def test_command_line_interface():
    """Test command line argument parsing"""
    print("⚙️ Testing command line interface...")
    
    # Test help command
    try:
        from installer_config import main
        original_argv = sys.argv
        sys.argv = ['installer_config.py', '--help']
        
        try:
            main()
            print("    ✅ Help command works")
        except SystemExit:
            print("    ✅ Help command works (expected exit)")
        
        sys.argv = original_argv
        
    except Exception as e:
        print(f"    ❌ Command line interface test failed: {e}")
        return False
    
    return True

def test_file_structure():
    """Test that required files exist"""
    print("📁 Testing file structure...")
    
    required_files = [
        "installer_config.py",
        "build/blockpanel-redesigned.iss",
        "build/build-redesigned-installer.ps1"
    ]
    
    for file_path in required_files:
        full_path = project_dir / file_path
        if full_path.exists():
            print(f"    ✅ {file_path} exists")
        else:
            print(f"    ❌ {file_path} missing")
            return False
    
    return True

def main():
    """Run all tests"""
    print("🧪 BLOCKPANEL INSTALLER CONFIGURATION TESTS")
    print("=" * 50)
    
    tests = [
        ("File Structure", test_file_structure),
        ("Network Configurations", test_network_configurations),
        ("Autostart Configurations", test_autostart_configurations),
        ("Command Line Interface", test_command_line_interface)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔍 {test_name}:")
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} passed")
            else:
                print(f"❌ {test_name} failed")
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
    
    print(f"\n📊 RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The installer configuration is ready.")
        return 0
    else:
        print("⚠️ Some tests failed. Please review the configuration.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
