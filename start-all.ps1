# Starts all services, each in its own PowerShell window, then waits until the
# Node API is ready.
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File .\start-all.ps1
# Skip the mobile app with:     .\start-all.ps1 -NoMobile

param([switch]$NoMobile)

$root = $PSScriptRoot

function Start-AppWindow($title, $dir, $command) {
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "`$host.UI.RawUI.WindowTitle = '$title'; Set-Location '$root\$dir'; $command"
    )
}

# Warn early if a port is already taken (e.g. a previous run still open).
foreach ($port in 8001, 5000, 5173, 8081) {
    $owner = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($owner) {
        $name = (Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue).ProcessName
        Write-Warning "Port $port is already in use by '$name' (PID $($owner.OwningProcess)). Close it first."
    }
}

# The phone app needs this PC's current LAN IP in mobile/.env (it changes when
# you switch Wi-Fi/hotspot). Warn if it's missing or out of date.
if (-not $NoMobile) {
    $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } | ForEach-Object { $_.IPAddress })
    $envFile = Join-Path $root "mobile\.env"
    if (-not (Test-Path $envFile)) {
        Write-Warning "mobile/.env is missing: the phone app will try 'localhost' and fail. Create it with EXPO_PUBLIC_NODE_API_URL=http://$($ips[0]):5000"
    } else {
        $line = Select-String -Path $envFile -Pattern '^EXPO_PUBLIC_NODE_API_URL=http://([\d.]+):' | Select-Object -First 1
        $configured = if ($line) { $line.Matches[0].Groups[1].Value } else { $null }
        if ($configured -and ($ips -notcontains $configured)) {
            Write-Warning "mobile/.env points to $configured but this PC's IP is now $($ips -join ', '). Update EXPO_PUBLIC_NODE_API_URL, or the phone app can't connect."
        }
    }
}

# 1. FastAPI classifier  -> http://127.0.0.1:8001  (docs at /docs)
#    Localhost only: phones reach it through the Node API (POST /api/predictions, JWT-protected).
#    8001 because 8000 is often taken on Windows; 8080 is used by Apache/XAMPP on this machine.
Start-AppWindow "FastAPI :8001" "backend" ".\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001"

# 2. Node API (auth, predictions, doctors, consultations, feedback) -> http://<your LAN IP>:5000
Start-AppWindow "Node API :5000" "feedback-api" "npm run dev"

# 3. Web app (patients, doctors and the admin portal at /admin) -> http://localhost:5173
Start-AppWindow "Web app :5173" "web" "npm run dev"

# 4. Expo mobile app -> scan the QR code with Expo Go (-c clears the cache so .env changes apply)
if (-not $NoMobile) {
    Start-AppWindow "Expo" "mobile" "npx expo start -c"
}

# Wait for the Node API: it answers immediately, but needs a few seconds to
# connect to MongoDB. Using the apps before that shows "starting up" messages.
Write-Host "Waiting for the Node API to connect to MongoDB" -NoNewline
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:5000/health" -TimeoutSec 2
        if ($health.database -eq "connected") { $ready = $true; break }
    } catch { }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 1
}
Write-Host ""
if ($ready) {
    Write-Host "Ready. FastAPI :8001 | Node API :5000 | Web app :5173 (admin: /admin) | Expo (QR in its window)" -ForegroundColor Green
} else {
    Write-Warning "The Node API isn't ready after 60 s. Check the 'Node API :5000' window (MongoDB/Atlas connection errors are explained there)."
}
