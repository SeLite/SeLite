/*  Copyright 2011, 2012, 2013 Peter Kehl
    This file is part of SeLite Db Objects.

    SeLite DB Objects is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite DB Objects is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite DB Objects.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

////This is a try without Javascript Class inheritance. If you need that, see
// https://developer.mozilla.org/en/JavaScript/Guide/Inheritance_Revisited and https://developer.mozilla.org/en/Introduction_to_Object-Oriented_JavaScript#Inheritance

/** @param object storage of class DbStorage
 *  @param string tableNamePrefix optional
 **/
function Db( storage, tableNamePrefix ) {
    this.storage= storage;
    this.tableNamePrefix= tableNamePrefix || '';
}

/** If prototype.noNamePrefix is set to true or 1, then it cancels effect of prototype.db.tableNamePrefix
 */
function DbTable( prototype ) {
    this.db= prototype.db;
    var prefix= prototype.noNamePrefix ? '' : this.db.tableNamePrefix;
    this.name= prefix+prototype.name;
    
    this.columns= prototype.columns; // Object{ of string colum name: true or object with more info}
    // where more info object { insert: string or function (optional field); update: string or function (optional field) }
    this.primary= prototype.primary || 'id';
}

function readOnlyPrimary( field ) {
    throw new Error( "This field '" +field+ "' is a primary key and therefore read-only." );
}

function readOnlyOriginal( field ) {
    throw new Error( "Original record is read-only, therefore this can't change field '" +field+ "'." );
}

function readOnlyJoined( field ) {
    throw new Error( "Field '" +field+ "' is from a joined record, therefore it can't be changed." );
}

/** Constructor of an object which represents a holder of one DB record.
 *  It allows us to have methods to manipulate the record, without a name conflict
 *  between names of those methods and fields of the record itself.
 *  I would like to use use Firefox JS Proxies https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
 *  -- try javascript:"use strict"; function MyProxy( target ) { Proxy.constructor.call(this, target, this ); } MyProxy.prototype.save= function() {}; var o=new MyProxy(); o.save()
 *  -- No need to set MyProxy.prototype.constructor to Proxy.constructor
 *  <br/>Keys (field names) in this.record and this.original (if set) are the aliased
 *  column names, as defined in the respective DbRecordSetFormula (and as retrieved from DB).
 *  See insert().
 *  @param mixed recordSetOrFormula DbRecordSetHolder recordSet, or DbRecordSetFormula formula. If it's a formula,
 *  then this.original won't be set, and you can modify the this.record. You probably
 *  want to pass a DbRecordSetFormula instance if you intend to use this DbRecordHolder with insert() only.
 *  @param object plainRecord Plain record from the result of the SELECT (using the column aliases, including any joined fields).
 *  Optional; if not present/null/empty object, then this.record will be set to an empty object
 *  (the passed one, if any; a new one otherwise) and its fields won't be checked by watch() - so you can
 *  set its fields later, and then use insert().
 *  DO NOT externally change existing .record field of DbRecordHolder instance after it was created,
 *  because this.record object won't be the same as plainRecord parameter passed here.
 *  this.record object links to a new DbRecordHolder instance.
 **/
function DbRecordHolder( recordSetOrFormula, plainRecord ) {
    if( recordSetOrFormula instanceof DbRecordSetFormula ) {
        this.recordSetHolder= new DbRecordSetHolder( recordSetOrFormula );
    }
    else
    if( recordSetOrFormula instanceof DbRecordSetHolder ) {
        this.recordSetHolder= recordSetOrFormula;
    }
    else {
        throw new Error("DbRecordHolder() expects the first parameter to be an instance of DbRecordSetHolder or DbRecordSetFormula." );
    }
    this.record= new DbRecord( this, plainRecord );
    if( recordSetOrFormula instanceof DbRecordSetFormula && Object.keys(this.record).length>0 ) {
        this.setOriginalAndWatchEntries();
    }
}

function dbNewRecord( recordSetOrFormula ) {
    var recordHolder= new DbRecordHolder(recordSetOrFormula);
    return recordHolder.record;
}

/*** Constructor used for data objects.
 *   @param object recordHolder of class DbRecordHolder
 *   @param mixed Object with the record's data, or null/false.
 **/
function DbRecord( recordHolder, data ) {
    // Set the link from record to its record holder. The field for this link is non-iterable.
    Object.defineProperty( this, DbRecord.RECORD_TO_HOLDER_FIELD, { value: recordHolder } );
    if( data ) {
        objectCopyFields( data, this );
    }
}

