/*
 * Copyright 2013,  2014 Peter Kehl
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
Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");

if( typeof afterChecks!=='function' ) {
        // I must reset SeLiteExtensionSequencer.coreExtensionsLoadedTimes. I can't expect that extensions will have an even number of loads - because if the user closes Selenium IDE before running any Selenese, the extensions don't get loaded for the 2nd time during that run of Selenium IDE, and the odd-even sequence would not apply.
        SeLiteExtensionSequencer.coreExtensionsLoadedTimes= {};
}
if( !SeLiteExtensionSequencer.processedAlready || typeof afterChecks==='function' ) {
    (function( global ) { // closure to make the variables local
        var console= Components.utils.import("resource://devtools/Console.jsm", {}).console;
        // When I start 'firefox -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul', it loads this file extension-loader.js without 'API' class. 'API' class is only defined when this is loaded from extension-loader.xul.
        if( !global.runAsCheck ) {
            var ide_api= new API(); // API comes from chrome://selenium-ide/content/api.js - referenced through ./extension-loader.xul
            // Register itself - so that it shows up in Selenium IDE > Options > Options > Plugins
            ide_api.addPluginProvidedUserExtension( 'chrome://selite-extension-sequencer/content/extensions/extension-sequencer-core.js' );
            ide_api.addPlugin( 'extension-sequencer@selite.googlecode.com' );
        }
        
        var SeLiteMiscModule;
        // Lazy quiet loader of SeLiteMisc.
        // @return SeLiteMisc object, or null if not available
        var getSeLiteMisc= function getSeLiteMisc() {
            if( SeLiteMiscModule===undefined ) {
                try {
                    SeLiteMiscModule= Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js", {} ).SeLiteMisc;
                }
                catch( e ) {
                    SeLiteMiscModule= null;
                }
            }
            return SeLiteMiscModule;
        };
        
        /** Get all add-ons that have sequencer manifest. Store them in SeLiteExtensionSequencer.Loader.addonsById.
         *  @param {Array} addons As passed from AddonManager.getAllAddons(): an array of AddOn objects.
         *  @param {Array} problems Array, where this adds any problem messages as strings.
         *  @return {Object} Information about all add-ons. Object { string addonId => Addon object }. This includes all active (enabled) add-ons, not just ones with SeLiteExtensionSequencerManifest.js. I need those other add-ons later when calling SeLiteExtensionSequencer.sortedPlugins( SeLiteExtensionSequencer.Loader.addonsById ), which checks for non-sequenced dependencies.
         **/
        SeLiteExtensionSequencer.Loader.getAddonsById= function getAddonsById( addons, problems ) {
            var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
            var result= {};
            for( var i=0; i<addons.length; i++ ) { //@TODO low: for(.. of ..) once NetBeans supports it
                var addon= addons[i];
                if( addon.isActive ) {
                    result[ addon.id ]= addon;
                    // On Windows some addon objects don't have function 'hasResource'
                    if( addon.hasResource && addon.hasResource( 'chrome/content/SeLiteExtensionSequencerManifest.js') ) {
                        console.log( 'SeLiteExtensionSequencer is registering addon with ID ' +addon.id );
                        var fileURL= addon.getResourceURI('chrome/content/SeLiteExtensionSequencerManifest.js').spec;
                        try {
                            subScriptLoader.loadSubScript(
                                fileURL,
                                { SeLiteExtensionSequencer: SeLiteExtensionSequencer
                                },
                                'UTF-8'
                            );
                        }
                        catch( e ) {
                            problems.push( 'Add-on ' +addon.name+ ' has an error in its SeLiteExtensionSequencerManifest.js. Please, '+
                                (addon.supportURL
                                 ? '<a href="' +addon.supportURL+ '">report this issue</a>.'
                                 : 'report this issue to its author (but not to SeLite project).'
                                )
                            );
                            if( !e.messageContainsStackWithExcludedCommonBaseBySeLiteMisc ) {
                                if( getSeLiteMisc() ) {
                                    getSeLiteMisc().addStackToMessage( e, true );
                                }
                                else {
                                    e.message+= '\n' +e.stack;
                                }
                            }
                            var errorLines= ( ''+e ).split('\n'); 
                            Array.prototype.push.apply( problems, errorLines ); // Push items of errorLines[] one by one - different to problems.push(errorLines), which pushes whole errorLines as one item.
                        }
                    }
                }
            }
            return result;
        };
        
        /** @param {Object} object
         *  @return {Array} Array of any value entries in object. I.e. Array [x..], where object[someField]===x. Just like SeLiteMisc.objectValues( object, false );
         * */
        function values(object) {
            var result= [];
            for( var field in object ) {
                result.push( object[field] );
            }
            return result;
        }
        
        function pluginNameAndLinks( pluginInfo ) {//@TODO simplify once we have infoURL and downloadURL as requierd/autogenerated
            return (pluginInfo.infoURL
                ? '<a href="' +pluginInfo.infoURL+ '">' +pluginInfo.name+ '</a>'
                : pluginInfo.name
            ) +(pluginInfo.downloadURL
                ? ' (<a href="' +pluginInfo.downloadURL+ '">download</a>)'
                : '' );
        }
        
        /** Report any missing dependancies.
         * @param {Object} addonsById {string addonId: AddOn object} Result of SeLiteExtensionSequencer.Loader.getAddonsById().
         * @param {Object} sortedPlugins Result of SeLiteExtensionSequencer.sortedPlugins().
         *  @param {Array} problems Array, where this adds any problem messages as strings.
         * */
        SeLiteExtensionSequencer.Loader.reportMissingDependancies= function reportMissingDependancies( addonsById, sortedPlugins, problems ) {
            if( Object.keys(sortedPlugins.missingDirectDependancies).length ) {
                var numberOfBrokenSeLiteAddOns= 0; // Number of add-ons directly or indirectly broken. An add-on broken in both ways will be there twice.
                // ... means http://es6-features.org/#SpreadOperator:
                var brokenDependantIds= [ ...Object.keys(sortedPlugins.missingDirectDependancies), ...Object.keys(sortedPlugins.brokenDirectDependancies) ];
                for( var pluginId of brokenDependantIds ) {
                    if( pluginId.indexOf('@selite.googlecode.com')>0 ) {
                        numberOfBrokenSeLiteAddOns++;
                    }
                }
                problems.push( 'Following Selenium IDE plugin(s) are not activated, because they are incompatible, or they depend on plugins that are out of date or missing. Upgrade or install them.'
                    +(numberOfBrokenSeLiteAddOns
                        ? (numberOfBrokenSeLiteAddOns===brokenDependantIds.length
                            ? ' See also'
                            : ' For those of them which are SeLite add-on(s), see also'
                          )+ ' <a href="http://selite.github.io/AddOnsDependants">http://selite.github.io/AddOnsDependants</a>.'
                        : ''
                    )
                );
                problems.push( '' );
                
                problems.push( "Add-on(s) having problems with plugin(s) that they directly depend on:" );
                for( var pluginId in sortedPlugins.missingDirectDependancies ) {
                    var missingDirectDependancies= sortedPlugins.missingDirectDependancies[pluginId];
                    var pluginDetailsHTML= pluginNameAndLinks( SeLiteExtensionSequencer.pluginInfos[pluginId] );
                    if( Object.keys( missingDirectDependancies[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING] ).length ) {
                        problems.push( pluginDetailsHTML+ ' directly depends on missing plugin(s), so get them: ' +
                            values( missingDirectDependancies[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_MISSING] ).map(pluginNameAndLinks).join(', ')+ '.' );
                    }
                    if( Object.keys( missingDirectDependancies[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_OLD] ).length ) {
                        problems.push( pluginDetailsHTML+ ' directly depends on plugin(s) that are too old, so upgrade them: ' +
                            values( missingDirectDependancies[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_OLD] ).map(pluginNameAndLinks).join(', ')+ '.' );
                    }
                    if( Object.keys( missingDirectDependancies[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_NEW] ).length ) {
                        problems.push( pluginDetailsHTML+ ' is too old, so upgrade it. Its old version is not compatible with new versions of plugin(s) that it depends on: ' +
                            values( missingDirectDependancies[SeLiteExtensionSequencer.DIRECT_DEPENDANCY_TOO_NEW] ).map(pluginNameAndLinks).join(', ')+ '.' );
                    }
                    if( pluginId in sortedPlugins.brokenDirectDependancies ) {
                        problems.push( pluginDetailsHTML+ ' also indirectly depends on other missing or incompatible plugin(s) through following plugin(s): ' +
                            values( sortedPlugins.brokenDirectDependancies[pluginId] ).map(pluginNameAndLinks).join(', ')+ '.' );
                    }
                }
                if( Object.keys(sortedPlugins.brokenDirectDependancies).length ) {
                    var pluginIdsMissingIndirectDependanciesOnly= [];
                    for( var pluginId in sortedPlugins.brokenDirectDependancies ) {
                        if( !(pluginId in sortedPlugins.missingDirectDependancies) ) {
                            pluginIdsMissingIndirectDependanciesOnly.push( pluginId );
                        }
                    }
                    if( pluginIdsMissingIndirectDependanciesOnly.length ) {
                        problems.push( '' );
                        problems.push( "Add-on(s) having problems with plugin(s) that they indirectly depend on:" );
                        for( var pluginId of pluginIdsMissingIndirectDependanciesOnly ) {
                            problems.push( pluginNameAndLinks( SeLiteExtensionSequencer.pluginInfos[pluginId] )+ ' indirectly depends on missing or incompatible plugin(s) through following plugin(s): ' +
                                values( sortedPlugins.brokenDirectDependancies[pluginId] ).map(pluginNameAndLinks).join(', ')+ '.' );
                        }
                    }
                }
            }
        };
        
        function pluginIdToNameAndLinks( pluginId ) {
            return pluginNameAndLinks( SeLiteExtensionSequencer.pluginInfos[pluginId] );
        }
        
        /** Register add-ons (that have all dependancies) with Selenium IDE. Run their preaActivate() where present.
         * @param {Object} sortedPlugins Result of SeLiteExtensionSequencer.sortedPlugins().
         * @param {Array} problems Array, where this adds any problem messages as strings.
         * */
        SeLiteExtensionSequencer.Loader.registerAndPreActivate= function registerAndPreActivate( sortedPlugins, problems ) {
            // The actual registration
            var failed= {}; // Object { string failed pluginId => exception }
            for( var pluginId of sortedPlugins.sortedPluginIds ) {
                var pluginInfo= SeLiteExtensionSequencer.pluginInfos[pluginId];
                var ide_api = new API();
                try {
                    // I register the plugin even if it has no core/ide extension URL. That way it
                    // will be listed in Selenium IDE > Options > Options > Plugins.
                    ide_api.addPlugin(pluginId);
                    for( var ideURL of pluginInfo.ideURL ) {
                        ide_api.addPluginProvidedIdeExtension( ideURL );
                    }
                    for( var j=0; j<pluginInfo.coreURL.length; j++ ) {
                        if( j<pluginInfo.xmlURL.length ) {
                            ide_api.addPluginProvidedUserExtension( pluginInfo.coreURL[j], pluginInfo.xmlURL[j] );
                        }
                        else {
                            ide_api.addPluginProvidedUserExtension( pluginInfo.coreURL[j] );
                        }
                    }
                    if( pluginInfo.preActivate ) {
                        pluginInfo.preActivate.call( null, ide_api );
                    }
                }
                catch(e) {
                    failed[pluginId]= e;
                }
            }
            if( Object.keys(failed).length ) {
                for( var pluginId in failed ) {
                    var e= failed[pluginId];
                    if( problems.length ) {
                        problems.push( '' );
                    }
                    var pluginInfo= SeLiteExtensionSequencer.pluginInfos[pluginId];
                    problems.push( 'Failure when initialising Selenium IDE plugin ' +pluginNameAndLinks(pluginInfo)+ ':' );
                    if( !e.messageContainsStackWithExcludedCommonBaseBySeLiteMisc ) {
                        if( getSeLiteMisc() ) {
                            getSeLiteMisc().addStackToMessage( e, true );
                        }
                        else {
                            e.message+= '\n' +e.stack;
                        }
                    }
                    var errorLines= ( ''+e ).split('\n'); 
                    Array.prototype.push.apply( problems, errorLines ); // See a comment for the same call above
                    var hasSeparateDownloadPage= pluginInfo.downloadURL!==undefined/*<- @TODO remove once we don't support backwards */ && pluginInfo.downloadURL!==pluginInfo.infoURL;
                    problems.push( (
                            hasSeparateDownloadPage
                                ? '<a href="' +pluginInfo.downloadURL+ '">Get its newest version</a>'
                                : 'Get its newest version'
                        )
                        + ' (if available) and check its <a href="' +pluginInfo.infoURL+ '">documentation</a>.'
                        + " If that doesn't help, " +(
                            SeLiteExtensionSequencer.Loader.addonsById[pluginId].supportURL
                                ? '<a href="' +SeLiteExtensionSequencer.Loader.addonsById[pluginId].supportURL+ '">report the issue</a>.'
                                : 'report the issue to its author.'
                        )
                    );
                    // Collect all directly and indirectly dependant add-ons:
                    var dependantIds= [pluginId];
                    // dependantIds.length may increase during the inner loop, which adds any new dependants to its end. That's OK with the outer loop.
                    for( var dependantId of dependantIds ) { // We're collecting add-ons for which dependantIds[i] is a provider - they are its dependants.
                        for( var subDependantId in SeLiteExtensionSequencer.pluginInfos ) {
                            var subDependantInfo= SeLiteExtensionSequencer.pluginInfos[subDependantId];
                            if( dependantId in subDependantInfo.requisitePlugins && dependantIds.indexOf(subDependantId)<0 ) {
                                dependantIds.push( subDependantId );
                            }
                        }
                    }
                    dependantIds.splice( 0, 1 );
                    if( dependantIds.length ) {
                        problems.push( 'It may also break add-on(s) that depend on it directly or indirectly: ' +dependantIds.map(pluginIdToNameAndLinks).join(', ')+ '.' );
                    }
                }
            }
        };
        
        Components.utils.import("resource://gre/modules/AddonManager.jsm");
        // For some reasons I couldn't use console (from resource://devtools/Console.jsm) here (in Firefox 26.0, Selenium IDE 2.5.0). Using it generated a log: can't start debugging: a debuggee script is on the stack webconsole.js:68. I could use console in the handler function passed to AddonManager.getAllAddons():
        AddonManager.getAllAddons( function(addons) {
            var problems= [];
            // There are three ways to invoke this file:
            // 1. At normal Firefox startup, Firefox loads this file automatically
            // 2. and 3. from chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul:
            // - 2. after a normal Firefox startup by visiting chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul
            // - 3. when starting firefox -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul - then Firefox doesn't load this file automatically as per 1. That's why the following if() can't have !global.runAsCheck as a condition.

            if( !SeLiteExtensionSequencer.Loader.addonsById ) {
                /** Following is saved in SeLiteExtensionSequencer.Loader (i.e. accessible from JS code module), which is not elegant. It's so that I can re-use it, when debugging extension-loader.js from chrome://selite-extension-sequencer/content/extensions/invoke.xul after Firefox startup. */
                SeLiteExtensionSequencer.Loader.addonsById= SeLiteExtensionSequencer.Loader.getAddonsById( addons, problems );
            }
            
            var sortedPlugins= SeLiteExtensionSequencer.sortedPlugins( SeLiteExtensionSequencer.Loader.addonsById, problems );
            SeLiteExtensionSequencer.Loader.reportMissingDependancies( SeLiteExtensionSequencer.Loader.addonsById, sortedPlugins, problems );
            if( !global.runAsCheck || global.registerAndPreActivate ) { // See a similar check above
                if( global.runAsCheck ) {
                    // This file was invoked from checkAndQuit.xul?registerAndPreActivate, which doesn't have API class defined and it can't access load chrome://selenium-ide/content/api.js when checkAndQuit.xul serves instead of Firefox's default browser.xul (i.e. when running firefox -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul?registerAndPreActivate from run_tests.sh). Even if I loaded api.js here through mozIJSSubScriptLoader, I'd still have to load other Selenium IDE files - and they probably depend on Firefox internals for browser.xul that is not active. I've also tried to load all .js files referenced from chrome://selenium-ide/content/selenium-ide-overlay.xul, but that didn't help. So I just create a dummy API class.
                    global.API= function API() {};
                    global.API.prototype= {
                        addPlugin: function() {},
                        addPluginProvidedIdeExtension: function() {},
                        addPluginProvidedUserExtension: function() {}
                    };
                }
                SeLiteExtensionSequencer.Loader.registerAndPreActivate( sortedPlugins, problems );
            }
            if( problems.length>0 ) {
                var title= "Problem(s) with add-on(s) for Firefox and Selenium IDE";
                var message= problems.join('<br/>\n');
                console.error( title );
                console.error( message );
                if( !global.runAsCheck ) {
                    SeLiteExtensionSequencer.popup( window, title, message );
                }
            }
            if( global.runAsCheck ) {
                global.afterChecks( problems );
            }
        } );
    } )( this );
   SeLiteExtensionSequencer.processedAlready= true;
}