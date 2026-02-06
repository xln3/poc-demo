#!/bin/bash
# Start the backend server

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment with Python 3.11..."
    uv venv --python 3.11 venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
uv pip install -r requirements.txt -q

# Start server
HOST="${BACKEND_HOST:-127.0.0.1}"
PORT="${BACKEND_PORT:-8000}"
echo "Starting sandbox API server on http://${HOST}:${PORT}"
# Security: bind to localhost by default. If you explicitly need LAN access, set BACKEND_HOST=0.0.0.0.
uvicorn app.main:app --reload --host "${HOST}" --port "${PORT}"