// This is configurable - if it ever gets in conflict with a field name in your DB table, change it here.
DbRecord.RECORD_TO_HOLDER_FIELD= 'RECORD_TO_HOLDER_FIELD';

/** @param DbRecord instance
 *  @return DbRecordHolder for that instance.
 **/
function dbRecordHolder( record ) {
    if( !(record instanceof DbRecord) ) {
        throw new Error( "Given parameter is not an instance of DbRecord." );
    }
    return record[DbRecord.RECORD_TO_HOLDER_FIELD];
}

DbRecordHolder.prototype.setOriginalAndWatchEntries= function() {
    this.original= {};
    
    var columnsToAliases= this.recordSetHolder.formula.columnsToAliases(this.recordSetHolder.formula.table.name);
    var columnAliases= objectValues( columnsToAliases, true );
    // this.original will store own columns only
    for( var field in columnAliases ) {
        this.original[field]= this.record[field];
        this.original.watch( field, readOnlyOriginal );
    }
    Object.seal( this.original ); // This has an effect only in strict mode

    // Don't allow change of joined columns:
    for( field in this.record ) {
        if( !(field in columnAliases) ) {
            this.record.watch( field, readOnlyJoined );
        }
    }
    // Don't allow change of primary key. That's because DbRecordSetHolder.originals are indexed by primary key.
    this.record.watch( this.recordSetHolder.formula.table.primary, readOnlyPrimary );
    Object.seal( this.record );
};

DbRecordHolder.prototype.select= function() { throw new Error( "@TODO. In the meantimes, use DbRecordSetHolder.select() or DbRecordSetFormula.select()."); }
DbRecordHolder.prototype.selectOne= function() { throw new Error( "@TODO. In the meantimes, use DbRecordSetHolder.selectOne() or DbRecordSetFormula.selectOne()."); }

// @TODO DbRecordHolder.insert() which is linked to an existing RecordSetHolder, and it adds itself to that recordSetHolder.
//       But then the recordSetHolder may not match its formula anymore - have a flag/handler for that.
/** This saves this.record into main table of the formula. As defined by DbRecordHolder() constructor,
 *  keys/field names in this.record are the column aliases. This re-maps them to the DB columns before inserting.
 *  @TODO set/modify this.originals.
 *  @return mixed value of the primary key
 **/
DbRecordHolder.prototype.insert= function() {
    // Fields set in formula's onInsert{} override any fields with the same name in this.records
    for( var field in this.recordSetHolder.formula.onInsert ) {
        var value= typeof this.recordSetHolder.formula.onInsert[field]==='function'
            ? this.recordSetHolder.formula.onInsert[field]()
            : this.recordSetHolder.formula.onInsert[field];
        this.record[ field ]= value;
    }
    var dbEntries= this.ownDbEntries();
    if( this.recordSetHolder.formula.generateInsertKey ) {// @TODO (low priority): || this.recordSetHolder.formula.table.generateInsertKey || this.recordSetHolder.formula.table.db.generateInsertKey
        dbEntries= objectsMerge( new Settable().set(
            this.recordSetHolder.formula.table.primary,
            new SqlExpression( "(SELECT MAX(" +this.recordSetHolder.formula.table.primary+ ") FROM " +this.recordSetHolder.formula.table.name+ ")+1")
        ), dbEntries );
    }
    this.recordSetHolder.storage().dbInsertRecord( {
        table: this.recordSetHolder.formula.table.name,
        entries: dbEntries,
        fieldsToProtect: [this.recordSetHolder.formula.table.primary],
        debugQuery: this.recordSetHolder.formula.debugQuery
    });
    var primaryKeyValue= this.recordSetHolder.storage().dbLastInsertId( this.recordSetHolder.formula.table.name, this.recordSetHolder.formula.table.primary );
    // This requires that the primary key is never aliased. @TODO use column alias, if present?
    this.record[ this.recordSetHolder.formula.table.primary ]= primaryKeyValue;
    return primaryKeyValue;
};

