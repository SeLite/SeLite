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

/** Object serving as an associative array, containing all add-ons registered through Extension Sequencer (whether successfuly loaded or not) {
 *     string pluginId => object just like parameter prototype of SeLiteExtensionSequencer.registerPlugin()
 *  }
 * */
SeLiteExtensionSequencer.pluginInfos= {};

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
    var pluginInfo= {
        pluginId: prototype.pluginId,
        coreUrl: prototype.coreUrl || [],
        xmlUrl: prototype.xmlUrl || [],
        ideUrl: prototype.ideUrl || [],
        requisitePlugins: prototype.requisitePlugins || {},
        optionalRequisitePlugins: prototype.optionalRequisitePlugins || {},
        nonSequencedRequisitePlugins: prototype.nonSequencedRequisitePlugins || {},
        preActivate: prototype.preActivate || false
    };
    if( !Array.isArray(pluginInfo.coreUrl) ) {
        pluginInfo.coreUrl= [pluginInfo.coreUrl];
    }
    if( !Array.isArray(pluginInfo.xmlUrl) ) {
        pluginInfo.xmlUrl= [pluginInfo.xmlUrl];
    }
    if( !Array.isArray(pluginInfo.ideUrl) ) {
        pluginInfo.ideUrl= [pluginInfo.ideUrl];
    }
    if( pluginInfo.pluginId in SeLiteExtensionSequencer.pluginInfos ) {
        throw new Error("Plugin " +pluginInfo.pluginId+ " was already registered with SeLite Extension Sequencer.");
    }
    var mergedPluginIds= Object.keys(pluginInfo.requisitePlugins).concat( Object.keys(pluginInfo.optionalRequisitePlugins) ).concat( Object.keys(pluginInfo.nonSequencedRequisitePlugins) );
    for( var i=0; i<mergedPluginIds.length; i++ ) {
        if( mergedPluginIds.indexOf(mergedPluginIds[i])!=i ) {
            // This doesn't need to show human-friendly plugin names, because it should be caught by developer
            throw new Error( "SeLite Extension Sequencer: plugin " +pluginInfo.pluginId+ " lists a dependancy package " +mergedPluginIds[i]+ " two or more times." );
        }
    }
    SeLiteExtensionSequencer.pluginInfos[pluginInfo.pluginId]= pluginInfo;
};

/** Get an array of plugin IDs, sorted so that ones with no dependencies are first,
 *  and then any plugins only depending on any previous plugins. I.e. in an order
 *  that they can be safely loaded. It removes any plugins that miss any of their
 *  required dependencies, and any plugins that require (directly or indirectly)
 *  any of those removed plugins. It reports those removed plugins in the result.
 *  @param object addonsById Object { string addOnId => Addon object }. This includes all active add-ons, not just ones with SeLiteExtensionSequencerManifest.js. I need those other add-ons when checking for non-sequenced dependencies.
 *  @return Object {
 *      sortedPluginIds: [pluginId... ] in the order they can be loaded,
 *      missingDirectDependancies: {
 *          string pluginId: [string missing direct dependency plugin id, ...],
 *          ...
 *      },
 *      brokenDirectDependancies: {
 *          string pluginId: [string broken direct dependency plugin id, ...] // direct dependancies of pluginId that are present, but that miss some of their own own dependancies (directly or indirectly)
 *          ...
 *      }
 *  }
 * */
