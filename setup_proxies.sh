#!/bin/bash
#change dir to where this script is located:
cd "$( dirname "${BASH_SOURCE[0]}" )"

# Based on https://developer.mozilla.org/en/Setting_up_extension_development_environment and http://kb.mozillazine.org/Profile_folder_-_Firefox
# TODO: Make this script accept an optional parameter, which is a name of Firefox profile`
HOME_FOLDER=~

if [ "$(uname)" == "Darwin" ]; then
   # According to http://kb.mozillazine.org/Profile_folder_-_Firefox  there are two places for Firefox profile folder on Mac OS:
   # ~/Library/Mozilla/Firefox/Profiles/<profile folder> or ~/Library/Application Support/Firefox/Profiles/<profile folder> 
   # But on Mac OS 10.5.8 and 10.9.1 I could see the second folder only. If you can test both, please update this/send this to me.
   
   EXTENSION_FOLDER="$( echo "$HOME_FOLDER/Library/Application Support/Firefox/Profiles"/*.default )"
else
   EXTENSION_FOLDER="$( echo "$HOME_FOLDER/.mozilla/firefox/"*.default )"
fi

if [ -e "$EXTENSION_FOLDER" ]
then
    EXTENSION_FOLDER=$EXTENSION_FOLDER/extensions

    # If you haven't got any extensions in Firefox profile yet, there is no 'extensions' folder. So create it.
    if [ ! -e "$EXTENSION_FOLDER" ]
    then
      mkdir "$EXTENSION_FOLDER"
    fi

    if [ ! -e "$EXTENSION_FOLDER"/auto-check\@selite.googlecode.com.xpi ]
    then
      cd auto-check/src
      pwd > "$EXTENSION_FOLDER"/auto-check@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/bootstrap\@selite.googlecode.com.xpi ]
    then
      cd bootstrap/src
      pwd > "$EXTENSION_FOLDER"/bootstrap@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/\extension-sequencer@selite.googlecode.com.xpi ]
    then
      cd extension-sequencer/src
      pwd > "$EXTENSION_FOLDER"/extension-sequencer@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/settings\@selite.googlecode.com.xpi ]
    then
      cd settings/src
      pwd > "$EXTENSION_FOLDER"/settings@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/sqlite-connection-manager\@selite.googlecode.com.xpi ]
    then
      cd sqlite-connection-manager/src
      pwd > "$EXTENSION_FOLDER"/sqlite-connection-manager@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/testcase-debug-context\@selite.googlecode.com.xpi ]
    then
      cd testcase-debug-context/src
      pwd > "$EXTENSION_FOLDER"/testcase-debug-context@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/misc\@selite.googlecode.com.xpi ]
    then
      cd misc/src
      pwd > "$EXTENSION_FOLDER"/misc@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/db-objects\@selite.googlecode.com.xpi ]
    then
      cd db-objects/src
      pwd > "$EXTENSION_FOLDER"/db-objects@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/commands\@selite.googlecode.com.xpi ]
    then
      cd commands/src
      pwd > "$EXTENSION_FOLDER"/commands@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/exit-confirmation-checker\@selite.googlecode.com.xpi ]
    then
      cd exit-confirmation-checker/src
      pwd > "$EXTENSION_FOLDER"/exit-confirmation-checker@selite.googlecode.com
      cd ../..
    fi

    if [ ! -e "$EXTENSION_FOLDER"/run-all-favorites\@selite.googlecode.com ]
    then
      cd run-all-favorites/src
      pwd > "$EXTENSION_FOLDER"/run-all-favorites@selite.googlecode.com
      cd ../..
    fi
else
   echo Could not find a default Firefox profile
fi