@echo off
echo Building Blockpanel Windows Application...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    rem try the Python launcher for Windows
    py -3 --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo Error: Python is not installed. Please install Python 3 from https://python.org/
        pause
        exit /b 1
    )
)

echo.
echo Installing dependencies...

REM Install Windows app dependencies
echo Installing Electron dependencies...
npm install
if %errorlevel% neq 0 (
    echo Error installing Electron dependencies
    pause
    exit /b 1
)

REM Install frontend dependencies
echo Installing frontend dependencies...
pushd ..\frontend
npm install
if %errorlevel% neq 0 (
    echo Error installing frontend dependencies
    popd
    pause
    exit /b 1
)
popd

REM Install backend dependencies
echo Installing backend dependencies...
pushd ..\backend
rem use py -3 if available, otherwise fall back to python
py -3 -m pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 (
    python -m pip install -r requirements.txt
)
if %errorlevel% neq 0 (
    echo Error installing backend dependencies
    popd
    pause
    exit /b 1
)
popd

rem ensure we are back in windows-app (if not already)
pushd ..\windows-app >nul 2>&1 || (echo Continuing in current directory)
popd >nul 2>&1 || (echo )

echo.
echo Building frontend...
npm run build-frontend
if %errorlevel% neq 0 (
    echo Error building frontend
    pause
    exit /b 1
)

echo.
echo Building Windows application...
npm run dist
if %errorlevel% neq 0 (
    echo Error building Windows application
    pause
    exit /b 1
)

echo.
echo Build completed successfully!
echo The installer can be found in the 'dist' folder.
pause
