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

var mozillaAddonsInfoRegex= /^https:\/\/addons.mozilla.org\/([^/]+\/)?firefox\/addon\/[^/]+\/?$/;
/** Convert infoURL, if it's https://addons.mozilla.org/en-US/firefox/addon/XXX or https://addons.mozilla.org/firefox/addon/XXX, to download/versions URL.
 * @return {(string|undefined)}
 * */
function infoURLtoDownloadURL( infoURL ) {
    if( infoURL && mozillaAddonsInfoRegex.test(infoURL) ) {
        return (infoURL[infoURL.length-1]==='/'
                ? infoURL.substring(0, infoURL.length-1)
                : infoURL
            )+ '/versions/';
    }
}

/** SeLiteMisc object, if available. */
var SeLiteMisc;
try {
    SeLiteMisc= Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js", {} ).SeLiteMisc;
}
catch(e) {}

var PluginDetails;
if( SeLiteMisc ) {
    /** This serves in SeLiteExtensionSequencer.registerPlugin() to validate the plugin.
     * @param {object} [source] The same as parameter passed to SeLiteExtensionSequencer.registerPlugin().
     * */
    PluginDetails= function PluginDetails( source ) {
        !source || SeLiteMisc.objectCopyFields( source, this );
    };
    
    PluginDetails= SeLiteMisc.proxyVerifyFields( PluginDetails, undefined, undefined, {
        id: 'string',
        name: 'string',
        coreURL: ['string', Array],
        xmlURL: ['string', Array],
        ideURL: ['string', Array],
        infoURL: 'string',
        downloadURL: 'string',
        oldestCompatibleVersion: 'string',
        requisitePlugins: 'object',
        optionalRequisitePlugins: 'object',
        nonSequencedRequisitePlugins: 'object'
    } );
}

