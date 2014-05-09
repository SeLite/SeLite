"use strict";

Components.utils.import( "chrome://selite-db-objects/content/Db.js" ); // this loads 'SeLiteData' object into Selenium Core scope, so that it can be used by Selenese
Components.utils.import( "chrome://selite-db-objects/content/DbStorage.js" );
Components.utils.import( "chrome://selite-db-objects/content/DbObjects.js" );
Components.utils.import( "chrome://selite-db-objects/content/DbFunctions.js" );

Selenium.prototype.doReadRecord= function doReadRecord( info, storedVariableName ) {
    /** @type {SeLiteData.Table} */ var table;
    /** @type SeLiteData.RecordSetFormula*/var formula;
    LOG.debug( 'getRecord info: ' +typeof info+ ': ' +SeLiteMisc.objectToString(info, 2));
    if( 'table' in info ) {
        table= info.table;
        table instanceof SeLiteData.Table || SeLiteMisc.fail( 'info.table must be an instance of SeLiteData.Table');
        formula= new SeLiteData.RecordSetFormula( {
            table: table,
            columns: new SeLiteData.Settable().set( table, SeLiteData.RecordSetFormula.ALL_FIELDS )
        });
    }
    else if( 'formula' in info ) {
        formula= info.formula;
        formula instanceof SeLiteData.RecordSetFormula || SeLiteMisc.fail( 'info.formula must be an instance of SeLiteData.RecordSetFormula');
        table= formula.table;
    }
    else {
        SeLiteMisc.fail('getRecord() expects info.table or info.formula to be present.');
    }
    storedVariableName= storedVariableName || info.store;
    typeof storedVariableName==='string' || SeLiteMisc.fail( 'You must provide storedVariableName or info.store, a string name of the stored variable to load the record into.' );
    /**@type {object}*/var matchingPairs= SeLiteMisc.objectClone(info, table.columns );
    delete matchingPairs.info;
    delete matchingPairs.formula;
    // Following check depends on requirement that only one of info.table or info.formula is present
    Object.keys(matchingPairs).length===Object.keys(info).length-1 || SeLiteMisc.fail( 'There are some field(s) in info.matchingPairs that are not present in table/formula definition.' );

    var records= formula.select( matchingPairs );
    LOG.debug( 'getRecords: ' +records );
    var record= null;
    for( var key in records ) { // Return the only record, if any:
        if( record!==null ) {
            SeLiteMisc.fail( 'There is more than one record.' );
        }
        record= records[key];
    }
    LOG.debug( 'record: ' +SeLiteMisc.objectToString(record, 2) );
    storedVars[storedVariableName]= record;
};

/** @param {object} recordObject
 *  @param {SeLiteData.Table} table
 * */
Selenium.prototype.doInsertRecord= function doInsertRecord( recordObject, table) {
    var record= new SeLiteData.Record(recordObject);
    //@TODO If we use generateInsertKey() with table - like formula.generateInsertKey() - then use it and store the generated key here
    table.insert(record);
    if( typeof table.primary==='string' ) {
        recordObject[ table.primary ]= storedVars.insertedRecordKey= table.db.storage.lastInsertedRow( table.nameWithPrefix(), [table.primary] )[ table.primary ];
    }
};