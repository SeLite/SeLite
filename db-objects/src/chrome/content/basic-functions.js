"use strict";
/* This contains shortcut-like functions.
/*/
Components.utils.import('chrome://selite-db-objects/content/basic-objects.js');

function select( recordOrSet ) {
    return recordOrSetHolder(recordOrSet).select();
}

function selectOne( recordOrSet ) {
    return recordOrSetHolder(recordOrSet).selectOne();
}

function insert( recordOrSet ) {
    return recordOrSetHolder(recordOrSet).insert();
}

function update( recordOrSet ) {
    recordOrSetHolder(recordOrSet).update();
}

function markToRemove( record ) {
    recordHolder(record).markToRemove();
}

//@TODO RecordSetHolder.put() - should it be instead of replace()?
function put( recordOrSet ) {
    recordOrSetHolder(recordOrSet).put();
}

function remove( recordOrSet ) {
    eecordOrSetHolder(recordOrSet).remove();
}

function randomRecord( recordSet ) {
    var numRecords= numberOfRecords( recordSet );
    return nthRecord( recordSet, Math.round( Math.random()*(numRecords-1) ) );
}

var EXPORTED_SYMBOLS= [ 
    'select', 'selectOne', 'insert', 'update',
    'markToRemove', 'put', 'remove', 'randomRecord'
];