DbRecordHolder.prototype.ownDbEntries= function() {
    var allAliasesToSource= this.recordSetHolder.formula.allAliasesToSource();
    for( var field in this.record ) {
        if( !(field in allAliasesToSource) ) {
            throw new Error( "Trying to insert/update a record to table '" +this.recordSetHolder.formula.table.name+
                "' with field '" +field+ "' which is not a listed alias in this formula." );
        }
    }
    
    var columnsToAliases= this.recordSetHolder.formula.columnsToAliases(this.recordSetHolder.formula.table.name);
    var dbEntries= {};
    for( var field in columnsToAliases ) {
        // Some columns listed in the formula may have not be set (if using default values). Let's pass only the ones present.
        if( columnsToAliases[field] in this.record ) {
            dbEntries[ field ]= this.record[ columnsToAliases[field] ];
        }
    }
    return dbEntries;
};

DbRecordHolder.prototype.update= function() {
     // Fields set in formula's onUpdate{} override any fields with the same name in this.records
    for( var field in this.recordSetHolder.formula.onUpdate ) {
        var value= typeof this.recordSetHolder.formula.onUpdate[field]==='function'
            ? this.recordSetHolder.formula.onUpdate[field]()
            : this.recordSetHolder.formula.onUpdate[field];
        this.record[ field ]= value;
    }
    var dbEntries= this.ownDbEntries();
    this.recordSetHolder.storage().dbUpdateRecordByPrimary( {
        table: this.recordSetHolder.formula.table.name,
        primary: this.recordSetHolder.formula.table.primary,
        entries: dbEntries,
        debugQuery: this.recordSetHolder.formula.debugQuery
    });
    this.setOriginalAndWatchEntries();
};

/** @return null on update; id of the new record on insert; -1 on delete (DbRecordSetHolder depends on -1)
 **/
DbRecordHolder.prototype.put= function() {
    assert( !Object.isFrozen(this.record), "The record was frozen!" );
    if( this.markedToDelete ) {
        this.delete();
        return -1;
    }
    else
    // Insert or update the record, depending on whether its primary key is set (it can be set to 0)
    // @return primary key value, but only when it run an insert
    if( typeof this.record[this.recordSetHolder.formula.table.primary]!=='undefined' ) {
        // @TODO compare to this.original
        this.update();
        return null;
    }
    else {
        return this.insert();
    }
};

DbRecordHolder.prototype.markToDelete= function() {
    this.markedToDelete= true;
    this.recordSetHolder.markedToDelete[ this.record[this.recordSetHolder.formula.table.primary] ]= this;
    Object.freeze( this.record );
};

DbRecordHolder.prototype.delete= function() {
    this.recordSetHolder.storage().dbDeleteRecordByPrimary( this.recordSetHolder.formulate.table.name, this.recordSetHolder.formulate.table.primary,
        this.record[ this.recordSetHolder.formulate.table.primary] );
};

/** Constructor of formula objects.
 *  @param object params Object serving as an associative array; optional; see in-code description.
 *  @param object prototype Optional; instance of DbRecordSetFormula which serves as the prototype for the new object.
 *  Any fields not set in params will be inherited from prototype (if present), as they are at the time of calling this constructor.
 *  Any fields set in params will override respective fields in prototype (if any),
 *  except for field(s) present in params and set to null - then values will be copied from prototype, (if present).
 **/
