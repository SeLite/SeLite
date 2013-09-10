"use strict";

function SeLiteCoreLoader() {}

/** Object serving as an associative array {
 *  string pluginId => object {
 *     string 'url' => plugin url (usually chrome://...)
 *     string 'requisitePluginIds' => array (possibly empty) of strings which are plugin ids of requisite plugins
 *  }
 * */
SeLiteCoreLoader.plugins= {};

SeLiteCoreLoader.registerPlugin= function( pluginId, url, requisitePluginIds ) {
    if( pluginId in SeLiteCoreLoader.plugins ) {
        throw new Error("Plugin " +pluginId+ " was already registered with SeLite Core loader.");
    }
    if( typeof requisitePluginIds==='undefined' ) {
        requisitePluginIds= [];
    }
    SeLiteCoreLoader.plugins[pluginId]= {
        url: url,
        requisitePluginIds: requisitePluginIds
    };
};

SeLiteCoreLoader.sortedPluginIds= function() {
    // Partial copy of SeLiteCoreLoader.plugins. Used by this function, which will remove requisite plugin ids
    // from pluginUnprocessedRequisites[xxx][], as they get processed.
    var pluginUnprocessedRequisites= {}; // { dependant plugin id => [unprocessed requisite plugin id...] }
    for( var dependantId in SeLiteCoreLoader.plugins ) {
        pluginUnprocessedRequisites[dependantId]=
            SeLiteCoreLoader.plugins[dependantId].requisitePluginIds.slice(0); // shallow copy
    }
    
    var unprocessedIds= Object.keys(SeLiteCoreLoader.plugins);
    var result= []; // [pluginId...] in the order from one with no dependencies, to the dependant ones
    
    // I believe this has computational cost O(N^2), which is fine with me.
    for( var i=0; i<unprocessedIds.length; i++ ) {
        var pluginId=unprocessedIds[i];
        if( !pluginUnprocessedRequisites[pluginId].length ) {
            result.push( pluginId );
            delete pluginUnprocessedRequisites[pluginId];
            unprocessedIds.splice(i, 1); // remove index i from unprocessedIds[]
            
            // Remove pluginId from dependencies of the rest of unprocessed plugins - from pluginUnprocessedRequisites[xxx][]
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
    if( unprocessedIds.length ) {
        var msg= '';
        for( var i=0; i<unprocessedIds.length; i++ ) {
            var pluginId= unprocessedIds[i];
            if( msg!=='' ) {
                msg+= ', ';
            }
            msg+= pluginId+ ' dependant on unprocessed plugin(s) [' +pluginUnprocessedRequisites[pluginId]+ ']';
        }
        msg= "Something bad in SeLiteCoreLoader.sort(), "
            + "or there is a cyclic dependency between plugin(s), "
            + "or you haven't installed at least one dependency. Buggy plugin(s): " +msg+ '.' + 'Result: ' +result;
        throw new Error( msg );
    }
    return result;
};
        
var EXPORTED_SYMBOLS= ['SeLiteCoreLoader'];