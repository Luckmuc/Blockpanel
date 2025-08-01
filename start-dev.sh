#!/bin/bash

echo "Building Blockpanel with dynamic port forwarding..."

# Build all services
echo "Building Docker containers..."
docker-compose -f docker-compose.dev.yml build

# Start the services
echo "Starting services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Check service health
echo "Checking service status..."
docker-compose -f docker-compose.dev.yml ps

echo "=========================================="
echo "Blockpanel is ready!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "HAProxy Stats: http://localhost:8404/stats"
echo "Minecraft Ports: 25565-25600"
echo "=========================================="
echo ""
echo "Dynamic port forwarding is now active!"
echo "Minecraft servers will be automatically"
echo "accessible on their assigned ports."
