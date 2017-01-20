@ECHO OFF
echo Run download_all_selite_components_suite.html in Selenium IDE, if you did not already.

REM This doesn't create build\ folder, since that must exist before you run download_all_selite_components_suite.html
SET script_folder=%~dp0
cd %script_folder:~0,-1%

REM Based on https://developer.mozilla.org/en/docs/Multiple_Item_Packaging
copy install.rdf build 1>nul 2>&1
cd build
jar -cMf ..\..\xpi\selite.xpi .
cd ..