#!/bin/bash
#change dir to where this script is located:
cd "$( dirname "${BASH_SOURCE[0]}" )"

HOME_FOLDER=~
firefox -P SeLiteExtensionSequencerTest -no-remote -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul?$HOME_FOLDER/selite/extension-sequencer/shell-tests/xxx/expectedOutput.txt
#2>&1
# | grep 'SeLite ExtensionSequencer Test'