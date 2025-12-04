#!/bin/bash
# Simple development server for SoundPond
# Run this script to start a local server for testing

echo "🎵 Starting SoundPond development server..."
echo "   Open http://localhost:8080 in your browser"
echo "   Press Ctrl+C to stop"
echo ""

# Try Python 3 first, then Python 2
if command -v python3 &> /dev/null; then
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8080
else
    echo "❌ Python is required to run the development server"
    echo "   Install Python or use another HTTP server"
    exit 1
fi