function DbRecordSetFormula( params, prototype ) {
    PrototypedObject.call( this, prototype );
    params= params ? params : {};
    objectClone( params, ['table', 'alias', 'columns', 'joins', 'fetchCondition', 'fetchMatching', 'parameterNames', 'sort',
            'sortDirection', 'indexBy', 'indexUnique', 'subIndexBy', 'process', 'debugQuery', 'debugResult', 'generateInsertKey',
            'onInsert', 'onUpdate' ],
        null, this );

    if( !(this.joins instanceof Array) ) {
        throw new Error( "Parameter's field .joins must be an array (of objects)." );
    }

    // The following doesn't apply to indexing of DbRecordSetHolder.originals.
    if( this.table && this.table.primary ) {
        if( typeof this.indexBy==='undefined' ) {
            this.indexBy= this.table.primary;
        }
        if( typeof this.indexUnique==='undefined' ) {
            this.indexUnique= this.indexBy==this.table.primary;
        }
    }
    if( this.indexUnique && this.subIndexBy ) {
        throw new Error( "Can't use both indexUnique and subIndexBy. indexUnique may be implied if indexing by this.table.primary (as by sdefault)." );
    }
    // @TODO check that all own table columns' aliases are unique: Object.keys( objectReverse( ownColumns() ) )
    // @TODO similar check for joined columns?
}
DbRecordSetFormula.prototype.constructor= DbRecordSetFormula;
DbRecordSetFormula.ALL_FIELDS= ["ALL_FIELDS"]; // I compare this using ==, so by making this an array we allow user column alias prefix 'ALL_FIELDS' if need be

    // Object { table-name: columns-alias-info } where columns-alias-info is of mixed-type:
    //   string column alias prefix (it will be prepended in front of all column names); or
    //   DbRecordSetFormula.ALL_FIELDS (all fields listed in the table object will be selected, unaliased); or
    //   an alias map object listing all columns that are to be selected, mapped to string alias, or mapped to true/1 if not aliased; or
    //   an array, listing one or more of the following
    //   - all unaliased columns
    //   - optional object(s) which is an alias map {string colum name: string alias}; such a map must map to string alias (it must not map to true/1)
    //   - optional DbRecordSetFormula.ALL_FIELDS indicating usage of all columns under their names (unaliased), unless any map object(s) map them
    // Any aliases must be unique; that will be checked by DbRecordSetFormula constructor. ---@TODO
    // The column list must list the primary key of the main table, and it must not be aliased. Their values must exist
    // - i.e. you can't have a join that selects records from join table(s) for which there is no record in the main table.
    // That's because DbRecordSetHolder.originals{} are indexed by it.
DbRecordSetFormula.prototype.alias= null;

DbRecordSetFormula.prototype.columns= {};

/** Just like the same field passed to storage.dbGetRecords(). I.e. Array of objects {
    table: table object;
       alias: string alias (optional);
       type: string type 'INNER LEFT' etc.; optional
       on: string join condition
    }
*/
DbRecordSetFormula.prototype.joins= [];

DbRecordSetFormula.prototype.fetchCondition= null; // String SQL condition
// fetchMatching contains the values unescaped and unqoted; they will be escaped and quoted as needed.
// Each value must represent SQL constant (string or non-string), or a function returning such value.
// String values will be quoted, so they can't be SQL expressions. Javascript null value won't be quoted
// and it will generate an IS NULL statement; other values will generate = comparison.
// If matching-value is a function, it will be called at the time the data is to be fetched from DB.
// Use a function e.g. to return a value of global variable which changes in runtime (not a good practice in general).
DbRecordSetFormula.prototype.fetchMatching= {};

// Names of any parameters.
// They will be escaped & quoted as appropriate and they will replace occurrances of their placeholders :<parameter-name>.
// The placeholders can be used in joins[i].on and in fetchCondition, fetchMatching, putCondition, putMatching.
DbRecordSetFormula.prototype.parameterNames= [];
DbRecordSetFormula.prototype.sort= null;
DbRecordSetFormula.prototype.sortDirection= 'ASC';
DbRecordSetFormula.prototype.subIndexBy= null;

/** A function which will be called after fetching and indexing the records. Its two parameters will be
 *  records (DbRecordSet) and DbRecordSetHolder's bind parameters (if any). It should return DbRecordSet instance (either the same one, or a new one).
 **/
DbRecordSetFormula.prototype.process= null;
DbRecordSetFormula.prototype.debugQuery= false;
DbRecordSetFormula.prototype.debugResult= false;

DbRecordSetFormula.prototype.generateInsertKey= true; // @TODO make this default value null, and use something stored in connection/DB object
DbRecordSetFormula.prototype.onInsert= {}; // aliasedFieldName: string value or function; used on insert; it overrides any existing value for that field
DbRecordSetFormula.prototype.onUpdate= {}; // aliasedFieldName: string value or function; used on update; it overrides any existing value for that field

DbRecordSetFormula.prototype.tableByName= function( tableName ) {
    if( this.table.name===tableName ) {
        return this.table;
    }
    for( var join in this.joins ) {
        if( join.table.name===tableName ) {
            return join.table;
        }
    }
    return null;
}

/** @return object { string given table's column name: string column alias or the same column name (if no alias) }.
 *  That differs from definition field columns passed to DbRecordSetFormula() constructor, which allows
 *  unaliased column names to be mapped to true/1. Here such columns get mapped to themselves (to the column names);
 *  that makes it easy to use with objectValues() or objectReverse().
 **/
