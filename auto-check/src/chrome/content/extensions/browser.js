"use strict";
var thisAddOnID= 'auto-check@selite.googlecode.com';
var thisAddOnChrome= 'chrome://selite-auto-check';

/** Following code should be the same across all SeLite extensions that need Extension Sequencer. */
var runningAsComponent= typeof window==='undefined';

// I access this file in two ways: from browser.xul, and also as a JS code module via Components.utils.import(), importing itself when invoked from browser.xul. That's why I need to define EXPORTED_SYMBOLS here, rather than at the end of this file.
var EXPORTED_SYMBOLS= ['Flag'];

var Flag= {
    alertShown: false // Whether I've already shown the alert (potentially in another window). It helps me to ensure that I don't show the same message again if the user opens a new window.
};

function showAlert( ){
    /* I can't use window.alert(..) here. gBrowser is defined here, however gBrowser.addTab(..) failed when I called it from right here. Therefore I delay it and then I can use either window.alert() or gBrowser.
    I tried to follow https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Alerts_and_Notifications and https://bugzilla.mozilla.org/show_bug.cgi?id=324570 and I've tried to show a non-modal popup. However, none of those methods works on Windows for multiple popups at the same time: then neither popup shows up. I've tried to use different titles for the popups. I've also tried http://notifications.spec.whatwg.org/#tags-example with different tags for the popups. None of that works.
    It can happen that another XPI also wants to show up a popup. Therefore I use gBrowser.selectedTab = gBrowser.addTab( url ).        */
    window.setTimeout( function() {
        /*
        try {
            Components.classes['@mozilla.org/alerts-service;1'].
                getService(Components.interfaces.nsIAlertsService).
                showAlertNotification(null, title, msg, false, '', null);
        } catch(e) {
            var win = Components.classes['@mozilla.org/embedcomp/window-watcher;1'].
                getService(Components.interfaces.nsIWindowWatcher).
                openWindow(null, 'chrome://global/content/alerts/alert.xul',
                  '_blank', 'chrome,titlebar=no,popup=yes', null);
            win.arguments = [null, title, msg, false, ''];
        }*/
        gBrowser.selectedTab = gBrowser.addTab( thisAddOnChrome +'/content/extensions/extension_sequencer_missing.xul' );
    }, 3000 );
}

if( !runningAsComponent ) {
    try {
        // Test presence of Extension Sequencer
        Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");
    }
    catch(e) {
        // Load this file itself as a JS code module, so that it shares Flag object across windows:
        var sharedScope= {};
        Components.utils.import( thisAddOnChrome+ "/content/extensions/browser.js", sharedScope );
        if( true || !sharedScope.Flag.alertShown ) {
            AddonManager.getAllAddons(
                function( addons ) {
                    // I sort the add-ons alphabetically by ID. I want to show only one alert even if there are multiple SeLite XPIs or other XPIs that use Extension Sequencer.So I show the alert in the first SeLite add-on (when sorted by ID in the alphabetical order).
                    var seliteAddOnIDs= [];
                    for( var i=0; i<addons.length; i++ ) { //@TODO for(.. of..)
                        if( addons[i].isActive && addons[i].id.indexOf('@selite.googlecode.com')>0 ) {
                            seliteAddOnIDs.push( addons[i].id );
                        }
                    }
                    seliteAddOnIDs.sort();
                    if( seliteAddOnIDs[0]===thisAddOnID ) {
                        showAlert();
                        sharedScope.Flag.alertShown= true;
                    }
                }
            );
        }
    }
}