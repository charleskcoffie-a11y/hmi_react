!include "MUI2.nsh"
!include "x64.nsh"

!macro customHeader
  !define APPDATA_CACHE "$APPDATA\CNC Dual head"
  !define LOCALAPPDATA_CACHE "$LOCALAPPDATA\CNC Dual head"
!macroend

!macro preInit
  StrCpy $INSTDIR "C:\CNC"
  ${IfNot} ${FileExists} "C:\CNC"
    RMDir /r "$APPDATA_CACHE"
    RMDir /r "$LOCALAPPDATA_CACHE"
  ${EndIf}
!macroend

!macro customInit
  StrCpy $INSTDIR "C:\CNC"
  StrCpy $0 "C:\CNC"
!macroend

!macro customInstall
  RMDir /r "$APPDATA_CACHE"
  RMDir /r "$LOCALAPPDATA_CACHE"
!macroend

!macro customUnInstall
  RMDir /r "$APPDATA\CNC Dual head"
  RMDir /r "$LOCALAPPDATA\CNC Dual head"
  RMDir /r "$APPDATA\electron"
!macroend
