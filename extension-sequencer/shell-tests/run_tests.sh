#!/bin/bash
#change dir to where this script is located:
cd "$( dirname "${BASH_SOURCE[0]}" )"

HOME_FOLDER=~
firefox -P SeLiteExtensionSequencerTest -no-remote -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul?$HOME_FOLDER/selite/extension-sequencer/shell-tests/xxx/expectedOutput.txt 2>&1 | grep 'SeLite ExtensionSequencer Test'

# see also http://sed.sourceforge.net/sedfaq3.html#s3.1.2

# decrease the version
sed -i '' -r 's/0\.[0-9]+/0.05/' install.rdf
# uncomment/comment minVersion, compatibleVersion
sed -i '' -r "s/minVersion: '0\.[0-9]+'/minVersion: '0.05'/" SeLiteExtensionSequencerManifest.js

echo "<!-- 0.10 -->" | sed  "s/<!--\(.*\)-->/\1/"