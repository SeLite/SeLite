"use strict";

// Following import() calls load SeLiteData into Selenium Core scope, so that it can be used by Selenese
Components.utils.import( "chrome://selite-db-objects/content/db.js" );
Components.utils.import( "chrome://selite-db-objects/content/basic-storage.js" );
Components.utils.import( "chrome://selite-db-objects/content/basic-objects.js" );
Components.utils.import( "chrome://selite-db-objects/content/basic-functions.js" );

/** Subject to change
 * @param info Object containing
 * - table or formula - pass exactly one of them
 * - zero, one or several matching pairs - column: value
 */
Selenium.prototype.getRecord= function( info, unused ) {
    /** @type {SeLiteData.Table} */ var table;
    /** @type SeLiteData.RecordSetFormula*/var formula;
    if( table in info ) {
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
    /**@type {object}*/var matchingPairs= SeLiteMisc.objectClone(info, table.columns );
    delete matchingPairs.info;
    delete matchingPairs.formula;
    // Following check depends on requirement that only one of info.table or info.formula is present
    Object.keys(matchingPairs).length===Object.keys(info).length-1 || SeLiteMisc.fail( 'There are some field(s) in info.matchingPairs that are not present in table/formula definition.' );

    var records= formula.select( matchingPairs );
    LOG.debug( 'getRecords: ' +records );
    var numRecords= Object.keys(records).length;
    numRecords===0 || numRecords===1 || SeLiteMisc.fail();
    for( var id in numRecords ) { // Return the only record, if any:
        return numRecords[id];
    }
    return null;
};

//@param recordObject anonymous object
//@param table SeLiteData.Table instance for the table to insert to.
Selenium.prototype.doInsertRecord= function( recordObject, table) {
    var record= new SeLiteData.Record(recordObject);
    table.insert(record);
};