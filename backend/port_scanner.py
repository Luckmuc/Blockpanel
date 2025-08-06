"""
Port Scanner Utility für Blockpanel
Überprüft Port-Verfügbarkeit für Minecraft-Server
"""

import socket
import threading
import time
import json
import sys
from typing import Dict, List, Set, Tuple
import argparse

class PortScanner:
    def __init__(self, timeout: float = 0.5, max_threads: int = 100):
        self.timeout = timeout
        self.max_threads = max_threads
        self.results = {}
        self.lock = threading.Lock()
    
    def scan_single_port(self, host: str, port: int) -> Dict:
        """Scan a single port and return detailed information"""
        result = {
            "port": port,
            "status": "unknown",
            "service": None,
            "response_time": None
        }
        
        start_time = time.time()
        
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(self.timeout)
                connection_result = sock.connect_ex((host, port))
                
                if connection_result == 0:
                    result["status"] = "open"
                    result["response_time"] = round((time.time() - start_time) * 1000, 2)
                    result["service"] = self.identify_service(port)
                else:
                    result["status"] = "closed"
                    
        except socket.timeout:
            result["status"] = "timeout"
        except socket.gaierror:
            result["status"] = "host_unreachable"
        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)
        
        return result
    
    def identify_service(self, port: int) -> str:
        """Identify common services running on specific ports"""
        services = {
            22: "SSH",
            25: "SMTP",
            53: "DNS",
            80: "HTTP",
            443: "HTTPS",
            993: "IMAPS",
            995: "POP3S",
            1105: "Blockpanel-Frontend",
            8000: "Blockpanel-Backend",
            8404: "HAProxy-Stats",
            3306: "MySQL",
            5432: "PostgreSQL",
            6379: "Redis",
            27017: "MongoDB",
            25565: "Minecraft-Java",
            19132: "Minecraft-Bedrock",
        }
        
        return services.get(port, f"Unknown-{port}")
    
    def scan_port_worker(self, host: str, ports: List[int]):
        """Worker thread for scanning multiple ports"""
        for port in ports:
            result = self.scan_single_port(host, port)
            
            with self.lock:
                self.results[port] = result
    
    def scan_range(self, host: str, start_port: int, end_port: int) -> Dict:
        """Scan a range of ports using threading"""
        print(f"🔍 Scanning ports {start_port}-{end_port} on {host}...")
        
        ports = list(range(start_port, min(end_port + 1, 65536)))
        
        # Split ports among threads
        chunk_size = max(1, len(ports) // self.max_threads)
        port_chunks = [ports[i:i + chunk_size] for i in range(0, len(ports), chunk_size)]
        
        threads = []
        start_time = time.time()
        
        # Start worker threads
        for chunk in port_chunks:
            if chunk:  # Skip empty chunks
                thread = threading.Thread(target=self.scan_port_worker, args=(host, chunk))
                threads.append(thread)
                thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        scan_time = round(time.time() - start_time, 2)
        
        # Compile results
        open_ports = [p for p, r in self.results.items() if r["status"] == "open"]
        closed_ports = [p for p, r in self.results.items() if r["status"] == "closed"]
        
        summary = {
            "scan_info": {
                "host": host,
                "port_range": f"{start_port}-{end_port}",
                "total_ports": len(ports),
                "scan_time_seconds": scan_time,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            },
            "summary": {
                "open_ports": len(open_ports),
                "closed_ports": len(closed_ports),
                "total_scanned": len(self.results)
            },
            "open_ports": sorted(open_ports),
            "port_details": dict(sorted(self.results.items()))
        }
        
        return summary
    
    def find_available_ports(self, host: str, count: int = 10, start_port: int = 25565) -> List[int]:
        """Find available ports starting from start_port"""
        print(f"🔍 Finding {count} available ports starting from {start_port}...")
        
        available_ports = []
        current_port = start_port
        
        while len(available_ports) < count and current_port <= 65535:
            result = self.scan_single_port(host, current_port)
            
            if result["status"] in ["closed", "timeout"]:
                # Additional validation for truly available ports
                if self.is_port_truly_available(host, current_port):
                    available_ports.append(current_port)
                    print(f"✅ Port {current_port} is available")
            
            current_port += 1
        
        return available_ports
    
    def is_port_truly_available(self, host: str, port: int) -> bool:
        """Double-check if a port is truly available by trying to bind to it"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.bind((host if host != "localhost" else "127.0.0.1", port))
                return True
        except Exception:
            return False

def main():
    parser = argparse.ArgumentParser(description="Blockpanel Port Scanner")
    parser.add_argument("--host", default="localhost", help="Host to scan")
    parser.add_argument("--start", type=int, default=25565, help="Start port")
    parser.add_argument("--end", type=int, default=25600, help="End port")
    parser.add_argument("--find", type=int, help="Find N available ports")
    parser.add_argument("--timeout", type=float, default=0.5, help="Connection timeout")
    parser.add_argument("--output", help="Output file for results (JSON)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    scanner = PortScanner(timeout=args.timeout)
    
    if args.find:
        # Find available ports mode
        available = scanner.find_available_ports(args.host, args.find, args.start)
        result = {
            "mode": "find_available",
            "host": args.host,
            "requested_count": args.find,
            "found_count": len(available),
            "available_ports": available
        }
    else:
        # Range scan mode
        result = scanner.scan_range(args.host, args.start, args.end)
    
    # Output results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"📄 Results saved to {args.output}")
    
    if args.verbose or not args.output:
        print("\n" + "="*50)
        print("🎯 SCAN RESULTS")
        print("="*50)
        print(json.dumps(result, indent=2))
    
    # Quick summary
    if args.find:
        print(f"\n✅ Found {len(result['available_ports'])} available ports")
        if result['available_ports']:
            print(f"🔢 Ports: {', '.join(map(str, result['available_ports']))}")
    else:
        summary = result.get('summary', {})
        print(f"\n📊 Scan Summary:")
        print(f"   • Open ports: {summary.get('open_ports', 0)}")
        print(f"   • Closed ports: {summary.get('closed_ports', 0)}")
        print(f"   • Scan time: {result.get('scan_info', {}).get('scan_time_seconds', 0)}s")
        
        if result.get('open_ports'):
            print(f"🔓 Open ports: {', '.join(map(str, result['open_ports']))}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠️  Scan interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
