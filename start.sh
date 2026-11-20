#!/bin/bash
# Kashf - Start development server

echo "Starting Kashf development server..."
echo "=================================="

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed"
    echo "Please install Python 3 to run the development server"
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Working directory: $SCRIPT_DIR"
echo "Starting server on http://127.0.0.1:8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
echo "Opening http://127.0.0.1:8080 in your browser..."
if command -v termux-open-url &> /dev/null; then
    (sleep 1.5; termux-open-url "http://127.0.0.1:8080" >/dev/null 2>&1) &
fi
exec python3 -m http.server 8080 --bind 127.0.0.1