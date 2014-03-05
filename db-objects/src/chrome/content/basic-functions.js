"use strict";
/* This contains shortcut-like functions.
/*/
Components.utils.import( 'chrome://selite-misc/content/selite-misc.js' );
Components.utils.import('chrome://selite-db-objects/content/db.js');
Components.utils.import('chrome://selite-db-objects/content/basic-storage.js');
Components.utils.import('chrome://selite-db-objects/content/basic-objects.js');

function select( recordOrSet ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).select();
}
SeLiteData.select= select;

function selectOne( recordOrSet ) {
    return SeLiteData.recordOrSetHolder(recordOrSet).selectOne();
}
SeLiteData.selectOne= selectOne;

function insert( recordOrSet ) {
    return SeLteData.recordOrSetHolder(recordOrSet).insert();
}
SeLiteData.insert= insert;

function update( recordOrSet ) {
    SeLiteData.recordOrSetHolder(recordOrSet).update();
}
SeLiteData.update= update;

function markToRemove( record ) {
    SeLiteData.recordHolder(record).markToRemove();
}
SeLiteData.markToRemove= markToRemove;

//@TODO RecordSetHolder.put() - should it be instead of replace()?
function put( recordOrSet ) {
    SeLiteData.recordOrSetHolder(recordOrSet).put();
}
SeLiteData.put= put;

function remove( recordOrSet ) {
    SeLiteData.recordOrSetHolder(recordOrSet).remove();
}
SeLiteData.remove= remove;

function randomRecord( recordSet ) {
    var numRecords= SeLiteMisc.numberOfRecords( recordSet );
    return SeLiteMisc.nthRecord( recordSet, Math.round( Math.random()*(numRecords-1) ) );
}
SeLiteData.randomRecord= randomRecord;

var EXPORTED_SYMBOLS= [];