; NSIS Installer Script - Clear cache on install
; This script is included by electron-builder to add custom installation logic

!macro customHeader
  ; Variables for cache cleanup
  !define APPDATA_CACHE "$APPDATA\CNC Dual head"
  !define LOCALAPPDATA_CACHE "$LOCALAPPDATA\CNC Dual head"
!macroend

!macro preInit
  ; Clear old app data directories before installation
  ${IfNot} ${FileExists} "$INSTDIR"
    RMDir /r "$APPDATA_CACHE"
    RMDir /r "$LOCALAPPDATA_CACHE"
  ${EndIf}
!macroend

!macro customInstall
  ; After installation, ensure cache is clean
  RMDir /r "$APPDATA_CACHE"
  RMDir /r "$LOCALAPPDATA_CACHE"
!macroend

!macro customUnInstall
  ; Clean up all app data on uninstall
  RMDir /r "$APPDATA\CNC Dual head"
  RMDir /r "$LOCALAPPDATA\CNC Dual head"
  RMDir /r "$APPDATA\electron"
!macroend
