const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

class BackendManager {
  constructor(backendPath, mcServersPath) {
    this.backendPath = backendPath;
    this.mcServersPath = mcServersPath;
    this.pythonProcess = null;
    this.isRunning = false;
    this.startupComplete = false;
    this.config = {
      autoStart: false,
      networkAccess: false
    };
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
    console.log('Backend config set:', this.config);
  }

  async start() {
    try {
      console.log('Starting backend services...');
      
      // Check if Python is available
      const pythonCmd = await this.findPython();
      if (!pythonCmd) {
        throw new Error('Python not found. Please install Python 3.8 or higher.');
      }
      
      // Install dependencies if needed
      await this.installDependencies(pythonCmd);
      
      // Start the Python backend
      await this.startPythonBackend(pythonCmd);
      
      console.log('Backend services started successfully');
    } catch (error) {
      console.error('Failed to start backend:', error);
      throw error;
    }
  }

  async findPython() {
    // First, check for bundled python within the app installation or resources
    const possibleBundled = [
      path.join(process.resourcesPath || __dirname, 'python', 'python.exe'),
      path.join(process.resourcesPath || __dirname, 'python', 'bin', 'python.exe'),
      path.join(process.resourcesPath || __dirname, 'python.exe')
    ];

    for (const p of possibleBundled) {
      try {
        if (await fs.pathExists(p)) {
          const result = await this.runCommand(p, ['--version']);
          if (result.includes('Python 3.')) return p;
        }
      } catch (err) {
        // ignore and continue
      }
    }

    // Fall back to system python commands
    const pythonCommands = ['python', 'python3', 'py'];
    for (const cmd of pythonCommands) {
      try {
        const result = await this.runCommand(cmd, ['--version']);
        if (result.includes('Python 3.')) {
          return cmd;
        }
      } catch (error) {
        // Continue to next command
      }
    }

    return null;
  }

  async installDependencies(pythonCmd) {
    console.log('Installing Python dependencies...');
    
    const requirementsPath = path.join(this.backendPath, 'requirements.txt');
    if (await fs.pathExists(requirementsPath)) {
      try {
        await this.runCommand(pythonCmd, ['-m', 'pip', 'install', '-r', requirementsPath], {
          cwd: this.backendPath
        });
        console.log('Dependencies installed successfully');
      } catch (error) {
        console.warn('Failed to install some dependencies:', error.message);
        // Continue anyway, some dependencies might already be installed
      }
    }
  }

  async startPythonBackend(pythonCmd) {
    return new Promise((resolve, reject) => {
      console.log('Starting Python backend...');
      
      const frontendDistPath = path.join(__dirname, '../frontend/dist');
      
      const env = {
        ...process.env,
        PYTHONPATH: this.backendPath,
        MC_SERVERS_PATH: this.mcServersPath,
        FRONTEND_DIST_PATH: frontendDistPath,
        SECRET_KEY: 'blockpanel-desktop-app-secret-key-' + Date.now(),
        NETWORK_ACCESS: this.config.networkAccess ? 'true' : 'false',
        LOCALHOST_ONLY: this.config.networkAccess ? 'false' : 'true',
        PORT: '1105'
      };

      const host = this.config.networkAccess ? '0.0.0.0' : '127.0.0.1';
      
      // Try to install uvicorn first if it's missing
      console.log('Checking/installing uvicorn...');
      this.runCommand(pythonCmd, ['-m', 'pip', 'install', 'uvicorn'], { cwd: this.backendPath })
        .then(() => {
          console.log('Uvicorn ready, starting backend...');
          this.startBackendProcess(pythonCmd, host, env, resolve, reject);
        })
        .catch(() => {
          console.log('Uvicorn install failed, trying direct Python execution...');
          // Fallback: Try to run the backend directly with Python
          this.startDirectPythonBackend(pythonCmd, env, resolve, reject);
        });
    });
  }

