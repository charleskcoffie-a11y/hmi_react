; NSIS Installer Script - Force installation to C:\CNC\
; This script is included by electron-builder to customize the installation

RequestExecutionLevel admin

!define INSTALL_PATH "C:\CNC"
!define APPDATA_CACHE "$APPDATA\CNC Dual head"
!define LOCALAPPDATA_CACHE "$LOCALAPPDATA\CNC Dual head"

!macro customHeader
  ; Force the default installation directory immediately
  InstallDir "${INSTALL_PATH}"
!macroend

!macro preInit
  ; Override any previous $INSTDIR setting
  StrCpy $INSTDIR "${INSTALL_PATH}"
!macroend

!macro customInstall
  ; Clean app cache after installation
  RMDir /r "${APPDATA_CACHE}"
  RMDir /r "${LOCALAPPDATA_CACHE}"
  
  ; Explicitly create desktop shortcut
  CreateDirectory "$DESKTOP"
  CreateShortCut "$DESKTOP\CNC Dual head.lnk" "$INSTDIR\CNC Dual head.exe" "" "$INSTDIR\CNC Dual head.exe" 0
  
  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\CNC Dual head"
  CreateShortCut "$SMPROGRAMS\CNC Dual head\CNC Dual head.lnk" "$INSTDIR\CNC Dual head.exe" "" "$INSTDIR\CNC Dual head.exe" 0
!macroend

!macro customUnInstall
  ; Clean up all app data on uninstall
  RMDir /r "${APPDATA_CACHE}"
  RMDir /r "${LOCALAPPDATA_CACHE}"
  RMDir /r "$APPDATA\electron"
  
  ; Remove shortcuts
  Delete "$DESKTOP\CNC Dual head.lnk"
  RMDir /r "$SMPROGRAMS\CNC Dual head"
!macroend
