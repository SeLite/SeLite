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
        Components.utils.import("resource://gre/modules/AddonManager.jsm");
        
        // Selenium IDE loads this file twice. Maybe related to
        // http://code.google.com/p/selenium/issues/detail?id=6697
        // Therefore here I make sure to register this plugin itself and I load sequencer manifests of target plugins and register them with Selenium only once.

        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        if( !SeLiteExtensionSequencer.processedAlready ) {
            //@TODO Move the following
            
            // I must reset SeLiteExtensionSequencer.coreExtensionsLoadedTimes. I can't expect that extensions will have an even number of loads - because if the user closes Selenium IDE before running any Selenese, the extensions don't get loaded for the 2nd time during that run of Selenium IDE, and the odd-even sequence would not apply.
            SeLiteExtensionSequencer.coreExtensionsLoadedTimes= {};
            
            var ide_api= new API(); // API comes from chrome://selenium-ide/content/api.js - referenced through ./extension-loader.xul
            // Register itself - so that it shows up in Selenium IDE > Options > Options > Plugins
            ide_api.addPluginProvidedUserExtension( 'chrome://selite-extension-sequencer/content/extensions/core.js' );
            ide_api.addPlugin( 'extension-sequencer@selite.googlecode.com' );

            // For some reasons I couldn't use console here (Firefox 26.0, Selenium IDE 2.5.0). Using it generated a log: can't start debugging: a debuggee script is on the stack webconsole.js:68
            AddonManager.getAllAddons(
            function( addons ) {
                var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
                var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
                var addonsById= {}; // Object { string addOnId => Addon object }.
                var messageCopiedToConsole= '(This is also copied to Firefox > Tools > Web Developer > Browser Toolbox.)';
                for( var i=0; i<addons.length; i++ ) { //@TODO for(.. of ..) once NetBeans supports it
                    var addon= addons[i];
                    addonsById[ addon.id ]= addon;
                    // On Windows some addon objects don't have function 'hasResource'
                    if( addon.isActive && addon.hasResource && addon.hasResource( 'chrome/content/SeLiteExtensionSequencerManifest.js') ) {
                        console.log( 'SeLiteExtensionSequencer is registering addon with ID ' +addon.id );
                        var fileUrl= addon.getResourceURI('chrome/content/SeLiteExtensionSequencerManifest.js').spec;
                        try {
                            subScriptLoader.loadSubScript(
                                fileUrl,
                                { SeLiteExtensionSequencer: SeLiteExtensionSequencer
                                },
                                'UTF-8'
                            );
                        }
                        catch( e ) {
                            var msg= 'Add-on ' +addon.name+ ' has an error in its SeLiteExtensionSequencerManifest.js: ' +e+ '\n'+ e.stack;
                            console.error( msg );
                            SeLiteExtensionSequencer.popup( 'Disabling an add-on for Firefox and Selenium IDE', messageCopiedToConsole+ ' ' +msg );
                            addon.userDisabled= true;
                        }
                    }
                }
                var sortedPlugins= SeLiteExtensionSequencer.sortedPlugins();
                if( Object.keys(sortedPlugins.missingDirectDependancies).length ) {
                    var dependancyPluginNames= {}; // { pluginId => pluginName } - for dependancies only
                    for( var dependantId in SeLiteExtensionSequencer.plugins ) {
                        var plugin= SeLiteExtensionSequencer.plugins[dependantId];
                        for( var dependencyPluginId in plugin.requisitePlugins ) {
                            dependancyPluginNames[dependencyPluginId]= plugin.requisitePlugins[dependencyPluginId];
                        }
                        for( var dependencyPluginId in plugin.optionalRequisitePlugins ) {
                            dependancyPluginNames[dependencyPluginId]= plugin.optionalRequisitePlugins[dependencyPluginId];
                        }
                    }                
                    var pluginIdToName= function pluginIdToName(pluginId) {
                        return dependancyPluginNames[pluginId];
                    };

                    var msg= "Following Selenium IDE plugin(s) are missing their dependancy plugin(s). Therefore "+
                        "they will be disabled next time you start Firefox. Please, install any missing "+
                        "dependancies. Then apply Firefox menu > Tools > Add-ons > Extensions > XXX > Enable.\n"+
                        "If it's an SeLite add-on, see https://code.google.com/p/selite/wiki/AddOnsDependencies\n\n"+
                        "Plugin(s) missing at least one direct dependency:\n";
                    for( var pluginId in sortedPlugins.missingDirectDependancies ) {
                        addonsById[pluginId].userDisabled= true;
                        msg+= '\n' +addonsById[pluginId].name+ ' depends on missing plugin(s): ' +
                            sortedPlugins.missingDirectDependancies[pluginId].direct.map(pluginIdToName).join(', ')+ '.';
                        if( sortedPlugins.missingDirectDependancies[pluginId].indirect.length ) {
                            msg+= ' It also depends on disabled plugin(s): ' +
                            sortedPlugins.missingDirectDependancies[pluginId].indirect.map(pluginIdToName).join(', ')+ '.';
                        }
                        msg+= '\n';
                    }
                    if( Object.keys(sortedPlugins.missingIndirectDependancies).length ) {
                        msg+= "\nPlugin(s) missing indirect dependencies only:\n";
                        for( var pluginId in sortedPlugins.missingIndirectDependancies ) {
                            addonsById[pluginId].userDisabled= true;
                            msg+= '\n' +addonsById[pluginId].name+ ' depends on disabled plugin(s): ' +
                                sortedPlugins.missingIndirectDependancies[pluginId].map(pluginIdToName).join(', ')+ '.\n';
                        }
                    }
                    console.error( msg );
                    SeLiteExtensionSequencer.popup( 'Disabling add-on(s) for Firefox and Selenium IDE', messageCopiedToConsole+ ' ' +msg );
                }
                var failed= {}; // Object { string failed pluginId => exception }
                for( var i=0; i<sortedPlugins.sortedPluginIds.length; i++ ) {
                    var pluginId= sortedPlugins.sortedPluginIds[i];
                    var plugin= SeLiteExtensionSequencer.plugins[pluginId];
                    var ide_api = new API();
                    try {
                        // I register the plugin even if it has no core/ide extension rl. That way it
                        // will be listed in Selenium IDE > Options > Options > Plugins.
                        console.log( 'SeLiteExtensionSequencer is adding plugin with ID ' +pluginId+ '. Its core extension files are ' +plugin.coreUrl+ '. Its IDE extension files are ' +plugin.ideUrl+ '.' );
                        ide_api.addPlugin(pluginId);
                        for( var j=0; j<plugin.ideUrl.length; j++ ) {
                            ide_api.addPluginProvidedIdeExtension( plugin.ideUrl[j] );
                        }
                        for( var j=0; j<plugin.coreUrl.length; j++ ) {
                            if( j<plugin.xmlUrl.length ) {
                                ide_api.addPluginProvidedUserExtension( plugin.coreUrl[j], plugin.xmlUrl[j] );
                            }
                            else {
                                ide_api.addPluginProvidedUserExtension( plugin.coreUrl[j] );
                            }
                        }
                        if( plugin.preActivate ) {
                            plugin.preActivate.call( null, ide_api );
                        }
                    }
                    catch(e) {
                        // I'll report the error, but I don't disable the plugin.
                        failed[pluginId]= e;
                    }
                }
                if( Object.keys(failed).length ) {
                    var details= [];
                    for( var pluginId in failed ) {
                        var e= failed[pluginId];
                        details.push( 'Plugin with ID ' +pluginId+ ': ' +e+ '\n' +e.stack );
                    }
                    var msg= "SeLiteExtensionSequencer couldn't load plugin(s) due to their error(s):\n" +details.join('\n\n' );
                    console.error( msg );
                    SeLiteExtensionSequencer.popup( "Error(s) in add-on(s) for Firefox and Selenium IDE", messageCopiedToConsole+ ' ' +msg );
                }
            });
            SeLiteExtensionSequencer.processedAlready= true;
        }