  startBackendProcess(pythonCmd, host, env, resolve, reject) {
    this.pythonProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--host', host, '--port', '1105'], {
      cwd: this.backendPath,
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Backend:', output);
      
      // Check if server started successfully - more robust detection
      if (output.includes('Uvicorn running on') || output.includes('Application startup complete')) {
        this.isRunning = true;
        this.startupComplete = true;
        resolve();
      }
    });

    this.pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('Backend error:', error);
      
      // Also check stderr for startup confirmation
      if (error.includes('Uvicorn running on') || error.includes('Application startup complete')) {
        this.isRunning = true;
        this.startupComplete = true;
        resolve();
        return;
      }
      
      // Log specific error types for better debugging
      if (error.includes('ModuleNotFoundError')) {
        console.error('Missing Python module detected');
      }
      if (error.includes('uvicorn')) {
        console.error('Uvicorn-related error detected');
      }
      if (error.includes('fastapi')) {
        console.error('FastAPI-related error detected');
      }
      
      // Only reject on actual startup failures
      if (error.includes('Address already in use') || 
          error.includes('Permission denied') ||
          error.includes('error while attempting to bind')) {
        reject(new Error(`Backend startup failed: ${error}`));
      }
    });

      this.pythonProcess.on('error', (error) => {
        console.error('Python process error:', error);
        reject(error);
      });

      this.pythonProcess.on('exit', (code) => {
        console.log(`Python backend exited with code ${code}`);
        this.isRunning = false;
        // Only reject if the process exits before it was successfully started
        // and it's not a normal shutdown (0) or interrupted (130)
        if (!this.startupComplete && code !== 0 && code !== null && code !== 130) {
          reject(new Error(`Backend exited with code ${code}`));
        }
      });

        // Additionally poll HTTP endpoint to ensure it's responding
        const http = require('http');
        const start = Date.now();
        const timeout = 60000;
        const interval = 500;
        const check = () => {
          const req = http.get('http://127.0.0.1:1105/', (res) => {
            if (res.statusCode >= 200 && res.statusCode < 500) {
              this.isRunning = true;
              this.startupComplete = true;
              resolve();
              res.destroy();
              return;
            }
            res.destroy();
            if (Date.now() - start > timeout) return reject(new Error('Backend startup timeout'));
            setTimeout(check, interval);
          });
          req.on('error', () => {
            if (Date.now() - start > timeout) return reject(new Error('Backend startup timeout'));
            setTimeout(check, interval);
          });
          req.setTimeout(3000, () => { req.abort(); });
        };
        check();
  }

  startDirectPythonBackend(pythonCmd, env, resolve, reject) {
    console.log('Attempting direct Python execution...');
    
    // Try to run a simple HTTP server with the backend
    this.pythonProcess = spawn(pythonCmd, ['main.py'], {
      cwd: this.backendPath,
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Backend (direct):', output);
      
      // Check if server started successfully
      if (output.includes('running on') || output.includes('started') || output.includes('listening')) {
        this.isRunning = true;
        this.startupComplete = true;
        resolve();
      }
    });

    this.pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('Backend error (direct):', error);
    });

    this.pythonProcess.on('error', (error) => {
      console.error('Direct Python process error:', error);
      reject(error);
    });

    this.pythonProcess.on('exit', (code) => {
      console.log(`Direct Python backend exited with code ${code}`);
      this.isRunning = false;
      // Only reject if the process exits before it was successfully started
      if (!this.startupComplete && code !== 0 && code !== null && code !== 130) {
        reject(new Error(`Direct backend exited with code ${code}`));
      }
    });

    // Shorter timeout for direct execution
    setTimeout(() => {
      if (!this.isRunning) {
        reject(new Error('Direct backend startup timeout'));
      }
    }, 15000);
  }

  async stop() {
    if (this.pythonProcess && this.isRunning) {
      console.log('Stopping backend services...');
      
      this.pythonProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.pythonProcess.kill('SIGKILL');
          resolve();
        }, 5000);
        
        this.pythonProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      this.isRunning = false;
      console.log('Backend services stopped');
    }
  }

  runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', reject);

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }
}

module.exports = BackendManager;
