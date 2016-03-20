@echo off
REM This requires Java's jar. Alternatively, use Powershell and apply:
REM Add-Type -A System.IO.Compression.FileSystem
REM [IO.Compression.ZipFile]::CreateFromDirectory('foo', 'foo.zip')

REM Following is for expansion of variables at runtime - e.g. !e! instead of %e%
setlocal EnableDelayedExpansion
SET script_folder=%~dp0
cd %script_folder:~0,-1%

REM Create folder "xpi", if it doesn't exist already
mkdir xpi 1>nul 2>&1
del xpi\*.xpi 2>nul

cd auto-check\src
jar -cMf ..\..\xpi\auto-check.xpi .

cd ..\..\bootstrap\src
jar -cMf ..\..\xpi\bootstrap.xpi .

cd ..\..\commands\src
jar -cMf ..\..\xpi\commands.xpi .

cd ..\..\clipboard-and-indent\src
jar -cMf ..\..\xpi\clipboard-and-indent.xpi .

cd ..\..\db-objects\src
jar -cMf ..\..\xpi\db-objects.xpi .

cd ..\..\extension-sequencer\src
jar -cMf ..\..\xpi\extension-sequencer.xpi .

cd ..\..\hands-on-gui\src
jar -cMf ..\..\xpi\hands-on-gui.xpi .

cd ..\..\misc\src
jar -cMf ..\..\xpi\misc.xpi .

cd ..\..\sqlite-connection-manager\src
jar -cMf ..\..\xpi\sqlite-connection-manager.xpi .

cd ..\..\testcase-debug-context\src
jar -cMf ..\..\xpi\testcase-debug-context.xpi .

cd ..\..\settings\src
jar -cMf ..\..\xpi\settings.xpi .

cd ..\..\exit-confirmation-checker\src
jar -cMf ..\..\xpi\exit-confirmation-checker.xpi .

cd ..\..\run-all-favorites\src
jar -cMf ..\..\xpi\run-all-favorites.xpi .

cd ..\..\preview\src
jar -cMf ..\..\xpi\preview.xpi .

REM cd ../..\implicit-wait\src
REM zip -r ../../xpi/implicit-wait.xpi *