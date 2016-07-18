"use strict";
/* This contains shortcut-like functions.
/*/
Components.utils.import( 'chrome://selite-misc/content/SeLiteMisc.js' );
Components.utils.import('chrome://selite-db-objects/content/Db.js');
Components.utils.import('chrome://selite-db-objects/content/DbStorage.js');
Components.utils.import('chrome://selite-db-objects/content/DbObjects.js');

SeLiteData.select= function select( recordOrSet ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).select();
};

SeLiteData.selectOne= function selectOne( recordOrSet, sync=false ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).selectOne( sync );
};

SeLiteData.insert= function insert( recordOrSet, sync=false ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).insert( sync );
}

SeLiteData.update= function update( recordOrSet, sync=false ) {
    SeLiteData.recordOrSetHolder(recordOrSet).update( sync );
};

SeLiteData.remove= function remove( recordOrSet, sync=false ) {
    SeLiteData.recordOrSetHolder(recordOrSet).remove( sync );
};

SeLiteData.randomRecord= function randomRecord( recordSet ) {
    var numRecords= SeLiteMisc.numberOfRecords( recordSet );
    return SeLiteMisc.nthRecord( recordSet, Math.round( Math.random()*(numRecords-1) ) );
};

var EXPORTED_SYMBOLS= [];