/** Register a Firefox plugin which is a Selenium IDE core extension. It will be
 *  initiated by SeLiteExtensionSequencer later, in a proper sequence - after any dependencies.
 *  @param prototype Anonymous object in form {
 *      id: string, unique id of the Firefox plugin (often in a format of an email address),
 *      name: string, human-friendly name,
 *      coreURL: string, or array of strings, optional - for Core extensions only; usually a chrome:// URL,
 *      xmlURL: string, or array of strings, optional - for Core extensions only, used only if coreURL is also set; usually a chrome:// URL;
 *          if it's an array, then it must have the same number of entries as coreURL (but the mey be null/false), and they will be treated in the respective order;
 *      ideURL: string, or array of strings, optional - for IDE extensions only; usually a chrome:// URL,
 *      - if neither coreURL not ideURL are set, then this plugin is only registered for the purpose of being a dependency of other plugins, but it's not added via Selenium API class;
 *      infoURL: string, optional, the info URL of the add-on, e.g. https://addons.mozilla.org/en-US/firefox/addon/XXXX/.
 *      downloadURL: string, optional, the URL to get current and any recent versions, which may be needed by older plugins that depend on it. It should be a link to list (e.g. to https://addons.mozilla.org/en-US/firefox/addon/XXX/versions/) and not a direct link to an .xpi file. If not present and if infoURL is present and in format https://addons.mozilla.org/en-US/firefox/addon/XXX or https://addons.mozilla.org/firefox/addon/XXX, then this is auto-generated from it.
 *      oldestCompatibleVersion: string, optional, the oldest previous version of this plugin that this current version is compatible with; if present, then it's compared to compatibleVersion in an entry in requisitePlugins of its dependancy if present there. However, it doesn't get compared to minVersion (in requisitePlugins).
 *      requisitePlugins: Object (optional) {
 *          string pluginId: string pluginName (for backwards compatiblity only), or
 *          string pluginId: {
 *              name: string human-friendly name,
 *              infoURL: string, required; optional only while this is backwards compatible
 *              downloadURL: string required; optional only while this is backwards compatible or if infoURL is at addons.mozilla.org,
 *              minVersion: string optional,
 *              compatibleVersion: string optional
 *          }
 *      },
 *        of plugins that are required dependencies. Those are plugins that have to be loaded before given pluginId. All those plugins must be installed in Firefox and they must also call SeLiteExtensionSequencer.registerPlugin() - otherwise pluginId won't get loaded.
        optionalRequisitePlugins: Object (optional) { string pluginId: like entries in requisitePlugins } of pluginIds that are optional dependencies.
        nonSequencedRequisitePlugins: Object (optional) { string pluginId: like entries in requisitePlugins } of plugins that are required dependencies and that don't use SeLiteExtensionSequencer to register themselves.
 *  }
 *  @return void
**/
SeLiteExtensionSequencer.registerPlugin= function registerPlugin( prototype ) {
    if( SeLiteMisc ) {
        var prototype= new PluginDetails( prototype );
    }
    var pluginInfo= {
        id: prototype.id || prototype.pluginId,
        name: prototype.name || '{' +(prototype.id || prototype.pluginId)+ '}', //@TODO low: cleanup - for backwards compatibility only
        //@TODO low: remove backward compatiblity for xxxUrl on the following lines, and for non-object values in *requisite*Plugins
        coreURL: prototype.coreURL || prototype.coreUrl || [],
        xmlURL: prototype.xmlURL || prototype.xmlUrl || [],
        ideURL: prototype.ideURL || prototype.ideUrl || [],
        oldestCompatibleVersion: prototype.oldestCompatibleVersion,
        infoURL: prototype.infoURL,
        downloadURL: prototype.downloadURL || infoURLtoDownloadURL(prototype.infoURL),
        requisitePlugins: prototype.requisitePlugins || {},
        optionalRequisitePlugins: prototype.optionalRequisitePlugins || {},
        nonSequencedRequisitePlugins: prototype.nonSequencedRequisitePlugins || {},
        preActivate: prototype.preActivate || false
    };
    if( !Array.isArray(pluginInfo.coreURL) ) {
        pluginInfo.coreURL= [pluginInfo.coreURL];
    }
    if( !Array.isArray(pluginInfo.xmlURL) ) {
        pluginInfo.xmlURL= [pluginInfo.xmlURL];
    }
    if( !Array.isArray(pluginInfo.ideURL) ) {
        pluginInfo.ideURL= [pluginInfo.ideURL];
    }
    if( pluginInfo.id in SeLiteExtensionSequencer.pluginInfos ) {
        throw new Error("Plugin " +pluginInfo.id+ " was already registered with SeLite Extension Sequencer.");
    }

    //@TODO low: remove the following variable and the loop - it's for backwards compatibility only
    var requisiteFieldNames= ['requisitePlugins', 'optionalRequisitePlugins', 'nonSequencedRequisitePlugins' ];
    for( var i=0; i<requisiteFieldNames.length; i++ ) {
        var requisiteFieldName= requisiteFieldNames[i];
        for( var requisiteId in pluginInfo[requisiteFieldName] ) {
            var requisiteDetails= pluginInfo[requisiteFieldName][requisiteId];
            if( typeof requisiteDetails==='string' ) {
                pluginInfo[requisiteFieldName][requisiteId]= {
                    name: requisiteDetails
                };
            }
        }
    }
    
    for( var requisiteId in pluginInfo.requisitePlugins ) {
        var requisiteDetails= pluginInfo.requisitePlugins[requisiteId];
        if( !requisiteDetails.downloadURL && requisiteDetails.infoURL ) {
            requisiteDetails.downloadURL= infoURLtoDownloadURL(requisiteDetails.infoURL);
        }
    }
    var mergedPluginIds= Object.keys(pluginInfo.requisitePlugins).concat( Object.keys(pluginInfo.optionalRequisitePlugins) ).concat( Object.keys(pluginInfo.nonSequencedRequisitePlugins) );
    for( var i=0; i<mergedPluginIds.length; i++ ) {
        if( mergedPluginIds.indexOf(mergedPluginIds[i])!=i ) {
            // This doesn't need to show human-friendly plugin names, because it should be caught by developer
            throw new Error( "SeLite Extension Sequencer: plugin " +pluginInfo.name+ " lists a dependancy package " +mergedPluginIds[i]+ " two or more times." );
        }
    }
    SeLiteExtensionSequencer.pluginInfos[pluginInfo.id]= pluginInfo;
};

// See https://developer.mozilla.org/en-US/docs/Toolkit_version_format
var versionComparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);

/**
 * @return {(boolean|string)} Return false if versions of the requisite and the dependant are compatible, or if there are no version restrictions. Return one of SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_OLD or SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_NEW otherwise.
 * */
