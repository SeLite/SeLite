@echo off
REM Following is for expansion of variables at runtime - e.g. !e! instead of %e%
setlocal EnableDelayedExpansion
SET script_folder=%~dp0
cd %script_folder:~0,-1%

for /f "tokens=*" %%a in ('dir  %APPDATA%\Mozilla\Firefox\Profiles\*.default /b') do set p=%APPDATA%\Mozilla\Firefox\Profiles\%%a
if defined p (
    set e="%p%\extensions"
    REM If you have not got any extensions in Firefox profile yet, there is no 'extensions' folder. So create it.
    if not exist "!e!" (
      mkdir "!e!"
    )
    
    REM Now set up the actual extensions, unless they are already installed from XPI    
    REM Do not use: echo %CD% >target-file. Use: cd >target-file. For some reason %CD% doesn't get updated after I change directory.
    if not exist "!e!\auto-check@selite.googlecode.com.xpi" (
      cd auto-check\src
      cd > "!e!\auto-check@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\bootstrap@selite.googlecode.com.xpi" (
      cd bootstrap\src
      cd > "!e!\bootstrap@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\extension-sequencer@selite.googlecode.com.xpi" (
      cd extension-sequencer\src
      cd > "!e!\extension-sequencer@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\settings@selite.googlecode.com.xpi" (
      cd settings\src
      cd > "!e!\settings@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\sqlite-connection-manager@selite.googlecode.com.xpi" (
      cd sqlite-connection-manager\src
      cd > "!e!\sqlite-connection-manager@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\testcase-debug-context@selite.googlecode.com.xpi" (
      cd testcase-debug-context\src
      cd > "!e!\testcase-debug-context@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\misc@selite.googlecode.com.xpi" (
      cd misc\src
      cd > "!e!\misc@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\db-objects@selite.googlecode.com.xpi" (
      cd db-objects\src
      cd > "!e!\db-objects@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\commands@selite.googlecode.com.xpi" (
      cd commands\src
      cd > "!e!\commands@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\exit-confirmation-checker@selite.googlecode.com.xpi" (
      cd exit-confirmation-checker\src
      cd > "!e!\exit-confirmation-checker@selite.googlecode.com"
      cd ..\..
    )

   if not exist "!e!\run-all-favorites@selite.googlecode.com.xpi" (
      cd run-all-favorites\src
      cd > "!e!\run-all-favorites@selite.googlecode.com"
      cd ..\..
    )
) else (
   echo Could not find a default Firefox profile
)