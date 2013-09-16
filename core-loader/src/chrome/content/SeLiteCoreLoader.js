/*
 * Copyright 2013 Peter Kehl
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

function SeLiteCoreLoader() {}

/** Object serving as an associative array {
 *  string pluginId => object {
 *     string 'url' => plugin url (usually chrome://...)
 *     string 'requisitePluginIds' => array (possibly empty) of strings which are plugin ids of requisite plugins
 *  }
 * */
SeLiteCoreLoader.plugins= {};

/** Register a Firefox plugin which is a Selenium IDE core extension. It will be
 *  initiated by SeLiteCoreLoader later, in a proper sequence - after any dependencies.
 *  @param prototype Anonymous object in form {
 *      pluginId: string, unique id of the Firefox plugin (often in a format of an email address)
 *      coreUrl: string, optional; usually a chrome:// url,
 *      ideUrl: string, optional; usually a chrome:// url,
 *      - if neither coreUrl not ideUrl are set, then this plugin is only
 *        registered for the purpose of being a dependency of other plugins,
 *        but it's not added via Selenium API class.
 *      requisitePluginIds: Object (optional) { string pluginId: string pluginName },
 *        of plugins that are required dependencies.
 *        Those are plugins that have to be loaded before given pluginId. All
 *        those plugins must be installed in Firefox and they must also call
 *        SeLiteCoreLoader.registerPlugin() - otherwise pluginId won't get loaded.
        optionalRequisitePluginIds: Object (optional) { string pluginId: string pluginName },
          of pluginIds that are optional dependencies
        callBack: function, optional, will be called after the plugin is registered,
            and it will be passed one parametr that is Selenium IDE API object.
 *  }
 *  @return void
**/
SeLiteCoreLoader.registerPlugin= function( prototype ) {
    var plugin= {
        pluginId: prototype.pluginId,
        coreUrl: prototype.coreUrl || false,
        ideUrl: prototype.ideUrl || false,
        requisitePluginIds: prototype.requisitePluginIds || {},
        optionalRequisitePluginIds: prototype.optionalRequisitePluginIds || {},
        callBack: prototype.callBack || false
    };
    if( plugin.pluginId in SeLiteCoreLoader.plugins ) {
        throw new Error("Plugin " +plugin.pluginId+ " was already registered with SeLite Core loader.");
    }
    var mergedPluginIds= Object.keys(plugin.requisitePluginIds).concat( Object.keys(plugin.optionalRequisitePluginIds) );
    for( var i=0; i<mergedPluginIds.length; i++ ) {
        if( mergedPluginIds.indexOf(mergedPluginIds[i])!=i ) {
            // This doesn't need to show human-friendly plugin names, because it should be caught by developer
            throw new Error( "SeLite Core Loader: plugin " +plugin.pluginId+ " lists a dependancy package " +mergedPluginIds[i]+ " two or more times." );
        }
    }
    SeLiteCoreLoader.plugins[plugin.pluginId]= plugin;
};

/** Get an array of plugin IDs, sorted so that ones with no dependencies are first,
 *  and then any plugins only depending on any previous plugins. I.e. in an order
 *  that they can be safely loaded. It removes any plugins that miss any of their
 *  required dependencies, and any plugins that require (directly or indirectly)
 *  any of those removed plugins. It reports those removed plugins in the result.
 *  @return Object {
 *      sortedPluginIds: [pluginId... in the order they can be loaded],
 *      removedPluginIds: {
 *          string pluginId: [string missing direct dependency plugin id, ...],
 *          ...
 *      }
 *  }
 * */
SeLiteCoreLoader.sortedPlugins= function() {
    // pluginUnprocessedRequisites contains plugins with their required dependencies.
    // I add in any optional plugin IDs, if they are installed
    //  - so they get loaded in correct order, before the plugins that use them.
    var pluginUnprocessedRequisites= {}; // { dependant plugin id => [requisite plugin id...], ... }
    var dependancyPluginNames= {}; // { pluginId => pluginName } - for dependancies only
    for( var dependantId in SeLiteCoreLoader.plugins ) {
        var plugin= SeLiteCoreLoader.plugins[dependantId];
        pluginUnprocessedRequisites[dependantId]=
            Object.keys( plugin.requisitePluginIds ).slice(0); // protective copy
        for( var dependencyPluginId in plugin.requisitePluginIds ) {
            dependancyPluginNames[dependencyPluginId]= plugin.requisitePluginIds[dependencyPluginId];
        }
        for( var dependencyPluginId in plugin.optionalRequisitePluginIds ) {
            dependancyPluginNames[dependencyPluginId]= plugin.optionalRequisitePluginIds[dependencyPluginId];
        }
        for( var optionalPluginId in plugin.optionalRequisitePluginIds ) {
            if( optionalPluginId in SeLiteCoreLoader.plugins ) {
                pluginUnprocessedRequisites[dependantId].push( optionalPluginId );
            }
        }
    }
    
    var unprocessedIds= Object.keys(SeLiteCoreLoader.plugins);
    var sortedPluginIds= []; // [pluginId...] sorted, starting with ones with no dependencies, to the dependant ones

    // I believe this has computational cost O(N^2), which is fine with me.
    for( var i=0; i<unprocessedIds.length; i++ ) {
        var pluginId=unprocessedIds[i];
        if( !pluginUnprocessedRequisites[pluginId].length ) {
            sortedPluginIds.push( pluginId );
            delete pluginUnprocessedRequisites[pluginId];
            unprocessedIds.splice(i, 1); // remove pluginId  from unprocessedIds[]

            // Remove pluginId from dependencies of the rest of unprocessed plugins
            // - from pluginUnprocessedRequisites[xxx][]
            for( var dependantId in pluginUnprocessedRequisites ) {
                var requisites= pluginUnprocessedRequisites[dependantId];
                var index= requisites.indexOf(pluginId);
                if( index>=0 ) {
                    requisites.splice( index, 1 );
                }
            }

            i= -1; // restart the loop
            continue;
        }
    }
    // Object { ID of plugin broken because of at least one missing direct dependancy
    //     => Object {
    //       direct: [pluginID of missing direct dependancy, ...]
    //       indirect: [pluginId of disabled direct dependancy, ...]
    //     }
    //   ...
    // }
    var missingDirectDependancies= {}
    // Object { ID of plugin broken only because of missing indirect dependancies
    //     => [pluginID of disabled direct dependancy...]
    //   
    // }
    var missingIndirectDependancies= {};
    
    if( unprocessedIds.length ) {
        for( var pluginId of unprocessedIds ) {
            //var isMissingDirectDependenciesOnly= true;
            var direct= [], indirect= [];
            for( var requisiteId of pluginUnprocessedRequisites[pluginId] ) {
                if( requisiteId in SeLiteCoreLoader.plugins ) {
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
    return {
        missingDirectDependancies: missingDirectDependancies,
        missingIndirectDependancies: missingIndirectDependancies,
        sortedPluginIds: sortedPluginIds
    };
};
        
var EXPORTED_SYMBOLS= ['SeLiteCoreLoader'];