#!/bin/bash
# start.sh — Start backend + frontend concurrently

set -e

# Cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "🔧 Starting backend (FastAPI on :8000)..."
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!
deactivate
cd ..

sleep 1

echo "🎨 Starting frontend (Vite on :5173)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Auto Job Apply is running!"
echo "   Dashboard  →  http://localhost:5173"
echo "   API docs   →  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."

wait
