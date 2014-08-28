/*
 * Copyright 2013, 2014 Peter Kehl
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";
var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;

function SeLiteExtensionSequencer() {}

/** Object serving as an associative array. Used by Core extensions, that are loaded via ExtensionSequencer (but not via Bootstrap where this doesn't apply), to indicate the number of times an extension has been loaded during the current run of Selenium IDE.
 *  {
 *      string core extension name: number of times the extension was loaded, or undefined if not loaded yet. It's 1 before running any Selenese (i.e. after the first load of the custom core extension) and 2 when running the first Selenese (i.e. after the second load of the custom core extension). It should not be more than 2.
 *  }
 *  Passive - It's up to the Core extension to use this appropriately.
 *  This exists because of issue http://code.google.com/p/selenium/issues/detail?id=6697 "Core extensions are loaded 2x".
 *  This gets re-set by extensions/core.js, otherwise it would stay between reloads of Selenium IDE.
*/
SeLiteExtensionSequencer.coreExtensionsLoadedTimes= {};

/** Object serving as an associative array {
 *     string pluginId => object just like parameter prototype of SeLiteExtensionSequencer.registerPlugin()
 *  }
 * */
SeLiteExtensionSequencer.plugins= {};

/** Register a Firefox plugin which is a Selenium IDE core extension. It will be
 *  initiated by SeLiteExtensionSequencer later, in a proper sequence - after any dependencies.
 *  @param prototype Anonymous object in form {
 *      pluginId: string, unique id of the Firefox plugin (often in a format of an email address)
 *      coreUrl: string, or array of strings, optional - for Core extensions only; usually a chrome:// url,
 *      xmlUrl: string, or array of strings, optional - for Core extensions only, used only if coreUrl is also set; usually a chrome:// url;
 *          if it's an array, then it must have the same number of entries as coreUrl (but the mey be null/false), and they will be
 *          treated in the respective order;
 *      ideUrl: string, or array of strings, optional - for IDE extensions only; usually a chrome:// url,
 *      - if neither coreUrl not ideUrl are set, then this plugin is only
 *        registered for the purpose of being a dependency of other plugins,
 *        but it's not added via Selenium API class.
 *      requisitePlugins: Object (optional) { string pluginId: string pluginName },
 *        of plugins that are required dependencies.
 *        Those are plugins that have to be loaded before given pluginId. All
 *        those plugins must be installed in Firefox and they must also call
 *        SeLiteExtensionSequencer.registerPlugin() - otherwise pluginId won't get loaded.
        optionalRequisitePlugins: Object (optional) { string pluginId: string pluginName } of pluginIds that are optional dependencies.
        nonSequencedRequisitePlugins: Object (optional) { string pluginId: string pluginName },
 *        of plugins that are required dependencies and that don't use SeLiteExtensionSequencer to register themselves.
 *  }
 *  @return void
**/
SeLiteExtensionSequencer.registerPlugin= function registerPlugin( prototype ) {
    console.log( 'SeLiteExtensionSequencer.registerPlugin() called with a plugin that has pluginId: ' +prototype.pluginId );
    var plugin= {
        pluginId: prototype.pluginId,
        coreUrl: prototype.coreUrl || [],
        xmlUrl: prototype.xmlUrl || [],
        ideUrl: prototype.ideUrl || [],
        requisitePlugins: prototype.requisitePlugins || {},
        optionalRequisitePlugins: prototype.optionalRequisitePlugins || {},
        nonSequencedRequisitePlugins: prototype.nonSequencedRequisitePlugins || {},
        preActivate: prototype.preActivate || false
    };
    if( !Array.isArray(plugin.coreUrl) ) {
        plugin.coreUrl= [plugin.coreUrl];
    }
    if( !Array.isArray(plugin.xmlUrl) ) {
        plugin.xmlUrl= [plugin.xmlUrl];
    }
    if( !Array.isArray(plugin.ideUrl) ) {
        plugin.ideUrl= [plugin.ideUrl];
    }
    if( plugin.pluginId in SeLiteExtensionSequencer.plugins ) {
        throw new Error("Plugin " +plugin.pluginId+ " was already registered with SeLite Extension Sequencer.");
    }
    var mergedPluginIds= Object.keys(plugin.requisitePlugins).concat( Object.keys(plugin.optionalRequisitePlugins) ).concat( Object.keys(plugin.nonSequencedRequisitePlugins) );
    for( var i=0; i<mergedPluginIds.length; i++ ) {
        if( mergedPluginIds.indexOf(mergedPluginIds[i])!=i ) {
            // This doesn't need to show human-friendly plugin names, because it should be caught by developer
            throw new Error( "SeLite Extension Sequencer: plugin " +plugin.pluginId+ " lists a dependancy package " +mergedPluginIds[i]+ " two or more times." );
        }
    }
    SeLiteExtensionSequencer.plugins[plugin.pluginId]= plugin;
};

/** Get an array of plugin IDs, sorted so that ones with no dependencies are first,
 *  and then any plugins only depending on any previous plugins. I.e. in an order
 *  that they can be safely loaded. It removes any plugins that miss any of their
 *  required dependencies, and any plugins that require (directly or indirectly)
 *  any of those removed plugins. It reports those removed plugins in the result.
 *  @param object addonsById Object { string addOnId => Addon object }. This includes all add-ons, not just ones with SeLiteExtensionSequencerManifest.js. I need those other add-ons when checking for non-sequenced dependencies.
 *  @return Object {
 *      sortedPluginIds: [pluginId... ] in the order they can be loaded,
 *      missingIndirectDependancies: {
 *          string pluginId: [string missing direct dependency plugin id, ...],
 *          ...
 *      },
 *      missingIndirectDependancies: {
 *          string pluginId: [string missing indirect dependency plugin id, ...],
 *          ...
 *      }
 *  }
 * */
