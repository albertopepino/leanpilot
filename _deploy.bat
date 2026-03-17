@echo off
setlocal
cd /d "%~dp0"

echo === LeanPilot Deploy ===
echo.

REM 1. Create tar.gz excluding unnecessary files
echo [1/4] Creating deploy archive...
tar -czf deploy.tar.gz ^
  --exclude="frontend/node_modules" ^
  --exclude="frontend/.next" ^
  --exclude="frontend/tsconfig.tsbuildinfo" ^
  --exclude="backend/__pycache__" ^
  --exclude="backend/.venv" ^
  --exclude="backend/app/__pycache__" ^
  --exclude="**/__pycache__" ^
  --exclude="**/.DS_Store" ^
  --exclude=".git" ^
  --exclude="deploy.tar.gz" ^
  --exclude="_deploy.bat" ^
  --exclude="backend/.env" ^
  --exclude=".env" ^
  backend frontend docker-compose.prod.yml deploy.sh nginx.conf

if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to create archive
    pause
    exit /b 1
)
echo    Archive created: deploy.tar.gz

REM 2. Upload to server
echo.
echo [2/4] Uploading to server...
scp -i "C:\Users\grass\Downloads\leansuite1.pem" deploy.tar.gz ubuntu@ec2-13-63-80-166.eu-north-1.compute.amazonaws.com:/home/ubuntu/deploy.tar.gz

if %ERRORLEVEL% neq 0 (
    echo ERROR: Upload failed. Check SSH key and server connection.
    pause
    exit /b 1
)
echo    Upload complete

REM 3. Extract on server
echo.
echo [3/4] Extracting on server...
ssh -i "C:\Users\grass\Downloads\leansuite1.pem" ubuntu@ec2-13-63-80-166.eu-north-1.compute.amazonaws.com "cd /home/ubuntu && tar -xzf deploy.tar.gz -C lean-os --strip-components=0"

if %ERRORLEVEL% neq 0 (
    echo ERROR: Extraction failed
    pause
    exit /b 1
)
echo    Extraction complete

REM 4. Run deploy script on server
echo.
echo [4/4] Running deploy on server...
ssh -i "C:\Users\grass\Downloads\leansuite1.pem" ubuntu@ec2-13-63-80-166.eu-north-1.compute.amazonaws.com "cd /home/ubuntu/lean-os && chmod +x deploy.sh && ./deploy.sh"

echo.
echo === Done ===
pause
