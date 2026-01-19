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
echo "Starting sandbox API server on http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
