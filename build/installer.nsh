; Custom NSIS installer hooks for Card Manager
; Install Visual C++ Redistributable if not present (required by better-sqlite3, pcsclite)

!macro customInstall
  ; Check if VC++ Redistributable 2015-2022 (x64) is already installed
  ReadRegDWord $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64" "Installed"
  ${If} $0 != 1
    DetailPrint "Installing Visual C++ Redistributable..."
    File "/oname=$PLUGINSDIR\vc_redist.x64.exe" "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
    ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /install /quiet /norestart' $1
    DetailPrint "VC++ Redistributable installer returned: $1"
  ${Else}
    DetailPrint "Visual C++ Redistributable already installed."
  ${EndIf}

  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\Card Manager.lnk" "$INSTDIR\Card Manager.exe"
!macroend
