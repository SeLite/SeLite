#!/bin/bash
echo Run download_all_selite_components_suite.html in Selenium IDE, if you did not already.

#change dir to where this script is located:
cd "$( dirname "${BASH_SOURCE[0]}" )"


#This doesn't create build/ folder, since that must exist before you run download_all_selite_components_suite.html

#Based on https://developer.mozilla.org/en/docs/Multiple_Item_Packaging
cp install.rdf build 1>/dev/null 2>&1
cd build
jar -cMf ../../xpi/selite.xpi .
cd ..