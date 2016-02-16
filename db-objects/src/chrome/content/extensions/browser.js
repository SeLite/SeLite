"use strict";
var EXPORTED_SYMBOLS= ['Flag'];

// I access this file in two ways: from browser.xul, and also as a JS code module via Components.utils.import(), importing itself when invoked from browser.xul. Following if() tells me how this file is being accessed.
if( typeof window!=='undefined' ) {
    // Anonymous function puts variables into local scope. Otherwise I had symbols 'thisAddOnChrome' and function showAlert shared across multiple SeLite add-ons, which caused problems when showAlert() shows delayed.
    ( function() {
        var thisAddOnID= 'db-objects@selite.googlecode.com';
        var thisAddOnChrome= 'chrome://selite-db-objects';

        /** Following code should be the same across all SeLite extensions that need Extension Sequencer. */
        var showAlert= function showAlert( ){
            /* I can't use window.alert(..) here. gBrowser is defined here, however gBrowser.addTab(..) failed when I called it from right here. Therefore I delay it and then I can use either window.alert() or gBrowser.
            I tried to follow https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Alerts_and_Notifications and https://bugzilla.mozilla.org/show_bug.cgi?id=324570 and I've tried to show a non-modal popup. However, none of those methods works on Windows for multiple popups at the same time: then neither popup shows up. I've tried to use different titles for the popups. I've also tried http://notifications.spec.whatwg.org/#tags-example with different tags for the popups. None of that works.
            It can happen that another XPI also wants to show up a popup. Therefore I use gBrowser.selectedTab = gBrowser.addTab( url ).
            */
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
        };
        try {
            // Test presence of Extension Sequencer
            Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");
        }
        catch(e) {
            // Load this file itself as a JS code module, so that it shares Flag object across windows:
            var sharedScope= {};
            Components.utils.import( thisAddOnChrome+ "/content/extensions/browser.js", sharedScope );
            if( !sharedScope.Flag.alertShown ) {
                Components.utils.import("resource://gre/modules/AddonManager.jsm");
                AddonManager.getAllAddons(
                    function( addons ) {
                        // I sort the add-ons alphabetically by ID. I want to show only one alert even if there are multiple SeLite XPIs or other XPIs that use Extension Sequencer.So I show the alert in the add-on which is the first on the list of SeLite add-ons (when sorted by ID in the alphabetical order).
                        var seliteAddOnIDs= [];
                        // Following are IDs of SeLite add-ons that can be (easily) used without Extension Sequencer. Those add-ons don't report whether Extension Sequencer is missing, so I don't add them to seliteAddOnsIDs.
                        var addOnIDsNotNeedingSequencer= ['misc@selite.googlecode.com', 'settings@selite.googlecode.com', 'sqlite-connection-manager@selite.googlecode.com']; // @TODO use: const
                        for( var addon of addons ) {
                            if( addon.isActive
                                && ( addon.id.indexOf('@selite.googlecode.com')>0|| addon.id===thisAddOnID ) // addon.id===thisAddOnID serves if this addon is not an SeLite add-on.
                                && addOnIDsNotNeedingSequencer.indexOf(addon.id)<0
                            ) {
                                seliteAddOnIDs.push( addon.id );
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
    } )();
}
else {
    var Flag= {
        alertShown: false // Whether I've already shown the alert (potentially in another window). It helps me to ensure that I don't show the same message again if the user opens a new window.
    };
}