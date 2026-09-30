<#
.SYNOPSIS
    Repairs the Android build scaffolding for the TrustLayer Flutter app.

.DESCRIPTION
    apps/mobile/android ships WITHOUT the Gradle wrapper (gradlew, gradlew.bat,
    gradle/wrapper/gradle-wrapper.jar). These are required to build, and
    gradle-wrapper.jar is a compiled binary that cannot be hand-authored, so this
    script asks the Flutter tool to generate a throwaway reference project and
    then copies across ONLY the files that are missing here.

    Everything that has been deliberately customised is preserved:
      AndroidManifest.xml, res/** (icons, themes, network + backup policy),
      app/build.gradle, settings.gradle, gradle-wrapper.properties,
      proguard-rules.pro

    It finishes by running `flutter pub get`, `flutter analyze` and
    `flutter test`, so a failure surfaces immediately.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tool/bootstrap_android.ps1
#>
[CmdletBinding()]
param(
    [string]$Org = 'com.trustlayer',
    [string]$ProjectName = 'trustlayer'
)

$ErrorActionPreference = 'Stop'

$mobileDir = Split-Path -Parent $PSScriptRoot      # apps/mobile
$androidDir = Join-Path $mobileDir 'android'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# --- 0. Preconditions ------------------------------------------------------
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    throw 'flutter was not found on PATH. Install the Flutter SDK first (see phone_test.txt).'
}
if (-not (Test-Path $androidDir)) {
    throw "Expected $androidDir to exist."
}

Write-Step 'Flutter toolchain'
& flutter --version | Select-Object -First 1

# --- 1. Generate a reference project into a temp dir ----------------------
Write-Step 'Generating a reference Flutter project in a temp directory'
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$tmpRoot = Join-Path $env:TEMP "tl_android_ref_$stamp"
$refAndroid = Join-Path $tmpRoot (Join-Path $ProjectName 'android')

Push-Location $tmpRoot -ErrorAction SilentlyContinue
if (-not (Test-Path $tmpRoot)) { New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null; Push-Location $tmpRoot }

try {
    & flutter create --platforms=android --project-name $ProjectName --org $Org $ProjectName
    if ($LASTEXITCODE -ne 0) { throw "flutter create failed (exit $LASTEXITCODE)." }
    if (-not (Test-Path $refAndroid)) { throw "Reference android/ not found at $refAndroid" }

    # --- 2. Copy only the missing files ------------------------------------
    Write-Step 'Copying missing Gradle wrapper files'
    $copied = 0

    foreach ($rel in @('gradlew', 'gradlew.bat')) {
        $src = Join-Path $refAndroid $rel
        $dst = Join-Path $androidDir $rel
        if ((Test-Path $src) -and -not (Test-Path $dst)) {
            Copy-Item $src $dst -Force
            Write-Host "   + $rel"
            $copied++
        }
    }

    # The wrapper JAR bootstraps Gradle and is a binary artifact.
    $jarSrc = Join-Path $refAndroid 'gradle\wrapper\gradle-wrapper.jar'
    $jarDst = Join-Path $androidDir 'gradle\wrapper\gradle-wrapper.jar'
    if ((Test-Path $jarSrc) -and -not (Test-Path $jarDst)) {
        New-Item -ItemType Directory -Path (Split-Path -Parent $jarDst) -Force | Out-Null
        Copy-Item $jarSrc $jarDst -Force
        Write-Host '   + gradle/wrapper/gradle-wrapper.jar'
        $copied++
    }

    Write-Step 'Copying any other missing reference files (additive only)'
    Get-ChildItem -Path $refAndroid -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($refAndroid.Length + 1)

        # Never overwrite anything we intentionally control.
        if ($rel -match '^(gradlew|gradlew\.bat)$') { return }
        if ($rel -match 'gradle-wrapper\.properties$') { return }
        if ($rel -match '^(build|settings)\.gradle$') { return }
        if ($rel -match 'app[\\/]build\.gradle$') { return }
        if ($rel -match 'proguard-rules\.pro$') { return }
        if ($rel -match 'app[\\/]src[\\/]main[\\/]AndroidManifest\.xml$') { return }
        if ($rel -match 'app[\\/]src[\\/]main[\\/]res[\\/]') { return }
        if ($rel -match 'app[\\/]src[\\/](debug|profile)[\\/]AndroidManifest\.xml$') { return }
        if ($rel -match 'MainActivity\.kt$') { return }

        $dst = Join-Path $androidDir $rel
        if (-not (Test-Path $dst)) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
            Copy-Item $_.FullName $dst -Force
            Write-Host "   + $rel"
            $copied++
        }
    }

    Write-Host "`nCopied $copied missing file(s)."
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $tmpRoot -ErrorAction SilentlyContinue
}

# --- 3. Confirm the Gradle pin survives -----------------------------------
Write-Step 'Verifying the Gradle wrapper version pin'
$propsPath = Join-Path $androidDir 'gradle\wrapper\gradle-wrapper.properties'
if (Test-Path $propsPath) {
    $url = (Select-String -Path $propsPath -Pattern '^distributionUrl=' | Select-Object -First 1).Line
    Write-Host "   $url"
    if ($url -notmatch 'gradle-8\.') {
        Write-Warning 'Gradle is not pinned to 8.x, but app/build.gradle uses AGP 8.2.2, which requires Gradle 8.2+.'
    }
}
else {
    Write-Warning "Missing $propsPath"
}

# --- 4. Fetch packages and verify ------------------------------------------
Push-Location $mobileDir
try {
    Write-Step 'flutter pub get'
    & flutter pub get
    if ($LASTEXITCODE -ne 0) { throw "flutter pub get failed (exit $LASTEXITCODE)." }

    Write-Step 'flutter analyze'
    & flutter analyze

    Write-Step 'flutter test'
    & flutter test
}
finally {
    Pop-Location
}

Write-Host "`nAndroid scaffolding repaired." -ForegroundColor Green
Write-Host 'Next, with your phone connected over USB:'
Write-Host '  flutter run --dart-define=API_BASE_URL=http://<your-LAN-ip>:8001'
