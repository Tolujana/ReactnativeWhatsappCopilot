@echo off
echo ================================================
echo 🧹 Clearing React Native caches (Windows CMD)
echo ================================================

REM 1. Kill any running Metro bundler or Node processes
echo 🔪 Stopping Metro bundler and Node processes...
taskkill /IM node.exe /F >nul 2>&1

REM 2. Reset Metro bundler cache
echo 🔄 Resetting Metro bundler cache...
npx react-native start --reset-cache

REM 3. Clear NPM cache (optional but recommended)
echo 📦 Clearing NPM cache...
npm cache clean --force

REM 4. Clear Gradle build cache and clean project
echo 🛠️ Cleaning Android build cache...
cd android
gradlew clean

REM 5. Delete Gradle cache directories
echo 🗑️ Deleting Gradle cache folders...
rmdir /s /q "%USERPROFILE%\.gradle\caches"
rmdir /s /q "%USERPROFILE%\.gradle\build-cache"

REM 6. Delete Android build folders
echo 🧱 Removing build directories...
rmdir /s /q app\build
cd ..

REM 7. Optional: Clear watchman (only if installed via WSL)
echo 👀 Skipping Watchman (not available on Windows)...

echo ✅ All caches cleared successfully!
echo ================================================
echo 💡 You can now rebuild the project with:
echo     npx react-native run-android
echo ================================================

pause
