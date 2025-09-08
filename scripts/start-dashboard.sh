#!/bin/bash

echo "🎯 Starting Comprehensive Monitoring Dashboard"
echo "=============================================="

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

# Check if files exist
if [ ! -f "src/dashboard-server.js" ]; then
    echo "❌ Error: dashboard-server.js not found in src/"
    exit 1
fi

if [ ! -f "public/dashboard.html" ]; then
    echo "❌ Error: dashboard.html not found in public/"
    exit 1
fi

echo "🚀 Starting dashboard server..."
echo "📊 Dashboard will be available at: http://localhost:8080"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

node src/dashboard-server.js 