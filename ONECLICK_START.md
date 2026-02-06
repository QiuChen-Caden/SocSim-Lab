# One-click Startup

This project now has additional one-click startup scripts, while keeping the original startup scripts unchanged.

## New scripts

- `start_oneclick.bat` (Windows)
- `start_oneclick.sh` (Linux/Mac)

## What they do

1. Check `python`/`node` availability.
2. Try to free ports `5173` (frontend) and `8000` (backend).
3. Start backend and frontend.
4. Keep original `start.bat` / `start.sh` untouched.

## URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://127.0.0.1:8000`
- Backend docs: `http://127.0.0.1:8000/docs`

## Manual start commands (PowerShell, verified)

Backend:

```powershell
Set-Location "C:\Users\Lenovo\Desktop\SocSim-Lab\backend"
$env:PYTHONIOENCODING = "utf-8"
.\venv\Scripts\python.exe .\main.py
```

Frontend:

```powershell
Set-Location "C:\Users\Lenovo\Desktop\SocSim-Lab\frontend"
npx vite --host 127.0.0.1 --port 5173 --config vite.config.js --configLoader native
```

## Original scripts preserved

- `start.bat`
- `start.sh`
