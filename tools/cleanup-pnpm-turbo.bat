@echo off
echo 🧹 Starting comprehensive pnpm and turbo cleanup...
echo ==================================================

echo.
echo 📁 Cleaning root level...
if exist "node_modules" (
    echo 🗑️  Removing: node_modules
    rmdir /s /q "node_modules"
) else (
    echo ℹ️  Not found: node_modules
)

if exist ".turbo" (
    echo 🗑️  Removing: .turbo
    rmdir /s /q ".turbo"
) else (
    echo ℹ️  Not found: .turbo
)

if exist "pnpm-lock.yaml" (
    echo 🗑️  Removing: pnpm-lock.yaml
    del "pnpm-lock.yaml"
) else (
    echo ℹ️  Not found: pnpm-lock.yaml
)

echo.
echo 📱 Cleaning apps...
if exist "apps\express-api\node_modules" (
    echo 🗑️  Removing: apps\express-api\node_modules
    rmdir /s /q "apps\express-api\node_modules"
) else (
    echo ℹ️  Not found: apps\express-api\node_modules
)

if exist "apps\client-ui\node_modules" (
    echo 🗑️  Removing: apps\client-ui\node_modules
    rmdir /s /q "apps\client-ui\node_modules"
) else (
    echo ℹ️  Not found: apps\client-ui\node_modules
)

echo.
echo 📦 Cleaning packages...
if exist "packages\macro-ai-api-client\node_modules" (
    echo 🗑️  Removing: packages\macro-ai-api-client\node_modules
    rmdir /s /q "packages\macro-ai-api-client\node_modules"
) else (
    echo ℹ️  Not found: packages\macro-ai-api-client\node_modules
)

if exist "packages\config-typescript\node_modules" (
    echo 🗑️  Removing: packages\config-typescript\node_modules
    rmdir /s /q "packages\config-typescript\node_modules"
) else (
    echo ℹ️  Not found: packages\config-typescript\node_modules
)

if exist "packages\config-testing\node_modules" (
    echo 🗑️  Removing: packages\config-testing\node_modules
    rmdir /s /q "packages\config-testing\node_modules"
) else (
    echo ℹ️  Not found: packages\config-testing\node_modules
)

if exist "packages\config-eslint\node_modules" (
    echo 🗑️  Removing: packages\config-eslint\node_modules
    rmdir /s /q "packages\config-eslint\node_modules"
) else (
    echo ℹ️  Not found: packages\config-eslint\node_modules
)

if exist "packages\types-macro-ai-api\node_modules" (
    echo 🗑️  Removing: packages\types-macro-ai-api\node_modules
    rmdir /s /q "packages\types-macro-ai-api\node_modules"
) else (
    echo ℹ️  Not found: packages\types-macro-ai-api\node_modules
)

echo.
echo 🏗️  Cleaning infrastructure...
if exist "infrastructure\node_modules" (
    echo 🗑️  Removing: infrastructure\node_modules
    rmdir /s /q "infrastructure\node_modules"
) else (
    echo ℹ️  Not found: infrastructure\node_modules
)

if exist "infrastructure\.turbo" (
    echo 🗑️  Removing: infrastructure\.turbo
    rmdir /s /q "infrastructure\.turbo"
) else (
    echo ℹ️  Not found: infrastructure\.turbo
)

echo.
echo 🧹 Clearing pnpm cache...
pnpm store prune

echo.
echo 🧹 Clearing turbo cache...
npx turbo clean

echo.
echo ✅ Cleanup complete!
echo.
echo Next steps:
echo 1. Run: pnpm install
echo 2. If issues persist, try: pnpm install --force
echo.
echo Note: This will take some time as it needs to download all dependencies again.
pause