DbRecordSetFormula.prototype.columnsToAliases= function( tableName ) {
    var columnsDefinition= this.columns[ tableName ];
    var result= {};

    var listingAllColumns= columnsDefinition===DbRecordSetFormula.ALL_FIELDS ||
        typeof columnsDefinition==="array" && columnsDefinition.indexOf(DbRecordSetFormula.ALL_FIELDS)>=0;
    if( listingAllColumns ) {
        var allColumns= this.tableByName(tableName).columns;
        for( var i=0; i<allColumns.length; i++ ) {
            result[ allColumns[i] ]= allColumns[i];
        }
    }
    if( columnsDefinition!==DbRecordSetFormula.ALL_FIELDS ) {
        if( columnsDefinition instanceof Array ) {
            for( var j=0; j<columnsDefinition.length; j++ ) {
                var columnOrMap= columnsDefinition[j];
                if( typeof columnOrMap ==='string' ) {
                    result[ columnOrMap ]= columnOrMap;
                }
                else
                if( typeof columnOrMap ==='object' && columnOrMap!==DbRecordSetFormula.ALL_FIELDS ) {
                    for( var column in columnOrMap ) {
                        result[ column ]= columnOrMap[column];
                    }
                }
            }
        }
        else {
            for( var column in columnsDefinition ) {
                var alias= columnsDefinition[column];
                if( typeof alias!=='string' ) {
                    if( !alias ) { // only accept true/1
                        continue;
                    }
                    alias= column; // no specific alias, so map the column to itself
                }
                result[ column ]= alias;
            }
        }
    }
   return result;
};

/** A bit like columnsToAliases(), but this returns the aliases for all columns used by
 *  the formula (from all its tables), each mapped to an object containing the table and the (unaliased) column name.
 *  @return { string column-alias: {table: table object, column: column-name}, ... }
 **/
DbRecordSetFormula.prototype.allAliasesToSource= function() {
    // @TODO update tableByName() to be similar to this, reuse:
    var tableNamesToTables= new Settable().set( this.table.name, this.table );
    this.joins.forEach( function(join) {
        tableNamesToTables[ join.table.name ]= join.table;
    } );

    var result= {};
    for( var tableName in tableNamesToTables ) {
        var columnsToAliases= this.columnsToAliases( tableName );
        for( var column in columnsToAliases ) {
            result[ columnsToAliases[column] ]= {
                table: tableNamesToTables[tableName],
                column: column
            };
        }
    }
    return result;
};

/** This returns the DbRecordSet object, i.e. the records themselves.
 *  @see DbRecordSetHolder.select().
 **/
DbRecordSetFormula.prototype.select= function( parametersOrCondition ) {
    return new DbRecordSetHolder(this, parametersOrCondition ).select();
};

/** This returns the DbRecord object, i.e. the record itself.
 *  @see DbRecordSetHolder.selectOne()
 **/
DbRecordSetFormula.prototype.selectOne= function( parametersOrCondition ) {
    return new DbRecordSetHolder(this, parametersOrCondition ).selectOne();
};

/** Used to generate object parts of 'columns' part of the parameter to DbRecordSetFormula() constructor, if your table names are not constants,
    i.e. you have a configurable table prefix string, and you don't want to have a string variable for each table name itself, but you want
    to refer to .name property of the table object. Then your table name is not string constant, and you can't use string runtime expressions
    as object keys in anonymous object construction {}. That's when you can use new Settable().set( tableXYZ.name, ...).set( tablePQR.name, ...)
    as the value of 'columns' field of DbRecordSetFormula()'s parameter.
    Its usage assumes that no table name (and no value for parameter field) is 'set'.
*/
function Settable() {
    if( arguments.length>0 ) {
        throw new Error( "Constructor Settable() doesn't use any parameters." );
    }
}
// I don't want method set() to show up when iterating using for( .. in..), therefore I use defineProperty():
Object.defineProperty( Settable.prototype, 'set', {
        value: function( field, value ) {
            this[field]= value;
            return this;
        }
} );

/** Constructor used for data record sets.
 *  @param object recordSetHolder of class DbRecordSetHolder
 **/
function DbRecordSet( recordSetHolder ) {
    // Set the link from record to its record holder. The field for this link is non-iterable.
    Object.defineProperty( this, DbRecordSet.RECORDSET_TO_HOLDER_FIELD, { value: recordSetHolder } );
}
// This is configurable - if it ever gets in conflict with an index key in your DB table, change it here.
DbRecordSet.RECORDSET_TO_HOLDER_FIELD= 'RECORDSET_TO_HOLDER_FIELD';

