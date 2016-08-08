@echo off
REM Following is for expansion of variables at runtime - e.g. !e! instead of %e%
setlocal EnableDelayedExpansion
SET script_folder=%~dp0
cd %script_folder:~0,-1%

REM Based on https://developer.mozilla.org/en/Setting_up_extension_development_environment and http://kb.mozillazine.org/Profile_folder_-_Firefox
REM This script accepts an optional parameter, which is a name of Firefox profile. Otherwise it uses 'default' profile. Either way, the profile must have been created by Firefox (i.e. its folder name must be in standard format).
if not "%1"=="" (
    set profile=%1
) else (
    set profile=default
)

for /D %%c in ("%APPDATA%\Mozilla\Firefox\Profiles\*.%profile%") do set p=%%c
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

    if not exist "!e!\clipboard-and-indent@selite.googlecode.com.xpi" (
      cd clipboard-and-indent\src
      cd > "!e!\clipboard-and-indent@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\extension-sequencer@selite.googlecode.com.xpi" (
      cd extension-sequencer\src
      cd > "!e!\extension-sequencer@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\hands-on-gui@selite.googlecode.com.xpi" (
      cd hands-on-gui\src
      cd > "!e!\hands-on-gui@selite.googlecode.com"
      cd ..\..
    )

    if not exist "!e!\settings@selite.googlecode.com.xpi" (
      cd settings\src
      cd > "!e!\settings@selite.googlecode.com"
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

   if not exist "!e!\preview@selite.googlecode.com.xpi" (
      cd preview\src
      cd > "!e!\preview@selite.googlecode.com"
      cd ..\..
    )
) else (
   echo Could not find Firefox profile "%profile%"
)
echo Start Firefox with that profile. You may need to accept add-ons. Verify that all SeLite add-ons are enabled at Firefox menu > Tools > Add-ons > Extensions.