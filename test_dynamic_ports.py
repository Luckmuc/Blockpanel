#!/usr/bin/env python3
"""
Test script to verify the dynamic port allocation system is working
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))

from port_allocator import port_allocator
from proxy_manager import proxy_manager

def test_port_allocation():
    """Test the port allocation system"""
    print("Testing Dynamic Port Allocation System")
    print("=" * 50)
    
    # 1. Test port allocation
    print("\n1. Testing port allocation...")
    port = port_allocator.allocate_port("test-server-1")
    if port:
        print(f"✓ Successfully allocated port: {port}")
        
        # 2. Test proxy configuration
        print("\n2. Testing proxy configuration...")
        success, assigned_port = proxy_manager.add_server_proxy("test-server-1", port)
        if success and assigned_port == port:
            print(f"✓ Successfully configured proxy for port: {assigned_port}")
            
            # 3. Test port deallocation
            print("\n3. Testing port deallocation...")
            proxy_manager.remove_server_proxy("test-server-1")
            port_allocator.deallocate_port(port)
            print("✓ Successfully removed server and deallocated port")
            
        else:
            print(f"✗ Failed to configure proxy: success={success}, port={assigned_port}")
    else:
        print("✗ Failed to allocate port")
    
    # 4. Show allocation status
    print("\n4. Current allocation status:")
    status = port_allocator.get_allocation_status()
    print(f"   Total allocated: {status['total_allocated']}")
    print(f"   Available count: {status['available_count']}")
    print(f"   Port range: {status['port_range']}")
    
    # 5. Test multiple allocations
    print("\n5. Testing multiple allocations...")
    allocated_ports = []
    for i in range(3):
        port = port_allocator.allocate_port(f"test-server-{i+2}")
        if port:
            allocated_ports.append(port)
            print(f"   Allocated port {port} for test-server-{i+2}")
        else:
            print(f"   Failed to allocate port for test-server-{i+2}")
    
    # Clean up
    print("\n6. Cleaning up test allocations...")
    for i, port in enumerate(allocated_ports):
        port_allocator.deallocate_port(port)
        print(f"   Deallocated port {port}")
    
    print("\nTest completed!")

if __name__ == "__main__":
    test_port_allocation()
