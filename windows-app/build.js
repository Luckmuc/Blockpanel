#!/usr/bin/env node
/**
 * Blockpanel Build Script
 * Simple Node.js script to build the Electron app with custom installer
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, description) {
  log(`\n🔨 ${description}...`, colors.cyan);
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    log(`✅ ${description} completed`, colors.green);
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description} found`, colors.green);
    return true;
  } else {
    log(`⚠️ ${description} not found: ${filePath}`, colors.yellow);
    return false;
  }
}

function main() {
  log('🚀 BLOCKPANEL BUILD PROCESS', colors.bright + colors.cyan);
  log('============================', colors.cyan);
  
  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    log('❌ package.json not found. Please run this script from the windows-app directory.', colors.red);
    process.exit(1);
  }
  
  // Check required files
  log('\n📁 Checking required files...', colors.blue);
  checkFile('installer_config.py', 'Installer configuration script');
  checkFile('build/installer.nsh', 'NSIS installer script');
  checkFile('windows-app-icon.ico', 'Application icon');
  checkFile('main.js', 'Main Electron script');
  
  // Check if frontend directory exists
  if (!fs.existsSync('frontend')) {
    log('❌ Frontend directory not found', colors.red);
    process.exit(1);
  }
  
  // Install dependencies if needed
  if (!fs.existsSync('node_modules')) {
    exec('npm install', 'Installing dependencies');
  }
  
  // Build frontend
  exec('cd frontend && npm install', 'Installing frontend dependencies');
  exec('cd frontend && npm run build', 'Building frontend');
  
  // Copy frontend to backend
  if (process.platform === 'win32') {
    exec('xcopy "frontend\\dist" "backend\\frontend_dist" /E /I /Y', 'Copying frontend to backend');
  } else {
    exec('cp -r frontend/dist/* backend/frontend_dist/', 'Copying frontend to backend');
  }
  
  // Prepare Python if needed
  if (fs.existsSync('build/download_python.js')) {
    exec('node build/download_python.js', 'Preparing Python runtime');
  }
  
  // Build the Electron app
  exec('electron-builder', 'Building Electron application with custom installer');
  
  // Check if build was successful
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const installer = files.find(f => f.includes('Setup') && f.endsWith('.exe'));
    
    if (installer) {
      const installerPath = path.join(distDir, installer);
      const stats = fs.statSync(installerPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      log('\n🎉 BUILD COMPLETED SUCCESSFULLY!', colors.bright + colors.green);
      log('================================', colors.green);
      log(`📦 Installer: ${installer}`, colors.green);
      log(`📊 Size: ${sizeMB} MB`, colors.green);
      log(`📍 Location: ${installerPath}`, colors.green);
      
      log('\n✨ INSTALLER FEATURES:', colors.cyan);
      log('   🌐 Custom Network Configuration UI', colors.white);
      log('      • Localhost Only (Most Secure)', colors.reset);
      log('      • Local Network Access', colors.reset);
      log('      • Public Internet Access', colors.reset);
      log('   🚀 Windows Startup Integration', colors.white);
      log('      • Optional autostart configuration', colors.reset);
      log('   🔧 Automated Setup', colors.white);
      log('      • Firewall configuration', colors.reset);
      log('      • Port management', colors.reset);
      log('      • Security warnings', colors.reset);
      
      log('\n🎯 Ready to distribute!', colors.bright + colors.green);
    } else {
      log('⚠️ Installer built but not found in expected location', colors.yellow);
    }
  } else {
    log('❌ Build directory not found', colors.red);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  log('Blockpanel Build Script', colors.bright);
  log('Usage: node build.js [options]', colors.cyan);
  log('Options:');
  log('  --help, -h    Show this help message');
  log('  --clean       Clean build directories before building');
  process.exit(0);
}

if (args.includes('--clean')) {
  log('🧹 Cleaning build directories...', colors.yellow);
  try {
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    if (fs.existsSync('backend/frontend_dist')) {
      fs.rmSync('backend/frontend_dist', { recursive: true, force: true });
    }
    log('✅ Clean completed', colors.green);
  } catch (error) {
    log(`⚠️ Clean failed: ${error.message}`, colors.yellow);
  }
}

main();
