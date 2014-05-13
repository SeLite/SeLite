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

SeLiteData.selectOne= function selectOne( recordOrSet ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).selectOne();
};

SeLiteData.insert= function insert( recordOrSet ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).insert();
}

SeLiteData.update= function update( recordOrSet ) {
    SeLiteData.recordOrSetHolder(recordOrSet).update();
};

SeLiteData.remove= function remove( recordOrSet ) {
    SeLiteData.recordOrSetHolder(recordOrSet).remove();
};

SeLiteData.randomRecord= function randomRecord( recordSet ) {
    var numRecords= SeLiteMisc.numberOfRecords( recordSet );
    return SeLiteMisc.nthRecord( recordSet, Math.round( Math.random()*(numRecords-1) ) );
};

var EXPORTED_SYMBOLS= [];