SeLiteExtensionSequencer.sortedPlugins= function sortedPlugins( addonsById ) {
    // pluginUnprocessedRequisites initially contains all sequenced plugins with their required dependencies (sequenced or not).
    // I add in any optional plugin IDs, if they are installed, so they get loaded in correct order, before the plugins that use them.
    var pluginUnprocessedRequisites= {}; // { dependant plugin id => [requisite plugin id...], ... }
    // Object { dependant plugin id => true } containing plugins that are missing any non-sequenced dependencies
    var missingNonSequencedDependencies= {};
    var nonSequencedDependencies= []; // Array of IDs of non-sequenced dependencies
    
    for( var dependantId in SeLiteExtensionSequencer.pluginInfos ) {
        var pluginInfo= SeLiteExtensionSequencer.pluginInfos[dependantId];
        pluginUnprocessedRequisites[dependantId]= Object.keys( pluginInfo.requisitePlugins ).slice(0); // protective copy //@TODO no need for slice(0)
        
        // Any optional dependencies, that are present, are now treated as required dependencies:
        for( var optionalPluginId in pluginInfo.optionalRequisitePlugins ) {
            if( optionalPluginId in SeLiteExtensionSequencer.pluginInfos ) {
                pluginUnprocessedRequisites[dependantId].push( optionalPluginId );
            }
        }
        for( var nonSequencedPluginId in pluginInfo.nonSequencedRequisitePlugins ) {
            if( nonSequencedPluginId in addonsById && nonSequencedDependencies.indexOf(nonSequencedPluginId)<0 ) {
                nonSequencedDependencies.push( nonSequencedPluginId );
            }
            else {
                missingNonSequencedDependencies[dependantId]= true;
                pluginUnprocessedRequisites[dependantId].push( nonSequencedPluginId );
            }
        }
    }
    !Object.keys(missingNonSequencedDependencies).length || console.error( 'SeLiteExtensionSequencer: following add-on(s) are missing non sequenced dependencies: ' +Object.keys(missingNonSequencedDependencies).join(', ') );
    var sortedPluginIds= []; // [pluginId...] sorted, starting with ones with no dependencies, to the dependant ones
    
    // Check all dependancies from bottom up. Clear them (i.e. remove them from pluginUnprocessedRequisites[]). Imagine a dependancy tree up side down. Start at the bottom, with leaf add-ons that have no dependancies, and clear them first. Then continue upwards.
    // I believe this has computational cost between O(N^2) and O(N^3), which is fine with me. This should report cyclic dependancies as as missing.
    outer: while( true ) {
        for( var pluginId in pluginUnprocessedRequisites ) {
            if( !pluginUnprocessedRequisites[pluginId].length ) { // The plugin has no dependancies, or they were all cleared in previous run(s) of the following inner loop. Now clear this plugin as OK and remove it as a dependancy for other plugins that depend on it.
                // sortedPluginIds[] contains all dependencies of pluginId, so pluginId can be loaded after them:
                sortedPluginIds.push( pluginId );
                delete pluginUnprocessedRequisites[pluginId];

                // Remove pluginId from dependencies of the rest of unprocessed plugins - from pluginUnprocessedRequisites[xxx][]
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
    var missingDirectDependancies= {};
    var brokenDirectDependancies= {};
    !Object.keys(pluginUnprocessedRequisites).length || console.error( 'pluginUnprocessedRequisites ' +Object.keys(pluginUnprocessedRequisites) );
    for( var pluginId in pluginUnprocessedRequisites ) { // pluginId is of the dependant
        var pluginInfo= SeLiteExtensionSequencer.pluginInfos[ pluginId ];
        var brokenDirect=[], direct= [];
        
        for( var j=0; j<pluginUnprocessedRequisites[pluginId].length; j++ ) {//@TODO low: for( var requisiteId of pluginUnprocessedRequisites[pluginId] )
            var requisiteId= pluginUnprocessedRequisites[pluginId][j];
            if( requisiteId in SeLiteExtensionSequencer.pluginInfos ) {
                brokenDirect.push( requisiteId );
            }
            else {
                direct.push(requisiteId);
            }
        }
        if( brokenDirect.length ) {
            brokenDirectDependancies[pluginId]= brokenDirect;
        }
        if( direct.length ) {
            missingDirectDependancies[pluginId]= direct;
        }
    }
    !Object.keys(missingDirectDependancies).length || console.log( 'SeLiteExtensionSequencer: Following add-ons are missing direct dependancies: ' +Object.keys(missingDirectDependancies) );
    return {
        missingDirectDependancies: missingDirectDependancies,
        brokenDirectDependancies: brokenDirectDependancies,
        sortedPluginIds: sortedPluginIds
    };
};

/** @private
 *  Shortcut method to generate a non-modal popup. I need this  since I can't use alert() here in Firefox 30. So I follow https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Alerts_and_Notifications.
 *  Call it max. once at any time - see https://bugzilla.mozilla.org/show_bug.cgi?id=324570.
 *  @param {string} title Not used right now. In future implementation (once Mozilla fixes their alert service) the alert may show outside of Firefox, therefore make the title clarify that it's about a Firefox add-on.
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
                        // As per https://developer.mozilla.org/en-US/Add-ons/Overlay_Extensions/XUL_School/DOM_Building_and_HTML_Insertion#See_Also -> https://developer.mozilla.org/en-US/docs/Displaying_web_content_in_an_extension_without_security_issues
                        var body= newTabBrowser.contentDocument.body;
                        var fragment= Components.classes["@mozilla.org/feed-unescapehtml;1"]
                         .getService(Components.interfaces.nsIScriptableUnescapeHTML)
                         .parseFragment( message, false, null, body );
                        //newTabBrowser.contentDocument.body.innerHTML= message;
                        body.appendChild( fragment );
                    },
                    true
                );
            }, 3000 );
};

// Whether I've processed extension(s) already
SeLiteExtensionSequencer.processedAlready= false;

var Flag= {
    alertShown: false // Whether I've already shown the alert (potentially in another window). It helps me to ensure that I don't show the same message again if the user opens a new window.
};

SeLiteExtensionSequencer.Loader= {};
var EXPORTED_SYMBOLS= ['SeLiteExtensionSequencer', 'Flag'];