function directRequisiteIncompatible( requisiteId, dependantId ) {
    var dependantRequisitePlugins= SeLiteExtensionSequencer.pluginInfos[ dependantId ].requisitePlugins;
    if( !(requisiteId in dependantRequisitePlugins) ) {
        return false; // Not a requisite, hence compatible
    }
    var dependancyInfo= dependantRequisitePlugins[requisiteId];
    if( typeof dependancyInfo!=='object' ) {
        return false; //@TODO low: remove -for backwards compatibility only
    }
    var requisiteVersion= SeLiteExtensionSequencer.Loader.addonsById[requisiteId].version;
    if( dependancyInfo.minVersion && versionComparator.compare(requisiteVersion, dependancyInfo.minVersion)<0 ) {
        return SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_OLD;
    }
    var requisiteInfo= SeLiteExtensionSequencer.pluginInfos[ requisiteId ];
    if( dependancyInfo.compatibleVersion && requisiteInfo.oldestCompatibleVersion && versionComparator.compare(requisiteInfo.oldestCompatibleVersion, dependancyInfo.compatibleVersion)<0 ) {
        return SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_NEW;
    }
    return false;
}

SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING= 'DIRECT_DEPENDANCY_MISSING';
SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_OLD= 'DIRECT_DEPENDANCY_TOO_OLD';
SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_NEW= 'DIRECT_DEPENDANCY_TOO_NEW';

/** @param {object} Like entries in requisitePlugins subfield for SeLiteExtensionSequencer.registerPlugin()
 *  @return object {
 *                       name: string human-friendly name,
 *                       infoURL: string,
 *                       downloadURL: string optional - see registerPlugin()
 *  }
 * */
function requisiteDetailsSubset( requisiteFullDetails ) {
    return {
        name: requisiteFullDetails.name,
        infoURL: requisiteFullDetails.infoURL,
        downloadURL: requisiteFullDetails.downloadURL
    };
}

/** Get an array of plugin IDs, sorted so that ones with no dependencies are first,
 *  and then any plugins only depending on any previous plugins. I.e. in an order
 *  that they can be safely loaded. It removes any plugins that miss any of their
 *  required dependencies, and any plugins that require (directly or indirectly)
 *  any of those removed plugins. It reports those removed plugins in the result.
 *  @param object addonsById Object { string addOnId => Addon object }. This includes all active add-ons, not just ones with SeLiteExtensionSequencerManifest.js. I need those other add-ons when checking for non-sequenced dependencies.
 *  @return Object {
 *      sortedPluginIds: [pluginId... ] in the order they can be loaded,
 *      missingDirectDependancies: {
 *          string dependantPluginId: {
 *              value of SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING: {
 *                  requisiteId: {
 *                       name: string human-friendly name,
 *                       infoURL: string,
 *                       downloadURL: string optional - see registerPlugin(),
 *                  }
 *                  ...
*               },
 *              value of SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_OLD: {
 *                  structure like for SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING
 *              },
 *              value of SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_NEW: {
 *                  structure like for SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING
 *              }
 *          }
 *          ....
 *      },
 *      brokenDirectDependancies: {
 *          string dependantPluginId: {
 *               structure like for SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING
 *               containing any direct dependancies of pluginId that are present, but that miss some of their own own dependancies (directly or indirectly)
 *          }
 *          ....
 *      }
 *  }
 * */
