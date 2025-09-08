#!/bin/bash

echo "📊 Starting Comprehensive Console Monitor"
echo "========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the monitoring-dashboard directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if file exists
if [ ! -f "src/comprehensive-monitor.js" ]; then
    echo "❌ Error: comprehensive-monitor.js not found in src/"
    exit 1
fi

echo "🚀 Starting console monitor..."
echo "📡 Connecting to Redis: 100.70.127.124:6380"
echo "🛑 Press Ctrl+C to stop monitoring"
echo ""

node src/comprehensive-monitor.js 