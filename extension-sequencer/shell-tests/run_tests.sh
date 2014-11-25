#!/bin/bash
#change dir to where this script is located:
cd "$( dirname "${BASH_SOURCE[0]}" )"
HOME_FOLDER=~

#TODO cleanup versions etc.
# --- use functions for it

# It expects one parameter, a file path of the expected output, relative to shell-tests/
function run_test {
    firefox -P SeLiteExtensionSequencerTest -no-remote -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul?$HOME_FOLDER/selite/extension-sequencer/shell-tests/$1 2>&1 | grep 'SeLite ExtensionSequencer Test'
    #@TODO consider: simplify checkAndQuit.xul, don't use the above grep,
    # use | grep --invert-match 'warning:' | diff - $HOME_FOLDER/selite/extension-sequencer/shell-tests/$1 >/tmp/diff
    #        - warning: goes to stdout, not to stderr
    # and if /tmp/diff is non-empty, then
    # echo $HOME_FOLDER/selite/extension-sequencer/shell-tests/$1 didn't match the actual output. Differences are:
    # cat /tmp/diff
}

# see tests.html
# For using sed see also http://sed.sourceforge.net/sedfaq3.html#s3.1.2

# decrease the version
sed -i '' -r 's/0\.[0-9]+/0.05/' install.rdf
# uncomment/comment minVersion, compatibleVersion
sed -i '' -r "s/minVersion: '0\.[0-9]+'/minVersion: '0.05'/" SeLiteExtensionSequencerManifest.js

echo "<!-- 0.10 -->" | sed  "s/<!--\(.*\)-->/\1/"