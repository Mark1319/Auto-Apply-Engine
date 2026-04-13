#!/bin/bash
# setup.sh — Run once to install all dependencies

set -e

echo "🚀 Setting up Auto Job Apply..."

# ── Backend ──────────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing Python backend dependencies..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
deactivate
cd ..

# ── Frontend ─────────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the app, run:  ./start.sh"
