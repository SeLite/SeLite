#!/bin/bash
#change dir to where this script is located:
cd "$( dirname "${BASH_SOURCE[0]}" )"

#firefox -P SeLiteExtensionSequencerTest -no-remote -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul ~/selite/extension-sequencer/shell-tests/xxx/validate.js 2>&1 | grep 'SeLite ExtensionSequencer Test'