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

// Therefore here I make sure to register this plugin itself and I load sequencer manifests of target plugins and register them with Selenium only once.
if( !SeLiteExtensionSequencer.processedAlready ) {
    (function() { // closure to make the variables local
        // I must reset SeLiteExtensionSequencer.coreExtensionsLoadedTimes. I can't expect that extensions will have an even number of loads - because if the user closes Selenium IDE before running any Selenese, the extensions don't get loaded for the 2nd time during that run of Selenium IDE, and the odd-even sequence would not apply.
        SeLiteExtensionSequencer.coreExtensionsLoadedTimes= {};

        var ide_api= new API(); // API comes from chrome://selenium-ide/content/api.js - referenced through ./extension-loader.xul
        // Register itself - so that it shows up in Selenium IDE > Options > Options > Plugins
        ide_api.addPluginProvidedUserExtension( 'chrome://selite-extension-sequencer/content/extensions/core.js' );
        ide_api.addPlugin( 'extension-sequencer@selite.googlecode.com' );

        var SeLiteMiscModule;
        // Lazy quiet loader of SeLiteMisc.
        var SeLiteMisc= function SeLiteMisc() {
            try {
                if( !SeLiteMiscModule ) {
                    SeLiteMiscModule= Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js", {} ).SeLiteMisc;
                }
                return SeLiteMiscModule;
            }
            catch( e ) {}
        };
        
        /* Following functions exist in SeLiteExtensionSequencer.Loader, so that I can invoke this file from test.xul for debugging. It's difficult to debug otherwise: if you start firefox binary with parameter -jsdebugger, this file gets processed before the debugger shows up. Also, following is stored within JS code module object, which is ugly. It's because Selenium IDE loads this file twice. Maybe related to http://code.google.com/p/selenium/issues/detail?id=6697 */
        
        /** Get all add-ons that have sequencer manifest. Store them in SeLiteExtensionSequencer.Loader.addonsById.
         *  @param {Array} addons As passed from AddonManager.getAllAddons().
         *  @return {Object} Information about all add-ons. Object { string addOnId => Addon object }. This includes all active (enabled) add-ons, not just ones with SeLiteExtensionSequencerManifest.js. I need those other add-ons later when calling SeLiteExtensionSequencer.sortedPlugins( SeLiteExtensionSequencer.Loader.addonsById ), which checks for non-sequenced dependencies.
         **/
        SeLiteExtensionSequencer.Loader.getAddonsById= function getAddonsById( addons ) {
            var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
            var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
            var result= {};
            var problems= [];
            for( var i=0; i<addons.length; i++ ) { //@TODO for(.. of ..) once NetBeans supports it
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
                            problems.push( 'Add-on ' +addon.name+ ' has an error in its SeLiteExtensionSequencerManifest.js. Please report this issue '+
                                (addon.id.indexOf('@selite.googlecode.com')>0
                                 ? 'at <a href="https://code.google.com/p/selite/wiki/ReportingIssues/">https://code.google.com/p/selite/wiki/ReportingIssues/</a>'
                                 : 'to its author (but not to SeLite project).'
                                )
                            );
                            if( !e.messageContainsStackAddedBySeLiteMisc || !error.messageContainsStackWithExcludedCommonBaseBySeLiteMisc ) {
                                if( SeLiteMisc() ) {
                                    SeLiteMisc().addStackToMessage( e, true );
                                }
                                else {
                                    e.message+= '\n' +e.stack;
                                }
                            }
                            var errorLines= ( ''+e ).split('\n'); 
                            Array.prototype.push.apply( problems, errorLines );
                        }
                    }
                }
            }
            if( problems.length>0 ) {
                console.error( "Problem(s) in SeLiteExtensionSequencerManifest.js in add-on(s) for Firefox and Selenium IDE:\n" +problems.join('\n') );
                SeLiteExtensionSequencer.popup( window, "Problem(s) in SeLiteExtensionSequencerManifest.js in add-on(s) for Firefox and Selenium IDE", problems.join('\n<br/>\n') );
            }            
            return result;
        };
        
        /** Report any missing dependancies.
         * @param {Object} addonsById Result of SeLiteExtensionSequencer.Loader.getAddonsById().
         * @param {Object} sortedPlugins Result of SeLiteExtensionSequencer.sortedPlugins().
         * */
        SeLiteExtensionSequencer.Loader.reportMissingDependancies= function reportMissingDependancies( addonsById, sortedPlugins ) {
            var problems= [];
            if( Object.keys(sortedPlugins.missingDirectDependancies).length ) {
                var dependancyPluginNames= {}; // { pluginId => pluginName } - for dependancies only
                for( var dependantId in SeLiteExtensionSequencer.pluginInfos ) {
                    var pluginInfo= SeLiteExtensionSequencer.pluginInfos[dependantId];
                    for( var dependencyPluginId in pluginInfo.requisitePlugins ) {
                        dependancyPluginNames[dependencyPluginId]= pluginInfo.requisitePlugins[dependencyPluginId];
                    }
                    for( var dependencyPluginId in pluginInfo.optionalRequisitePlugins ) {
                        dependancyPluginNames[dependencyPluginId]= pluginInfo.optionalRequisitePlugins[dependencyPluginId];
                    }
                    for( var dependencyPluginId in pluginInfo.nonSequencedRequisitePlugins ) {
                        dependancyPluginNames[dependencyPluginId]= pluginInfo.nonSequencedRequisitePlugins[dependencyPluginId];
                    }
                }
                
                var numberOfBrokenSeLiteAddOns= 0; // Number of add-ons directly or indirectly broken. An add-on broken in both ways will be there twice.
                var brokenDependantIds= Object.keys(sortedPlugins.missingDirectDependancies).concat( Object.keys(sortedPlugins.brokenDirectDependancies) );
                for( var i=0; i<brokenDependantIds.length; i++ ) {//TODO low: (for pluginId of ..)
                    if( brokenDependantIds[i].indexOf('selite.googlecode.com')>0 ) {
                        numberOfBrokenSeLiteAddOns++;
                    }
                }
                problems.push( 'Following Selenium IDE plugin(s) are missing their dependancy plugin(s). They are therefore inactive. Please, install (or enable) any missing dependancies. Please follow documentation of the plugin.'
                    +(numberOfBrokenSeLiteAddOns
                        ? (numberOfBrokenSeLiteAddOns===brokenDependantIds.length
                            ? ' See also'
                            : ' For those of them which are SeLite add-on(s), see also'
                          )+ ' <a href="https://code.google.com/p/selite/wiki/AddOnsDependencies">https://code.google.com/p/selite/wiki/AddOnsDependants</a>.'
                        : ''
                    )
                );
                problems.push( '' );
                problems.push( "Plugin(s) missing at least one direct dependency:" );
                var pluginIdToName= function pluginIdToName(pluginId) {
                    return dependancyPluginNames[pluginId];
                };
                for( var pluginId in sortedPlugins.missingDirectDependancies ) {
                    problems.push( addonsById[pluginId].name+ ' directly depends on missing plugin(s): ' +
                        sortedPlugins.missingDirectDependancies[pluginId].map(pluginIdToName).join(', ')+ '.' );
                    if( pluginId in sortedPlugins.brokenDirectDependancies ) {
                        problems.push( 'It also indirectly depends on other missing plugin(s) through following plugin(s): ' +
                            sortedPlugins.brokenDirectDependancies[pluginId].map(pluginIdToName).join(', ')+ '.' );
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
                        problems.push( "\nPlugin(s) missing indirect dependencies only:" );
                        for( var i=0; i<pluginIdsMissingIndirectDependanciesOnly.length; i++ ) {//@TODO low: for(..of..)
                            var pluginId= pluginIdsMissingIndirectDependanciesOnly[i];
                            problems.push( addonsById[pluginId].name+ ' indirectly depends on missing plugin(s) through following plugin(s): ' +
                                sortedPlugins.brokenDirectDependancies[pluginId].map(pluginIdToName).join(', ')+ '.' );
                        }
                    }
                }
                //@TODO brokenDirectDependancies
            }
            if( problems.length>0 ) {
                console.error( "Problem(s) with dependant add-on(s) for Firefox and Selenium IDE:\n" +problems.join('\n') );
                SeLiteExtensionSequencer.popup( window, "Problem(s) with dependant add-on(s) for Firefox and Selenium IDE", problems.join('\n<br/>\n') );
            }
        };
        
        /** Register add-ons (that have all dependancies) with Selenium IDE. Run their preaActivate() where present.
         * @param {Object} sortedPlugins Result of SeLiteExtensionSequencer.sortedPlugins().
         * */
        SeLiteExtensionSequencer.Loader.registerAndPreActivate= function registerAndPreActivate( sortedPlugins ) {
            // The actual registration
            var failed= {}; // Object { string failed pluginId => exception }
            for( var i=0; i<sortedPlugins.sortedPluginIds.length; i++ ) {//@TODO low: for(..of..)
                var pluginId= sortedPlugins.sortedPluginIds[i];
                var pluginInfo= SeLiteExtensionSequencer.pluginInfos[pluginId];
                var ide_api = new API();
                try {
                    // I register the plugin even if it has no core/ide extension URL. That way it
                    // will be listed in Selenium IDE > Options > Options > Plugins.
                    ide_api.addPlugin(pluginId);
                    for( var j=0; j<pluginInfo.ideURL.length; j++ ) {//@TODO low: for(..of..)
                        ide_api.addPluginProvidedIdeExtension( pluginInfo.ideURL[j] );
                    }
                    for( var j=0; j<pluginInfo.coreURL.length; j++ ) {//@TODO low: for(..of..)
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
            var problems= [];
            if( Object.keys(failed).length ) {
                for( var pluginId in failed ) {
                    var e= failed[pluginId];
                    if( problems.length ) {
                        problems.push( '' );
                    }
                    problems.push( 'Failure when initialising Selenium IDE plugin ' +pluginId+ ': ' ); //@TODO show plugin name instead
                    if( !e.messageContainsStackAddedBySeLiteMisc || !e.messageContainsStackWithExcludedCommonBaseBySeLiteMisc ) {
                        if( SeLiteMisc() ) {
                            SeLiteMisc().addStackToMessage( e, true );
                        }
                        else {
                            e.message+= '\n' +e.stack;
                        }
                    }
                    var errorLines= ( ''+e ).split('\n'); 
                    Array.prototype.push.apply( problems, errorLines );
                    var isSeLiteAddon= pluginId.indexOf('selite.googlecode.com');
                    problems.push( 'Please get its newest version (if available)' +(
                            isSeLiteAddon
                                ? ' from <a href="https://code.google.com/p/selite/wiki/AddOns">https://code.google.com/p/selite/wiki/AddOns</a>'
                                : ' from its website'
                        )
                        + ', check its documentation' +(
                            isSeLiteAddon
                                ? ' at <a href="https://code.google.com/p/selite/wiki/ProjectHome">https://code.google.com/p/selite/wiki/ProjectHome</a>'
                                : '' )
                        + " and if that doesn't help, report the issue" +(
                            isSeLiteAddon
                                ? ' at <a href="https://code.google.com/p/selite/wiki/ReportingIssues">https://code.google.com/p/selite/wiki/ReportingIssues</a>.'
                                : ' to its author.'
                        )
                    );
                    // Collect all directly and indirectly dependant add-ons:
                    var dependantIds= [pluginId];
                    // dependantIds.length may increase during the inner loop, which adds any new dependants to its end. That's OK with the outer loop.
                    for( var i=0; i<dependantIds.length; i++ ) {//@TODO low: for(..of..)
                        var dependantId= dependantIds[i]; // We're collecting add-ons for which dependantIds[i] is a provider - they are its dependants.
                        for( var subDependantId in SeLiteExtensionSequencer.pluginInfos ) {
                            var subDependantInfo= SeLiteExtensionSequencer.pluginInfos[subDependantId];
                            if( dependantId in subDependantInfo.requisitePlugins && dependantIds.indexOf(subDependantId)<0 ) {
                                dependantIds.push( subDependantId );
                            }
                        }
                    }
                    dependantIds.splice( 0, 1 );
                    if( dependantIds.length ) {
                        problems.push( 'It may also break add-on(s) that depend on it directly or indirectly:' +dependantIds.join(', ')+ '.' );
                    }
                }
            }
            if( problems.length>0 ) {
                console.error( "Problem(s) with add-on(s) for Firefox and Selenium IDE:\n" +problems.join('\n') );
                SeLiteExtensionSequencer.popup( window, "Problem(s) with add-on(s) for Firefox and Selenium IDE", problems.join('\n<br/>\n') );
            }
        };
        
        Components.utils.import("resource://gre/modules/AddonManager.jsm");
        // For some reasons I couldn't use console (from resource://gre/modules/devtools/Console.jsm) here (in Firefox 26.0, Selenium IDE 2.5.0). Using it generated a log: can't start debugging: a debuggee script is on the stack webconsole.js:68. I could use console in the handler function passed to AddonManager.getAllAddons():
        AddonManager.getAllAddons( function(addons) {
            SeLiteExtensionSequencer.Loader.addonsById= SeLiteExtensionSequencer.Loader.getAddonsById( addons );
            var sortedPlugins= SeLiteExtensionSequencer.sortedPlugins( SeLiteExtensionSequencer.Loader.addonsById );
            SeLiteExtensionSequencer.Loader.reportMissingDependancies( SeLiteExtensionSequencer.Loader.addonsById, sortedPlugins );
            SeLiteExtensionSequencer.Loader.registerAndPreActivate( sortedPlugins );
        } );
    } )();
   SeLiteExtensionSequencer.processedAlready= true;
} 