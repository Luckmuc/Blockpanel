"""
Dynamic Port Allocator for Minecraft Servers
Manages automatic port allocation and deallocation
"""
import json
import os
import socket
import logging
from typing import Set, Optional, List, Tuple
from threading import Lock

logger = logging.getLogger(__name__)

class PortAllocator:
    def __init__(self, 
                 allocation_file: str = "/app/mc_servers/port_allocations.json",
                 min_port: int = 25565,
                 max_port: int = 25575,
                 special_min_port: int = 11000,
                 special_max_port: int = 11999):
        self.allocation_file = allocation_file
        self.min_port = min_port
        self.max_port = max_port
        self.special_min_port = special_min_port
        self.special_max_port = special_max_port
        self.lock = Lock()
        
        # System ports that should never be allocated
        self.reserved_ports = {
            22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 8000, 8404, 1105
        }
        
    def _load_allocations(self) -> dict:
        """Load port allocations from file"""
        try:
            if os.path.exists(self.allocation_file):
                with open(self.allocation_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load port allocations: {e}")
        return {}
    
    def _save_allocations(self, allocations: dict) -> bool:
        """Save port allocations to file"""
        try:
            os.makedirs(os.path.dirname(self.allocation_file), exist_ok=True)
            with open(self.allocation_file, 'w') as f:
                json.dump(allocations, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Could not save port allocations: {e}")
            return False
    
    def _is_port_available(self, port: int) -> bool:
        """Check if a port is available on the system"""
        if port in self.reserved_ports:
            return False
            
        try:
            # Try to bind to the port
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                result = sock.bind(('localhost', port))
                return True
        except OSError:
            return False
    
    def _get_allocated_ports(self) -> Set[int]:
        """Get all currently allocated ports"""
        allocations = self._load_allocations()
        return set(allocations.values())
    
    def allocate_port(self, server_name: str, preferred_port: Optional[int] = None) -> Optional[int]:
        """
        Allocate a port for a server
        Returns the allocated port or None if allocation failed
        """
        with self.lock:
            allocations = self._load_allocations()
            
            # Check if server already has a port
            if server_name in allocations:
                existing_port = allocations[server_name]
                logger.info(f"Server {server_name} already has port {existing_port}")
                return existing_port
            
            allocated_ports = set(allocations.values())
            
            # Try preferred port first
            if preferred_port:
                if (self._is_valid_port_range(preferred_port) and 
                    preferred_port not in allocated_ports and 
                    self._is_port_available(preferred_port)):
                    allocations[server_name] = preferred_port
                    self._save_allocations(allocations)
                    logger.info(f"Allocated preferred port {preferred_port} to {server_name}")
                    return preferred_port
                else:
                    logger.warning(f"Preferred port {preferred_port} not available for {server_name}")
            
            # Find available port in standard range
            for port in range(self.min_port, self.max_port + 1):
                if (port not in allocated_ports and 
                    port not in self.reserved_ports and
                    self._is_port_available(port)):
                    allocations[server_name] = port
                    self._save_allocations(allocations)
                    logger.info(f"Allocated port {port} to {server_name}")
                    return port
            
            # Try special range if standard range is full
            for port in range(self.special_min_port, self.special_max_port + 1):
                if (port not in allocated_ports and 
                    port not in self.reserved_ports and
                    self._is_port_available(port)):
                    allocations[server_name] = port
                    self._save_allocations(allocations)
                    logger.info(f"Allocated special port {port} to {server_name}")
                    return port
            
            logger.error(f"No available ports for {server_name}")
            return None
    
    def deallocate_port(self, server_name: str) -> bool:
        """
        Deallocate a port from a server
        Returns True if successful
        """
        with self.lock:
            allocations = self._load_allocations()
            
            if server_name in allocations:
                port = allocations.pop(server_name)
                self._save_allocations(allocations)
                logger.info(f"Deallocated port {port} from {server_name}")
                return True
            else:
                logger.warning(f"No port allocation found for {server_name}")
                return False
    
    def get_server_port(self, server_name: str) -> Optional[int]:
        """Get the allocated port for a server"""
        allocations = self._load_allocations()
        return allocations.get(server_name)
    
    def get_available_ports(self, count: int = 10) -> List[int]:
        """Get a list of available ports"""
        allocated_ports = self._get_allocated_ports()
        available = []
        
        # Check standard range
        for port in range(self.min_port, self.max_port + 1):
            if (port not in allocated_ports and 
                port not in self.reserved_ports and
                self._is_port_available(port)):
                available.append(port)
                if len(available) >= count:
                    break
        
        # Check special range if needed
        if len(available) < count:
            for port in range(self.special_min_port, self.special_max_port + 1):
                if (port not in allocated_ports and 
                    port not in self.reserved_ports and
                    self._is_port_available(port)):
                    available.append(port)
                    if len(available) >= count:
                        break
        
        return available
    
    def _is_valid_port_range(self, port: int) -> bool:
        """Check if port is in valid range"""
        return ((self.min_port <= port <= self.max_port) or 
                (self.special_min_port <= port <= self.special_max_port))
    
    def get_allocation_status(self) -> dict:
        """Get status of port allocations"""
        allocations = self._load_allocations()
        allocated_ports = set(allocations.values())
        
        standard_used = len([p for p in allocated_ports if self.min_port <= p <= self.max_port])
        standard_total = self.max_port - self.min_port + 1
        
        special_used = len([p for p in allocated_ports if self.special_min_port <= p <= self.special_max_port])
        special_total = self.special_max_port - self.special_min_port + 1
        
        return {
            "standard_range": {
                "min": self.min_port,
                "max": self.max_port,
                "used": standard_used,
                "total": standard_total,
                "available": standard_total - standard_used
            },
            "special_range": {
                "min": self.special_min_port,
                "max": self.special_max_port,
                "used": special_used,
                "total": special_total,
                "available": special_total - special_used
            },
            "allocations": allocations,
            "total_allocated": len(allocated_ports)
        }

# Global instance
port_allocator = PortAllocator()