/** @param DbRecordSet instance
 *  @return DbRecordSetHolder for that instance.
 **/
function dbRecordSetHolder( recordSet ) {
    if( !(recordSet instanceof DbRecordSet) ) {
        throw new Error( "Given parameter is not an instance of DbRecordSet." );
    }
    return recordSet[DbRecordSet.RECORDSET_TO_HOLDER_FIELD];
}

function dbRecordOrSetHolder( recordOrSet ) {
    if( recordOrSet instanceof DbRecord ) {
        return dbRecordHolder(recordOrSet);
    }
    else
    if( recordOrSet instanceof DbRecordSet ) {
        return dbRecordSetHolder(recordOrSet);
    }
    else {
        throw new Error( "Parameter recordOrSet must be an instance of DbRecord or DbRecordSet, but it's:\n" +objectToString(recordOrSet, 3) );
    }
}

function dbSelect( recordOrSet ) {
    return dbRecordOrSetHolder(recordOrSet).select();
}

function dbSelectOne( recordOrSet ) {
    return dbRecordOrSetHolder(recordOrSet).selectOne();
}

function dbInsert( recordOrSet ) {
    return dbRecordOrSetHolder(recordOrSet).insert();
}

function dbUpdate( recordOrSet ) {
    dbRecordOrSetHolder(recordOrSet).update();
}

function dbMarkToDelete( record ) {
    dbRecordHolder(record).markToDelete();
}

//@TODO DbRecordSetHolder.put() - should it be instead of replace()?
function dbPut( recordOrSet ) {
    dbRecordOrSetHolder(recordOrSet).put();
}

function dbDelete( recordOrSet ) {
    dbRecordOrSetHolder(recordOrSet).delete();
}
/*
function dbRecordSetReplace( recordSet ) {
    return dbRecordSetHolder(recordSet).replace();
}*/

/** @param mixed recordSetOrArray An array of the target records; or a DbRecordSet instance,
 *  or some other object serving as an associative array,
 *  potentially a result of collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of DbRecord - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @param int position 0-based position of the value to return
 *  @return object the leaf record
 *  @throws Exception if position is negative, decimal or higher than the last available position
 **/
function nthRecord( recordSetOrArray, position ) {
    if( position<0 ) {
        throw new Error( "nthRecord() requires non-negative position, but it was: " +position);
    }
    return nthRecordOrLengthOrPositionOf( recordSetOrArray, position );
}

/** @param mixed recordSetOrArray An array of the target records; or a DbRecordSet instance,
 *  or some other object serving as an associative array,
 *  potentially a result of collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of DbRecord - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @int number of leaf records
 */
function numberOfRecords( recordSetOrArray ) {
    return nthRecordOrLengthOrPositionOf( recordSetOrArray, -1 );
}

/** @param mixed recordSetOrArray An array of the target records; or a DbRecordSet instance,
 *  or some other object serving as an associative array,
 *  potentially a result of collectByColumn(), even if it used sub-indexing
 *  (but then the records must be instances of DbRecord - which is so by default;
 *  otherwise the subindexed groups (objects serving as associative arrays) couldn't be differentiated from target objects/records).
 *  @param record object, record to search for.
 *  @return int 0-based index of that record if found,-1 otherwise.
 */
function indexOfRecord( recordSetOrArray, record ) {
    return nthRecordOrLengthOrPositionOf( recordSetOrArray, record );
}

/** @private Implementation of nthRecord() and numberOfRecords()
 *  @param mixed recordSetOrArray just like the same parameter in nthRecord() and numberOfRecords()
 *  @param mixed positionOrRecord Either
 *  -- int like the same parameter in nthRecord(). Extension: If it's negative here, then
 *     this returns number of leaf objects, rather the object at this position. Or
 *  -- object, record to search for. Then this function returns 0-based index of that record if found,-1 otherwise.
 **/
