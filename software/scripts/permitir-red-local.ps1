param([int]$Port = 0, [string]$NodePath = '', [switch]$Elevated)
$ErrorActionPreference = 'Stop'
$projectFolder = Split-Path -Parent $PSScriptRoot
try {
    if ($Port -eq 0) {
        $runtimeFile = Join-Path $projectFolder '.local-runtime.json'
        if (-not (Test-Path -LiteralPath $runtimeFile)) { throw 'Inicia primero INICIAR_RED_LOCAL.cmd para conocer el puerto real.' }
        $runtimeSettings = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
        if (-not $runtimeSettings.chasquero.lan) { throw 'El sistema debe estar iniciado con INICIAR_RED_LOCAL.cmd.' }
        $Port = [int]$runtimeSettings.chasquero.webPort
    }
    if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Puerto web fuera del rango permitido.' }
    if (-not $NodePath) { $NodePath = (Get-Command node.exe -ErrorAction Stop).Source }
    $NodePath = (Resolve-Path -LiteralPath $NodePath).ProviderPath
    $ruleName = 'ChasqueroCoffee-LAN'
    $rule = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
    if ($rule) {
        $portFilter = $rule | Get-NetFirewallPortFilter
        $addressFilter = $rule | Get-NetFirewallAddressFilter
        $applicationFilter = $rule | Get-NetFirewallApplicationFilter
        $profileBits = [int]$rule.Profile
        if ([int]$rule.Enabled -eq 1 -and [int]$rule.Action -eq 2 -and [int]$rule.Direction -eq 1 -and [string]$portFilter.LocalPort -eq [string]$Port -and [string]$portFilter.Protocol -eq 'TCP' -and @($addressFilter.RemoteAddress).Count -eq 1 -and [string]$addressFilter.RemoteAddress -eq 'LocalSubnet' -and [string]$applicationFilter.Program -eq $NodePath -and ($profileBits -band 6) -eq 6) {
            Write-Host "El puerto $Port ya permite equipos de la misma red. No se requieren cambios."
            exit 0
        }
    }
    $isAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdministrator) {
        if ($Elevated) { throw 'Windows no concedio los permisos de administrador.' }
        Write-Host "Windows pedira permiso para abrir solo el puerto $Port a equipos de la misma red."
        $safeScript = '"' + $PSCommandPath + '"'
        $safeNode = '"' + $NodePath + '"'
        $child = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$safeScript,'-Port',$Port,'-NodePath',$safeNode,'-Elevated') -PassThru -Wait
        if ($child.ExitCode -ne 0) { throw 'No se completo la configuracion del firewall. Repite y acepta el aviso de Windows.' }
        Write-Host "Acceso de red configurado para el puerto $Port."
        exit 0
    }
    if ($rule) {
        Set-NetFirewallRule -Name $ruleName -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -RemoteAddress LocalSubnet -Program $NodePath -Profile Private,Public -EdgeTraversalPolicy Block | Out-Null
    } else {
        New-NetFirewallRule -Name $ruleName -DisplayName 'Chasquero Coffee - red local' -Description 'Acceso al sistema desde equipos de la misma subred Wi-Fi. Puerto del iniciador, redes privadas y publicas.' -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -RemoteAddress LocalSubnet -Program $NodePath -Profile Private,Public -EdgeTraversalPolicy Block | Out-Null
    }
    @{ port=$Port; program=$NodePath; remote='LocalSubnet'; profiles=@('Private','Public'); configuredAt=(Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectFolder '.lan-firewall.json') -Encoding UTF8
    Write-Host "Acceso de red configurado para el puerto $Port."
} catch {
    Write-Error $_.Exception.Message -ErrorAction Continue
    exit 1
}