SeLiteExtensionSequencer.sortedPlugins= function sortedPlugins( addonsById ) {
    // pluginUnprocessedRequisites contains plugins with their required dependencies.
    // I add in any optional plugin IDs, if they are installed
    //  - so they get loaded in correct order, before the plugins that use them.
    var pluginUnprocessedRequisites= {}; // { dependant plugin id => [requisite plugin id...], ... }
    for( var dependantId in SeLiteExtensionSequencer.plugins ) {
        var plugin= SeLiteExtensionSequencer.plugins[dependantId];
        pluginUnprocessedRequisites[dependantId]=
            Object.keys( plugin.requisitePlugins ).slice(0); // protective copy
        for( var optionalPluginId in plugin.optionalRequisitePlugins ) {
            if( optionalPluginId in SeLiteExtensionSequencer.plugins ) {
                pluginUnprocessedRequisites[dependantId].push( optionalPluginId );
            }
        }
    }
    
    var missingNonSequencedDependencies= {};
    // @TODO
    
    var sortedPluginIds= []; // [pluginId...] sorted, starting with ones with no dependencies, to the dependant ones
    
    // I believe this has computational cost O(N^2), which is fine with me.
    outer: while( true ) {
        for( var pluginId in pluginUnprocessedRequisites ) {
            if( !pluginUnprocessedRequisites[pluginId].length ) {
                sortedPluginIds.push( pluginId );
                delete pluginUnprocessedRequisites[pluginId];

                // Remove pluginId from dependencies of the rest of unprocessed plugins
                // - from pluginUnprocessedRequisites[xxx][]
                for( var dependantId in pluginUnprocessedRequisites ) {
                    var requisites= pluginUnprocessedRequisites[dependantId];
                    var index= requisites.indexOf(pluginId);
                    if( index>=0 ) {
                        requisites.splice( index, 1 );
                    }
                }

                continue outer; // iterate over previously iterated plugins, since now their dependancies may have been checked
            }
        }
        break;
    }
    var missingDirectDependancies= {}
    var missingIndirectDependancies= {};
    
    if( Object.keys(pluginUnprocessedRequisites).length ) {
        for( var pluginId in pluginUnprocessedRequisites ) {
            //var isMissingDirectDependenciesOnly= true;
            var direct= [], indirect= [];
            //for( var requisiteId of pluginUnprocessedRequisites[pluginId] ) { @TODO instead of the following
            for( var j=0; j<pluginUnprocessedRequisites[pluginId].length; j++ ) {
                var requisiteId= pluginUnprocessedRequisites[pluginId][j];
                if( requisiteId in SeLiteExtensionSequencer.plugins ) {
                    indirect.push(requisiteId);
                }
                else {
                    direct.push(requisiteId);
                }
            }
            if( direct.length ) {
                missingDirectDependancies[pluginId]= {
                    direct: direct,
                    indirect: indirect
                };
            }
            else {
                missingIndirectDependancies[pluginId]= indirect;
            }
        }
    }
    console.log( 'SeLiteExtensionSequencer.sortedPlugins() called and finished.' );
    return {
        missingDirectDependancies: missingDirectDependancies,
        missingIndirectDependancies: missingIndirectDependancies,
        missingNonSequencedDependencies: missingNonSequencedDependencies,
        sortedPluginIds: sortedPluginIds
    };
};

/** @private
 *  Shortcut method to generate a non-modal popup. I need this  since I can't use alert() here in Firefox 30. So I follow https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Alerts_and_Notifications.
 *  Call it max. once at any time - see https://bugzilla.mozilla.org/show_bug.cgi?id=324570.
 *  @param {string} title Since the alert may show outside of Firefox, make the title clarify that it's about a Firefox add-on.
 *  @param {string} message Message
 * */
SeLiteExtensionSequencer.popup= function popup( window, title, message ) {
    /*try {
        Components.classes['@mozilla.org/alerts-service;1'].
            getService(Components.interfaces.nsIAlertsService).
            showAlertNotification(null, title, message, false, '', null);
    } catch(e) {
        var win = Components.classes['@mozilla.org/embedcomp/window-watcher;1'].
            getService(Components.interfaces.nsIWindowWatcher).
            openWindow(null, 'chrome://global/content/alerts/alert.xul',
              '_blank', 'chrome,titlebar=no,popup=yes', null);
        win.arguments = [null, title, message, false, ''];
    }/**/
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

                var newTab= window.gBrowser.selectedTab = window.gBrowser.addTab( 'chrome://selite-extension-sequencer/content/extensions/alert.html' );
                // I need to push the content in the document for the tab that I'll create. This is based on https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Tabbed_browser##Manipulating_content_of_a_new_tab
                var newTabBrowser = window.gBrowser.getBrowserForTab( newTab );
                newTabBrowser.addEventListener(
                    "load",
                    function () {
                        newTabBrowser.contentDocument.body.innerHTML= message;
                    },
                    true
                );
            }, 3000 );
};

// Whether I've processed extension(s) already
SeLiteExtensionSequencer.processedAlready= false;

var EXPORTED_SYMBOLS= ['SeLiteExtensionSequencer'];