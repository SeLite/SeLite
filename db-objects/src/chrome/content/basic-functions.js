"use strict";
/* This contains shortcut-like functions.
/*/
Components.utils.import( 'chrome://selite-misc/content/selite-misc.js' );
Components.utils.import('chrome://selite-db-objects/content/db.js');
Components.utils.import('chrome://selite-db-objects/content/basic-storage.js');
Components.utils.import('chrome://selite-db-objects/content/basic-objects.js');

SeLiteData.select= function select( recordOrSet ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).select();
};

SeLiteData.selectOne= function selectOne( recordOrSet ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).selectOne();
};

SeLiteData.insert= function insert( recordOrSet ) {
    return SeLteData.recordOrSetHolder(recordOrSet).insert();
}

SeLiteData.update= function update( recordOrSet ) {
    SeLiteData.recordOrSetHolder(recordOrSet).update();
};

SeLiteData.markToRemove= function markToRemove( record ) {
    SeLiteData.recordHolder(record).markToRemove();
};

//@TODO RecordSetHolder.put() - should it be instead of replace()?
SeLiteData.put= function put( recordOrSet ) {
    SeLiteData.recordOrSetHolder(recordOrSet).put();
};

SeLiteData.remove= function remove( recordOrSet ) {
    SeLiteData.recordOrSetHolder(recordOrSet).remove();
};

SeLiteData.randomRecord= function randomRecord( recordSet ) {
    var numRecords= SeLiteMisc.numberOfRecords( recordSet );
    return SeLiteMisc.nthRecord( recordSet, Math.round( Math.random()*(numRecords-1) ) );
};

var EXPORTED_SYMBOLS= [];