function nthRecordOrLengthOrPositionOf( recordSetOrArray, positionOrRecord ) {
    //var returnRecordOrLength= typeof returnBypositionOrRecord==='number';
    var searchByRecord= typeof returnBypositionOrRecord==='object';
    if( !searchByRecord && positionOrRecord!=Math.round(positionOrRecord) ) {
        throw new Error( "nthRecordOrLengthOrPositionOf() requires non-decimal position, but it was: " +position);
    }
    var returnRecord= !searchByRecord && positionOrRecord>=0;
    if( recordSetOrArray instanceof Array ) {
        if( searchByRecord ) {
            return recordSetOrArray.indexOf( positionOrRecord );
        }
        if( !returnRecord ) {
            return recordSetOrArray.length;
        }
        if( positionOrRecord<recordSetOrArray.length ) {
            return recordSetOrArray[positionOrRecord];
        }
        throw new Error( 'nthRecord(): There is no item at position ' +positionOrRecord+
            ' (starting from 0). The highest position is ' +recordSetOrArray.length-1 );
    }
    var currPosition= 0;
    for( var index in recordSetOrArray ) {
        var entry= recordSetOrArray[index];
        if( entry instanceof DbRecord ) { //@TODO Do this the other way - !(instanceof SPECIAL-CLASS). Then move it to shared.js. Use that special class in collectByColumn() as a constructor of THE SUBINDEXED GROUPS
            if( /*searchByRecord &&*/ entry===positionOrRecord ) {
                return currPosition;
            }
            if( currPosition===positionOrRecord ) {
                return entry;
            }
            currPosition++;
        }
        else
        if( entry instanceof Array ) {
            if( searchByRecord ) {
                var foundSubPosition= recordSetOrArray.indexOf( positionOrRecord );
                if( foundSubPosition>=0 ) {
                    return currPosition+foundSubPosition;
                }
            }
            else
            if( returnRecord && positionOrRecord-currPosition <entry.length ) {
                return entry[ positionOrRecord-currPosition ];
            }
            currPosition+= entry.length;
        }
        else {
            for( var subindex in entry ) {
                if( /*searchByRecord && */entry[subindex]==positionOrRecord ) {
                    return currPosition;
                }
                if( currPosition==positionOrRecord ) {
                    return entry[subindex];
                }
                currPosition++;
            }
        }
    }
    if( searchByRecord ) {
        return -1;
    }
    else
    if( !returnRecord ) {
        return currPosition;
    }
    else {
        throw new Error( 'nthRecord(): There is no item at position ' +positionOrRecord+
            ' (starting from 0). The highest position is ' +currPosition );
    }
}

function randomRecord( recordSetOrArray ) {
    var numRecords= numberOfRecords( recordSetOrArray );
    return nthRecord( recordSetOrArray, Math.round( Math.random()*(numRecords-1) ) );
}

/** @param object formula instance of DbRecordSetFormula
 *  @param mixed parametersOrCondition Any parameter values whose typeof is not 'string' or 'number'
 *  will passed to formula's process() function (if set), but it won't be passed
 *  as a binding parameter (it won't apply to any parameters in condition/fetchMatching/join).
 *  Any values with typeof 'number' will be transformed into strings.
 *  That's because SQLite only allows binding values with typeof 'string'.
 **/
function DbRecordSetHolder( formula, parametersOrCondition ) {
    this.formula= formula;
    this.parametersOrCondition= parametersOrCondition || {};
    this.holders= {}; // Object serving as an associative array { primary key value: DbRecordHolder instance }
    this.records= new DbRecordSet();
    this.originals= {}; // This will be set to object { primary-key-value: original object... }
    this.markedToDelete= {}; // It keeps DbRecordHolder instances scheduled to be deleted; structure like this.holders
}

DbRecordSetHolder.prototype.storage= function() {
    return this.formula.table.db.storage;
};

