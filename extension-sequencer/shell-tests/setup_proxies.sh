#!/bin/bash
#change dir to where this script is located:
cd "$( dirname "${BASH_SOURCE[0]}" )"

# Based on https://developer.mozilla.org/en/Setting_up_extension_development_environment and http://kb.mozillazine.org/Profile_folder_-_Firefox
HOME_FOLDER=~

if [ "$(uname)" == "Darwin" ]; then
   # According to http://kb.mozillazine.org/Profile_folder_-_Firefox  there are two places for Firefox profile folder on Mac OS:
   # ~/Library/Mozilla/Firefox/Profiles/<profile folder> or ~/Library/Application Support/Firefox/Profiles/<profile folder> 
   # But on Mac OS 10.5.8 and 10.9.1 I could see the second folder only. If you can test both, please update this/send this to me.
   FIREFOX_FOLDER="$( echo "$HOME_FOLDER/Library/Application Support/Firefox/Profiles" )"
   #EXTENSION_FOLDER="$( echo "$HOME_FOLDER/Library/Application Support/Firefox/Profiles"/*.SeLiteExtensionSequencerTest )"
else
   FIREFOX_FOLDER="$( echo "$HOME_FOLDER/.mozilla/firefox" )"
   #EXTENSION_FOLDER="$( echo "$HOME_FOLDER/.mozilla/firefox/"*.SeLiteExtensionSequencerTest )"
fi
PROFILE_FOLDER="$( echo "$FIREFOX_FOLDER/"*.SeLiteExtensionSequencerTest )"

if [ ! -e "$PROFILE_FOLDER" ]; then
    firefox -CreateProfile SeLiteExtensionSequencerTest
    
    PROFILE_FOLDER="$( echo "$FIREFOX_FOLDER/"*.SeLiteExtensionSequencerTest )"
    if [ ! -e "$PROFILE_FOLDER" ]; then
        echo Could not create Firefox profile SeLiteExtensionSequencerTest
        exit
    fi
fi

EXTENSION_FOLDER=$PROFILE_FOLDER/extensions

# If you haven't got any extensions in Firefox profile yet, there is no 'extensions' folder. So create it.
if [ ! -e "$EXTENSION_FOLDER" ]
then
  mkdir "$EXTENSION_FOLDER"
fi

cd ../../extension-sequencer/src
pwd > "$EXTENSION_FOLDER"/extension-sequencer@selite.googlecode.com
cd - >/dev/null