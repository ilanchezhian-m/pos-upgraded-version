#!/bin/bash

echo "================================"
echo "PetPooja Complete System Startup"
echo "================================"
echo ""

echo "[1/3] Starting Print Server..."
cd "$(dirname "$0")/print-server"
npm start &
sleep 2

echo "[2/3] Starting Main POS..."
cd "$(dirname "$0")/my-project"
npm run dev &
sleep 2

echo "[3/3] Starting Captain App..."
cd "$(dirname "$0")/captain-app"
npm run dev &

echo ""
echo "================================"
echo "All systems started!"
echo "================================"
echo ""
echo "Main POS:      http://localhost:5173"
echo "Captain App:   http://localhost:3001"
echo "Print Server:  http://localhost:5001"
echo ""
echo "Find your PC IP with: ip addr show"
echo "Access from other devices: http://YOUR_PC_IP:PORT"
echo ""

wait
