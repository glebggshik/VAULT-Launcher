; ── VAULT Launcher — кастомный NSIS скрипт ────────────────────────────────────
; Добавляет секцию после установки: ярлык, запись в "Установка и удаление программ"

!macro customInstall
  ; Создаём ярлык в меню Пуск
  CreateDirectory "$SMPROGRAMS\VAULT Launcher"
  CreateShortCut "$SMPROGRAMS\VAULT Launcher\VAULT Launcher.lnk" "$INSTDIR\VAULT Launcher.exe"
  CreateShortCut "$SMPROGRAMS\VAULT Launcher\Удалить VAULT Launcher.lnk" "$INSTDIR\Uninstall VAULT Launcher.exe"

  ; Запись в реестр для "Установка и удаление программ"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VaultLauncher" \
    "DisplayName" "VAULT Launcher"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VaultLauncher" \
    "DisplayVersion" "1.0.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VaultLauncher" \
    "Publisher" "VAULT"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VaultLauncher" \
    "URLInfoAbout" "https://github.com/vault-launcher"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VaultLauncher" \
    "DisplayIcon" "$INSTDIR\resources\assets\icon.ico"
!macroend

!macro customUnInstall
  ; Удаляем ярлыки
  Delete "$SMPROGRAMS\VAULT Launcher\VAULT Launcher.lnk"
  Delete "$SMPROGRAMS\VAULT Launcher\Удалить VAULT Launcher.lnk"
  RMDir  "$SMPROGRAMS\VAULT Launcher"
  Delete "$DESKTOP\VAULT Launcher.lnk"
  
  ; Удаляем запись реестра
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VaultLauncher"
!macroend