SeLiteExtensionSequencer.sortedPlugins= function sortedPlugins( addonsById ) {
    // pluginUnprocessedRequisites initially contains all sequenced plugins with their required direct dependencies (sequenced or not).
    // I add in any optional plugin IDs, if they are installed, so they get loaded in correct order, before the plugins that use them.
    // { dependant plugin id => [requisite pluginInfo...], ... }
    var pluginUnprocessedRequisites= {};
    
    for( var dependantId in SeLiteExtensionSequencer.pluginInfos ) {
        var pluginInfo= SeLiteExtensionSequencer.pluginInfos[dependantId];
        pluginUnprocessedRequisites[dependantId]= {};
        for( var requisiteId in pluginInfo.requisitePlugins ) {
            pluginUnprocessedRequisites[dependantId][requisiteId]= requisiteDetailsSubset( pluginInfo.requisitePlugins[requisiteId] );
        }
        
        // Any optional dependencies, that are present, are now treated as required dependencies:
        for( var optionalPluginId in pluginInfo.optionalRequisitePlugins ) {
            if( optionalPluginId in SeLiteExtensionSequencer.pluginInfos ) {
                pluginUnprocessedRequisites[dependantId][optionalPluginId]= requisiteDetailsSubset( pluginInfo.optionalRequisitePlugins[optionalPluginId] );
            }
        }
        for( var nonSequencedPluginId in pluginInfo.nonSequencedRequisitePlugins ) {
            if( !(nonSequencedPluginId in addonsById) ) {
                pluginUnprocessedRequisites[dependantId][nonSequencedPluginId]= requisiteDetailsSubset( pluginInfo.nonSequencedRequisitePlugins[nonSequencedPluginId] );
            }
        }
    }
    var sortedPluginIds= []; // [pluginId...] sorted, starting with ones with no dependencies, to the dependant ones
    
    // Check all dependancies from bottom up. Clear them (i.e. remove them from pluginUnprocessedRequisites[]). Imagine a dependancy tree up side down. Start at the bottom, with leaf add-ons that have no dependancies, and clear them first. Then continue upwards.
    // I believe this has computational cost between O(N^2) and O(N^3), which is fine with me. This should report cyclic dependancies as as missing.
    outer: while( true ) {
        for( var pluginId in pluginUnprocessedRequisites ) {
            if( !Object.keys( pluginUnprocessedRequisites[pluginId] ).length ) { // The plugin has no dependancies, or they were all cleared in previous run(s) of the following inner loop. Now clear this plugin as OK and remove it as a dependancy for other plugins that depend on it.
                // sortedPluginIds[] contains all dependencies of pluginId, so pluginId can be loaded after them:
                sortedPluginIds.push( pluginId );
                delete pluginUnprocessedRequisites[pluginId];

                // Remove pluginId from dependencies of the rest of unprocessed plugins - from pluginUnprocessedRequisites[xxx][]
                for( var dependantId in pluginUnprocessedRequisites ) {
                    var requisites= pluginUnprocessedRequisites[dependantId];
                    if( pluginId in requisites && !directRequisiteIncompatible(pluginId, dependantId) ) {
                        delete( requisites[pluginId] );
                    }
                }

                continue outer; // iterate over previously iterated plugins, since now their dependancies may have been checked
            }
        }
        break;
    }
    var missingDirectDependancies= {};
    var brokenDirectDependancies= {};
    !Object.keys(pluginUnprocessedRequisites).length || console.log( 'pluginUnprocessedRequisites ' +Object.keys(pluginUnprocessedRequisites) );
    for( var pluginId in pluginUnprocessedRequisites ) { // pluginId is of the dependant
        var pluginInfo= SeLiteExtensionSequencer.pluginInfos[ pluginId ];
        var brokenDirect= {};
        var missingDirect= {};
        
        for( var requisiteId in pluginUnprocessedRequisites[pluginId] ) {
            var requisiteDetails= pluginUnprocessedRequisites[pluginId][requisiteId];
            var incompatible= requisiteId in SeLiteExtensionSequencer.pluginInfos
                ? directRequisiteIncompatible(requisiteId, pluginId)
                : true; // not present, hence incompatible. This value doesn't matter (it could be false).
            if( requisiteId in SeLiteExtensionSequencer.pluginInfos && !incompatible ) {
                // the direct dependancy is present and compatible. So it's only broken - i.e. it's missing its direct dependancies, or they are broken.
                brokenDirect[requisiteId]= requisiteDetails;
            }
            else {
                if( !Object.keys(missingDirect).length ) {
                    missingDirect[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING]= {};
                    missingDirect[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_OLD]= {};
                    missingDirect[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_NEW]= {};
                }
                if( requisiteId in SeLiteExtensionSequencer.pluginInfos ) {
                    // incompatible is SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_OLD or SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_NEW
                    missingDirect[incompatible][requisiteId]= requisiteDetails;
                }
                else {
                    missingDirect[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING][requisiteId]= requisiteDetails;
                }
            }
        }
        if( Object.keys(brokenDirect).length ) {
            brokenDirectDependancies[pluginId]= brokenDirect;
        }
        if( Object.keys(missingDirect).length ) {
            missingDirectDependancies[pluginId]= missingDirect;
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
            It can happen that another XPI also wants to show up a popup. Therefore I use gBrowser.selectedTab = gBrowser.addTab( URL ).
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