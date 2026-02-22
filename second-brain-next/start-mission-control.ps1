$ErrorActionPreference = 'Stop'
$project = 'C:\Users\yokim\.openclaw\workspace\second-brain-next'
$port = 3001

$listening = netstat -ano | Select-String ":$port" | Select-String 'LISTENING'
if ($listening) {
  Write-Output "mission-control already listening on $port"
  exit 0
}

$cmd = "cd /d `"$project`" && npx next dev -H 0.0.0.0 -p $port"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WindowStyle Hidden
Write-Output "mission-control (dev mode) started on $port"