DbRecordSetHolder.prototype.select= function() {
    objectDeleteFields( this.records );
    var formula= this.formula;
    
    var columns= {};
    // @TODO potentially use allAliasesToSource() to simplify the following
    for( var tableName in formula.columns ) {
        var columnsToAliases= formula.columnsToAliases( tableName );
        if( tableName==formula.table.name ) {
            var tableAlias= formula.alias;
        }
        else {
            for( var i=0; i<formula.joins.length; i++ ) {//@TODO if I need to do something similar again, extend objectValueToField() to accept a callback function
                var join= formula.joins[i];
                if( join.table.name==tableName ) {
                    break;
                }
            }
            if( i==formula.joins.length ) {
                throw new Error( "Formula defined columns for table '" +tableName+ "' but it's not the main table neither a join table." );
            }
            var tableAlias= join.alias;
        }
        if( !tableAlias ) {
            tableAlias= tableName;
        }
        var columnAliases= {};
        for( var column in columnsToAliases ) {
            columnAliases[ tableAlias+ '.' +column ]= columnsToAliases[column]!==column
                ? columnsToAliases[column]
                : true;
        }
        columns= objectsMerge( columns, columnAliases );
    }

    var matching= {};
    for( var field in formula.fetchMatching ) {
        var matchingValue= typeof formula.fetchMatching[field]==='function'
            ? formula.fetchMatching[field]()
            : formula.fetchMatching[field];
        matching[field]= matchingValue;
    }
    var usingParameterCondition= typeof this.parametersOrCondition==='string';
    if( !usingParameterCondition ) {
        for( var paramName in usingParameterCondition ) {
            if( formula.parameterNames.indexOf(paramName)<0 ) {
                throw new Error( "Unlisted query parameter with name '" +paramName+ "' and value: " +usingParameterCondition[paramName] );
            }
        }
        //alert( "Bindings: " +objectToString(this.parametersOrCondition, 4) );
    }
    var joins= [];
    formula.joins.forEach( function(join) {
        var joinClone= objectClone(join);
        joinClone.table= join.table.name;
        joins.push( joinClone );
    } );
    var condition= usingParameterCondition ? this.parametersOrCondition : null;
    var parameters= !usingParameterCondition ? objectClone(this.parametersOrCondition) : {};
    var parametersForProcessHandler= !usingParameterCondition ? this.parametersOrCondition : {};
    for( var param in parameters ) {
        if( typeof parameters[param]==='number' ) {
            parameters[param]= ''+parameters[param];
        }
        else
        if( typeof parameters[param]!=='string') {
            delete parameters[param];
        }
    }

    var data= this.storage().dbGetRecords( {
        table: formula.table.name+ (formula.alias ? ' ' +formula.alias : ''),
        joins: joins,
        columns: columns,
        matching: matching,
        condition: this.storage().sqlAnd( formula.fetchCondition, condition ),
        parameters: parameters,
        parameterNames: formula.parameterNames,
        sort: formula.sort,
        sortDirection: formula.sortDirection,
        debugQuery: formula.debugQuery,
        debugResult: formula.debugResult
    } );

    var unindexedRecords= [];
    this.originals= {};
    for( var j=0; j<data.length; j++ ) {
        var holder= new DbRecordHolder( this, data[j] );
        this.holders[ holder.record[formula.table.primary] ]= holder;
        unindexedRecords.push( holder.record );
        this.originals[ holder.record[ formula.table.primary] ]= holder.original;
    }
    collectByColumn( unindexedRecords, formula.indexBy, formula.indexUnique, formula.subIndexBy, this.records );
    if( formula.process ) {
        this.records= formula.process( this.records, parametersForProcessHandler );
    }
    return this.records;
};

/** This runs the query just like select(). Then it checks whether there was exactl 1 result row.
 *  If yes, it returns that row (DbRecord object). Otherwise it throws an exception.
 **/
DbRecordSetHolder.prototype.selectOne= function() {
    this.select();
    var keys= Object.keys(this.records);
    if( keys.length!==1 ) {
        throw new Error( "Expecting one record, but there was: " +keys.length+ " of them." );
    }
    return this.records[ keys[0] ];
};

DbRecordSetHolder.prototype.insert= function() { throw new Error( "@TODO if need be" );
}

DbRecordSetHolder.prototype.update= function() { throw new Error( "@TODO if need be" );
};

/** This removes the record holder and its record from this set holder and its set. It doesn't
 *  delete the actual DB record.
 **/
DbRecordSetHolder.prototype.removeRecordHolder= function( recordHolder ) {
    var primaryKeyValue= recordHolder.record[this.formula.table.primary];
    delete this.holders[ primaryKeyValue ];
    delete this.records[ indexOfRecord(this.records, recordHolder.record) ];
    delete this.originals[ primaryKeyValue ];
    delete this.markedToDelete[ primaryKeyValue ];
};

DbRecordSetHolder.prototype.put= function() {
    for( var i=0; i<this.holders.length; i++ ) {
        var recordHolder= this.holders[i];
        var recordResult= recordHolder.put();
        if( recordResult==-1 ) {
            this.removeRecordHolder( recordHolder );
            i--; // Because this.holders[] etc. was updated
        }
    }
};

DbRecordSetHolder.prototype.delete= function() { throw "TODO";
};

DbRecordSetHolder.prototype.replace= function() {throw 'todo';
};

var EXPORTED_SYMBOLS= [];