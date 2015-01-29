@echo off
REM Following is for expansion of variables at runtime - e.g. !e! instead of %e%
setlocal EnableDelayedExpansion

REM do not enclose strings in "..", as those quotes would become a part of the variable's value
SET script_folder=%~dp0
cd %script_folder:~0,-1%

set FIREFOX_FOLDER=%APPDATA%\Mozilla\Firefox
if not exist "%FIREFOX_FOLDER%\Profiles\*.SeLiteExtensionSequencerTest" (
    REM Watchout for false errors: This has once created a profile folder, but firefox -no-remote -P (v. 32.0.3, Windows 7 SP1) didn't recognise the profile later. 
    firefox -no-remote -CreateProfile SeLiteExtensionSequencerTest
)
for /D %%c in ("!FIREFOX_FOLDER!\Profiles\*.SeLiteExtensionSequencerTest") do set PROFILE_FOLDER=%%c

if defined PROFILE_FOLDER (
    set EXTENSION_FOLDER=!PROFILE_FOLDER!\extensions
    REM If you have not got any extensions in Firefox profile yet, there is no 'extensions' folder. So create it.
    if not exist "!EXTENSION_FOLDER!" (
      mkdir "!EXTENSION_FOLDER!"
    )
    
    cd ..\src
    cd >"!EXTENSION_FOLDER!\extension-sequencer@selite.googlecode.com"
    cd ..\shell-tests

    REM Do not use: echo %CD% >target-file. Use: cd >target-file. For some reason %CD% doesn't get updated after I change directory.
    cd extensions\rail
    cd >"!EXTENSION_FOLDER!\test-rail@selite.googlecode.com"
    cd ..\train
    cd >"!EXTENSION_FOLDER!\test-train@selite.googlecode.com"
    cd ..\journey
    cd >"!EXTENSION_FOLDER!"\test-journey@selite.googlecode.com"
    echo Now starting firefox -P SeLiteExtensionSequencerTest. You may need to accept the test add-ons. Then close Firefox. After that you can use run_tests.ps1.
    REM Windows commandline doesn't have logical operators, hence if.. if.. to simulate AND (to check for Selenium IDE installed either via an .xpi, or through a proxy file) 
    if not exist "!EXTENSION_FOLDER!\{a6fd85ed-e919-4a43-a5af-8da18bda539f}.xpi" (
        if not exist "!EXTENSION_FOLDER!{a6fd85ed-e919-4a43-a5af-8da18bda539f}" (
            echo You also need to download Selenium IDE from http://docs.seleniumhq.org/download/ and install it.
            firefox -no-remote -P SeLiteExtensionSequencerTest http://docs.seleniumhq.org/download/
        ) else (
            firefox -no-remote -P SeLiteExtensionSequencerTest
        )
    ) else (
        firefox -no-remote -P SeLiteExtensionSequencerTest
    )

) else (
   echo Could not find or create Firefox profile SeLiteExtensionSequencerTest
)