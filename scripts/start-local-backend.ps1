$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$dataDirectory = Join-Path $projectRoot '.firebase-data'

Push-Location $projectRoot
try {
  $emulatorArguments = @(
    'emulators:start',
    '--only',
    'auth,firestore',
    '--project',
    'demo-venturego-local',
    "--export-on-exit=$dataDirectory"
  )

  if (Test-Path $dataDirectory) {
    $emulatorArguments += "--import=$dataDirectory"
  }

  & firebase @emulatorArguments
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
