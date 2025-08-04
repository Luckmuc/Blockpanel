from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List
import yaml
import subprocess
import asyncio
import os
import logging
from auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

class PortExtensionRequest(BaseModel):
    additional_ports: List[int]

@router.post("/extend-ports")
async def extend_ports(
    request: PortExtensionRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """
    Extend the port range by modifying docker-compose.yml and restarting the proxy container.
    """
    try:
        # Validate ports
        for port in request.additional_ports:
            if not (25576 <= port <= 65535):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Port {port} is out of allowed range (25576-65535)"
                )
        
        # Add ports to docker-compose files
        await extend_docker_compose_ports(request.additional_ports)
        
        # Schedule container restart in background
        background_tasks.add_task(restart_proxy_container)
        
        return {
            "message": f"Successfully added {len(request.additional_ports)} ports. Container restart initiated.",
            "added_ports": request.additional_ports
        }
        
    except Exception as e:
        logger.error(f"Failed to extend ports: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extend ports: {str(e)}")

async def extend_docker_compose_ports(additional_ports: List[int]):
    """
    Modify both docker-compose.yml and docker-compose.dev.yml to add new ports.
    """
    compose_files = [
        "/app/docker-compose.yml",
        "/app/docker-compose.dev.yml"
    ]
    
    for compose_file in compose_files:
        if not os.path.exists(compose_file):
            logger.warning(f"Compose file {compose_file} not found, skipping...")
            continue
            
        try:
            # Read current compose file
            with open(compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            # Add new ports to proxy service
            if 'services' in compose_data and 'proxy' in compose_data['services']:
                current_ports = compose_data['services']['proxy'].get('ports', [])
                
                # Add new ports
                for port in additional_ports:
                    port_mapping = f"{port}:{port}"
                    if port_mapping not in current_ports:
                        current_ports.append(port_mapping)
                
                compose_data['services']['proxy']['ports'] = current_ports
                
                # Write back to file
                with open(compose_file, 'w') as f:
                    yaml.dump(compose_data, f, default_flow_style=False, sort_keys=False)
                
                logger.info(f"Updated {compose_file} with {len(additional_ports)} new ports")
            else:
                logger.warning(f"No proxy service found in {compose_file}")
                
        except Exception as e:
            logger.error(f"Failed to update {compose_file}: {str(e)}")
            raise

async def restart_proxy_container():
    """
    Restart the proxy container to apply new port configuration.
    """
    try:
        # Wait a bit before restarting
        await asyncio.sleep(2)
        
        # Restart proxy container
        logger.info("Restarting proxy container...")
        
        # Use docker-compose to restart just the proxy service
        restart_command = [
            "docker-compose", "-f", "/app/docker-compose.yml", 
            "up", "-d", "--force-recreate", "proxy"
        ]
        
        # Check if we're in dev mode
        if os.path.exists("/app/docker-compose.dev.yml"):
            restart_command = [
                "docker-compose", "-f", "/app/docker-compose.dev.yml", 
                "up", "-d", "--force-recreate", "proxy"
            ]
        
        result = subprocess.run(
            restart_command,
            capture_output=True,
            text=True,
            cwd="/app"
        )
        
        if result.returncode == 0:
            logger.info("Proxy container restarted successfully")
        else:
            logger.error(f"Failed to restart proxy container: {result.stderr}")
            
    except Exception as e:
        logger.error(f"Error during container restart: {str(e)}")
