# One-click Startup

**Version**: v3.2 | Updated: 2026-02-07

This project includes one-click startup scripts for quick development environment setup.

## Quick Start Scripts

- `start_oneclick.bat` (Windows)
- `start_oneclick.sh` (Linux/Mac)

## What They Do

1. Check `python`/`node` availability
2. Try to free ports `5173` (frontend) and `8765` (backend)
3. Start backend and frontend services
4. Keep original `start.bat` / `start.sh` untouched

## Service URLs

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8765`
- **Backend Docs**: `http://localhost:8765/docs`
- **WebSocket**: `ws://localhost:8765/ws`

## Manual Start Commands

### Backend (PowerShell, verified)

```powershell
Set-Location "C:\Users\Lenovo\Desktop\SocSim-Lab\backend"
$env:PYTHONIOENCODING = "utf-8"
.\venv\Scripts\python.exe .\main.py
```

### Frontend (PowerShell, verified)

```powershell
Set-Location "C:\Users\Lenovo\Desktop\SocSim-Lab\frontend"
npx vite --host 127.0.0.1 --port 5173 --config vite.config.js --configLoader native
```

## Data Persistence

The project uses **SQLite embedded database** - no separate database deployment needed:

- **Mock Mode**: Frontend generates simulated data, no backend required
- **Real Mode**: Backend uses SQLite database at `data/oasis_frontend.db`
- **Cross-Machine**: Just copy the database file to migrate data

### Database Configuration

Set `OASIS_DB_PATH` environment variable in `backend/.env`:

```env
# Default location
OASIS_DB_PATH=data/oasis_frontend.db

# Custom location
OASIS_DB_PATH=/path/to/custom/database.db
```

## Original Scripts

The following original scripts are preserved:

- `start.bat` - Windows startup
- `start.sh` - Linux/Mac startup

## Troubleshooting

### Port Already in Use

If ports 5173 or 8765 are occupied, the script will attempt to free them. If it fails:

**Windows:**
```powershell
# Find and kill process on port 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Find and kill process on port 8765
netstat -ano | findstr :8765
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Find and kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Find and kill process on port 8765
lsof -ti:8765 | xargs kill -9
```

### Python Not Found

Ensure Python 3.10+ is installed and added to PATH:

```bash
python --version
```

### Node Not Found

Ensure Node.js 18+ is installed and added to PATH:

```bash
node --version
npm --version
```

## Project Structure

```
SocSim-Lab/
├── frontend/           # React + Vite frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── backend/            # FastAPI backend
│   ├── main.py
│   ├── requirements.txt
│   └── .env
├── data/               # SQLite database location
│   └── oasis_frontend.db
├── start_oneclick.bat  # Windows one-click start
├── start_oneclick.sh   # Linux/Mac one-click start
└── README.md
```
