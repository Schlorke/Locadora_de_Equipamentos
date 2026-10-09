# 354-device

## Objetivo

Descobrir se há emulador ou aparelho Android para o app mobile (`adb` /
`adb devices`). Host Windows — sem procurar simulador iOS. Sem instalar Android
SDK. Sem subir Expo. Sem instalar o app.

## Resultado

- `adb` no PATH: **ausente** (`where` / `Get-Command` → não encontrado)
- Binário local (sem instalar SDK): presente em
  `C:\Users\harry\AppData\Local\Android\Sdk\platform-tools\adb.exe` (ADB 1.0.41
  / 37.0.0-14910828)
- `ANDROID_HOME` / `ANDROID_SDK_ROOT`: vazios no processo
- `adb devices -l`: lista **vazia** (daemon iniciado; nenhum device/ emulator
  attached)
- Expo: **não iniciado**
- Instalação / bundle do app: **não executados**
- Simulador iOS: não pesquisado (host Windows)
- Sem commit
- Carrossel 3D intacto

## Bloqueio

Nenhum device nem emulator listado por `adb devices`.

## Não verificado

- `[NOT_VERIFIED: pnpm test (sem credencial de Postgres local)]`
- `[NOT_VERIFIED: cobertura]`
- `[NOT_VERIFIED: device_or_emulator]`
