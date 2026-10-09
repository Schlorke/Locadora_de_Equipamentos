# Desbloqueia o binário nativo do Rollup (Windows) para permitir pnpm test
# Uso: powershell -ExecutionPolicy Bypass -File scripts/unblock-rollup.ps1
$found = Get-ChildItem -Path "node_modules" -Recurse -Filter "rollup.win32-x64-msvc.node" -ErrorAction SilentlyContinue
if ($found) {
  foreach ($f in $found) {
    Unblock-File -LiteralPath $f.FullName
    Write-Host "Desbloqueado: $($f.FullName)"
  }
  Write-Host "Execute: pnpm test"
} else {
  Write-Host "Arquivo rollup.win32-x64-msvc.node nao encontrado. Tente: pnpm install --force (nunca apague node_modules a mao; veja 'Limpeza segura' em docs/getting-started/troubleshooting.md)"
}
