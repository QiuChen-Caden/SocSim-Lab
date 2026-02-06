# One-click Startup

This project now has additional one-click startup scripts, while keeping the original startup scripts unchanged.

## New scripts

- `start_oneclick.bat` (Windows)
- `start_oneclick.sh` (Linux/Mac)

## What they do

1. Check `python`/`node` availability.
2. Try to free ports `5173` (frontend) and `8765` (backend).
3. Start backend and frontend.
4. Keep original `start.bat` / `start.sh` untouched.

## URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://127.0.0.1:8765`
- Backend docs: `http://127.0.0.1:8765/docs`

## Original scripts preserved

- `start.bat`
- `start.sh`
