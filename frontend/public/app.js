// Blockpanel Frontend JavaScript
class BlockpanelApp {
    constructor() {
        this.baseURL = 'http://localhost:8000';
        this.token = localStorage.getItem('authToken');
        this.init();
    }

    init() {
        this.setupEventListeners();
        if (this.token) {
            this.showMainPanel();
            this.loadDashboard();
        } else {
            this.showAuthSection();
        }
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
                this.updateActiveNav(link);
            });
        });

        // Server controls
        document.getElementById('refreshServersBtn').addEventListener('click', () => {
            this.loadServers();
        });

        document.getElementById('createServerBtn').addEventListener('click', () => {
            this.showCreateServerDialog();
        });
    }

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${this.baseURL}/login`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                this.token = data.access_token;
                localStorage.setItem('authToken', this.token);
                document.getElementById('currentUser').textContent = username;
                this.showMainPanel();
                this.loadDashboard();
            } else {
                const error = await response.json();
                alert('Login fehlgeschlagen: ' + error.detail);
            }
        } catch (error) {
            alert('Verbindungsfehler: ' + error.message);
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('authToken');
        this.showAuthSection();
    }

    showAuthSection() {
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('mainPanel').style.display = 'none';
    }

    showMainPanel() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainPanel').style.display = 'block';
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');

        // Load section data
        switch(sectionId) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'servers':
                this.loadServers();
                break;
            case 'system':
                this.loadSystemInfo();
                break;
        }
    }

    updateActiveNav(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(`${this.baseURL}${url}`, {
                ...options,
                headers
            });

            if (response.status === 401) {
                this.logout();
                return null;
            }

            return response;
        } catch (error) {
            console.error('Request failed:', error);
            return null;
        }
    }

    async loadDashboard() {
        await Promise.all([
            this.loadSystemHealth(),
            this.loadRamUsage(),
            this.loadServerCount()
        ]);
    }

    async loadSystemHealth() {
        const response = await this.makeAuthenticatedRequest('/system/health');
        if (response && response.ok) {
            const data = await response.json();
            const healthHtml = `
                <div class="health-status">
                    <div class="${data.java.ok ? 'status-ok' : 'status-error'}">
                        Java: ${data.java.ok ? '✅' : '❌'} ${data.java.version}
                    </div>
                    <div class="${data.tmux.ok ? 'status-ok' : 'status-error'}">
                        Tmux: ${data.tmux.ok ? '✅' : '❌'} ${data.tmux.version}
                    </div>
                    <div class="${data.mc_servers.exists && data.mc_servers.writable ? 'status-ok' : 'status-warning'}">
                        MC Directory: ${data.mc_servers.exists ? '✅' : '❌'} 
                        ${data.mc_servers.writable ? 'Schreibbar' : 'Nicht schreibbar'}
                    </div>
                </div>
            `;
            document.getElementById('systemHealth').innerHTML = healthHtml;
        } else {
            document.getElementById('systemHealth').innerHTML = '<span class="status-error">Fehler beim Laden</span>';
        }
    }

    async loadRamUsage() {
        const response = await this.makeAuthenticatedRequest('/system/ram');
        if (response && response.ok) {
            const data = await response.json();
            const used = data.total_mb - data.available_mb;
            const usagePercent = ((used / data.total_mb) * 100).toFixed(1);
            const ramHtml = `
                <div class="ram-info">
                    <div>Total: ${data.total_mb} MB</div>
                    <div>Verfügbar: ${data.available_mb} MB</div>
                    <div>Verwendet: ${used} MB (${usagePercent}%)</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${usagePercent}%"></div>
                    </div>
                </div>
            `;
            document.getElementById('ramUsage').innerHTML = ramHtml;
        } else {
            document.getElementById('ramUsage').innerHTML = '<span class="status-error">Fehler beim Laden</span>';
        }
    }

    async loadServerCount() {
        const response = await this.makeAuthenticatedRequest('/server/list');
        if (response && response.ok) {
            const data = await response.json();
            const serverCount = data.servers.length;
            document.getElementById('serverCount').innerHTML = `
                <div class="server-count">
                    <div>Gesamt: ${serverCount} Server</div>
                    <div class="status-ok">System bereit</div>
                </div>
            `;
        } else {
            document.getElementById('serverCount').innerHTML = '<span class="status-error">Fehler beim Laden</span>';
        }
    }

    async loadServers() {
        const response = await this.makeAuthenticatedRequest('/server/list');
        if (response && response.ok) {
            const data = await response.json();
            const serversHtml = data.servers.length > 0 
                ? data.servers.map(server => `
                    <div class="server-card">
                        <h3>${server.name}</h3>
                        <p>Status: <span class="${server.status === 'running' ? 'status-ok' : 'status-error'}">${server.status}</span></p>
                        <div class="server-actions">
                            <button class="btn-primary" onclick="app.startServer('${server.name}')">Start</button>
                            <button class="btn-secondary" onclick="app.stopServer('${server.name}')">Stop</button>
                        </div>
                    </div>
                `).join('')
                : '<p>Keine Server gefunden. Erstelle deinen ersten Server!</p>';
            
            document.getElementById('serversList').innerHTML = serversHtml;
        } else {
            document.getElementById('serversList').innerHTML = '<span class="status-error">Fehler beim Laden der Server</span>';
        }
    }

    async loadSystemInfo() {
        const response = await this.makeAuthenticatedRequest('/system/health');
        if (response && response.ok) {
            const data = await response.json();
            
            document.getElementById('javaInfo').innerHTML = `
                <div class="${data.java.ok ? 'status-ok' : 'status-error'}">
                    Status: ${data.java.ok ? 'OK' : 'Fehler'}<br>
                    Version: ${data.java.version}
                </div>
            `;
            
            document.getElementById('tmuxInfo').innerHTML = `
                <div class="${data.tmux.ok ? 'status-ok' : 'status-error'}">
                    Status: ${data.tmux.ok ? 'OK' : 'Fehler'}<br>
                    Version: ${data.tmux.version}
                </div>
            `;
            
            document.getElementById('mcDirInfo').innerHTML = `
                <div class="${data.mc_servers.exists && data.mc_servers.writable ? 'status-ok' : 'status-warning'}">
                    Existiert: ${data.mc_servers.exists ? 'Ja' : 'Nein'}<br>
                    Schreibbar: ${data.mc_servers.writable ? 'Ja' : 'Nein'}
                </div>
            `;
        }
    }

    showCreateServerDialog() {
        alert('Server-Erstellung ist in dieser Demo-Version noch nicht implementiert.\nNutze die API direkt: POST /server/create');
    }

    async startServer(serverName) {
        const formData = new FormData();
        formData.append('servername', serverName);
        
        const response = await this.makeAuthenticatedRequest('/server/start', {
            method: 'POST',
            body: formData,
            headers: {} // Remove Content-Type for FormData
        });
        
        if (response && response.ok) {
            alert('Server wird gestartet...');
            this.loadServers();
        } else {
            alert('Fehler beim Starten des Servers');
        }
    }

    async stopServer(serverName) {
        const formData = new FormData();
        formData.append('servername', serverName);
        
        const response = await this.makeAuthenticatedRequest('/server/stop', {
            method: 'POST',
            body: formData,
            headers: {} // Remove Content-Type for FormData
        });
        
        if (response && response.ok) {
            alert('Server wird gestoppt...');
            this.loadServers();
        } else {
            alert('Fehler beim Stoppen des Servers');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BlockpanelApp();
});

// Add CSS for progress bar
const style = document.createElement('style');
style.textContent = `
    .progress-bar {
        width: 100%;
        height: 8px;
        background: var(--border-color);
        border-radius: 4px;
        margin-top: 8px;
        overflow: hidden;
    }
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--success-color), var(--warning-color));
        transition: width 0.3s ease;
    }
    .server-card {
        background: var(--dark-bg);
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        margin-bottom: 1rem;
    }
    .server-actions {
        margin-top: 1rem;
        display: flex;
        gap: 0.5rem;
    }
    .health-status > div {
        margin-bottom: 0.5rem;
    }
`;
document.head.appendChild(style);