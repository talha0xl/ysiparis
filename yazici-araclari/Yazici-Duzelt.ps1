# Yavuztürk Adisyon - Yazıcı Otomatik Düzeltme
# Çift tıkla değil, "Yazici Duzelt.bat" ile çalıştır (yönetici izni ister).
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Adisyon - Yazici Duzelt'

function Yazi($m, $r = 'White') { Write-Host $m -ForegroundColor $r }

# --- Yönetici değilse kendini yönetici olarak yeniden aç
$kimlik = [Security.Principal.WindowsIdentity]::GetCurrent()
$yonetici = (New-Object Security.Principal.WindowsPrincipal $kimlik).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $yonetici) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Yazi ''
Yazi '=== ADISYON YAZICI DUZELT ===' Cyan
Yazi ''

# 1) Yazdırma servisini yenile, takılı işleri temizle
Yazi '1/5  Yazdirma servisi yenileniyor, takili isler temizleniyor...'
try {
    Stop-Service Spooler -Force -ErrorAction Stop
    Remove-Item "$env:windir\System32\spool\PRINTERS\*" -Force -ErrorAction SilentlyContinue
    Start-Service Spooler
    Yazi '     tamam' Green
} catch { Yazi ('     uyari: ' + $_.Exception.Message) Yellow }

# 2) Windows varsayılan yazıcıyı kendi değiştirmesin
Yazi '2/5  "Windows varsayilan yaziciyi yonetsin" kapatiliyor...'
try {
    $k = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows'
    Set-ItemProperty -Path $k -Name LegacyDefaultPrinterMode -Value 1 -Type DWord
    Yazi '     tamam' Green
} catch { Yazi ('     uyari: ' + $_.Exception.Message) Yellow }

# 3) Fiş yazıcısı adayları: USB portlu, sanal olmayan yazıcılar
Yazi '3/5  Fis yazicisi araniyor (USB)...'
$adaylar = @(Get-Printer | Where-Object { $_.PortName -like 'USB*' })
if ($adaylar.Count -eq 0) {
    Yazi '     USB bagli yazici bulunamadi. Yazicinin kablosunu ve acik oldugunu kontrol et,' Red
    Yazi '     surucuyu (POS-80C vb.) kurduktan sonra bu dosyayi tekrar calistir.' Red
    Read-Host 'Kapatmak icin Enter'
    exit
}
Yazi ('     bulunan: ' + (($adaylar | ForEach-Object { $_.Name + ' [' + $_.PortName + ']' }) -join ', ')) Green

# çevrimdışı işaretini kaldır
foreach ($a in $adaylar) {
    try {
        Get-CimInstance Win32_Printer -Filter ("Name='" + ($a.Name -replace "'", "''") + "'") |
            Set-CimInstance -Property @{ WorkOffline = $false } -ErrorAction SilentlyContinue
    } catch { }
}

# 4) Hangisi gerçekten basıyor? Tek aday varsa doğrudan o, birden fazlaysa test sayfasıyla
$secilen = $null
if ($adaylar.Count -eq 1) {
    $secilen = $adaylar[0].Name
    Yazi '4/5  Tek yazici var, o seciliyor.'
} else {
    Yazi '4/5  Birden fazla kopya var. Sirayla test sayfasi basiliyor...'
    foreach ($a in $adaylar) {
        Yazi ''
        Yazi ('     Deneniyor: ' + $a.Name + '  [' + $a.PortName + ']') Cyan
        & rundll32.exe printui.dll,PrintUIEntry /k /n "$($a.Name)"
        Start-Sleep -Seconds 5
        $c = Read-Host '     Kagit cikti mi? (E = evet, H = hayir)'
        if ($c -match '^[EeYy]') { $secilen = $a.Name; break }
    }
}
if (-not $secilen) {
    Yazi 'Hicbirinden kagit cikmadi. Kagit, kapak, USB kablosu ve yazici gucunu kontrol et.' Red
    Read-Host 'Kapatmak icin Enter'
    exit
}

# 5) Seçileni varsayılan yap, gerçek yazıcı dışındaki kopyaları sil (isteğe bağlı)
Yazi ''
Yazi ('5/5  Varsayilan yazici yapiliyor: ' + $secilen)
(New-Object -ComObject WScript.Network).SetDefaultPrinter($secilen)
$klasor = Join-Path $env:LOCALAPPDATA 'AdisyonKasa'
New-Item -ItemType Directory -Force -Path $klasor | Out-Null
Set-Content -Path (Join-Path $klasor 'yazici.txt') -Value $secilen -Encoding Default
Yazi '     tamam' Green

$digerleri = @($adaylar | Where-Object { $_.Name -ne $secilen })
if ($digerleri.Count -gt 0) {
    Yazi ''
    Yazi ('Calismayan kopyalar: ' + (($digerleri | ForEach-Object { $_.Name }) -join ', ')) Yellow
    $s = Read-Host 'Bunlar silinsin mi? (E/H)  - Silmen onerilir, Windows yanlislikla ona donmesin'
    if ($s -match '^[EeYy]') {
        foreach ($d in $digerleri) {
            try { Remove-Printer -Name $d.Name -ErrorAction Stop; Yazi ('     silindi: ' + $d.Name) Green }
            catch { Yazi ('     silinemedi: ' + $d.Name + ' - ' + $_.Exception.Message) Yellow }
        }
    }
}

Yazi ''
Yazi 'BITTI. Simdi Adisyon Kasa kisayolunu ac, Baslat > Deneme Fisi ile dene.' Green
Yazi 'Yazicinin USB kablosunu hep ayni girise tak; baska girise takarsan bu dosyayi tekrar calistir.' Yellow
Read-Host 'Kapatmak icin Enter'
