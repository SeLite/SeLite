/*  Copyright 2011, 2012, 2013, 2014 Peter Kehl
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

Components.utils.import( 'chrome://selite-misc/content/selite-misc.js' );
Components.utils.import('chrome://selite-db-objects/content/basic-storage.js');
Components.utils.import('chrome://selite-db-objects/content/db.js');

/** @constructor
 *  @param {SeLiteData.Storage} storage Underlying lower-level storage object.
 *  @param string tableNamePrefix optional
 **/
SeLiteData.Db= function( storage, tableNamePrefix ) {
    this.storage= storage;
    this.tableNamePrefix= tableNamePrefix || '';
};

/** @constructor
 *  @param {Object} prototype Anonymous object {
 *      db: SeLiteData.Db instance,
 *      noNamePrefix: boolean, optional; if true, then it cancels effect of prototype.db.tableNamePrefix (if set),
 *      name: string table name,
 *      columns: array of string column names,
 *      primary: string primary key name, optional - 'id' by default
 */
SeLiteData.Table= function( prototype ) {
    this.db= prototype.db;
    var prefix= prototype.noNamePrefix ? '' : this.db.tableNamePrefix;
    this.name= prefix+prototype.name;
    
    this.columns= prototype.columns;
    this.primary= prototype.primary || 'id';
};

/** @private Not used directly outside of this file */
function readOnlyPrimary( field ) {
    throw new Error( "This field '" +field+ "' is a primary key and therefore read-only." );
}

/** @private Not used directly outside of this file */
function readOnlyOriginal( field ) {
    throw new Error( "Original record is read-only, therefore this can't change field '" +field+ "'." );
}

/** @private Not used directly outside of this file */
function readOnlyJoined( field ) {
    throw new Error( "Field '" +field+ "' is from a joined record, therefore it can't be changed." );
}

/** Constructor of an object which represents a holder of one DB record.
 *  It allows us to have methods to manipulate the record, without a name conflict
 *  between names of those methods and fields of the record itself.
 *  <br/>Keys (field names) in this.record and this.original (if set) are the aliased
 *  column names, as defined in the respective SeLiteData.RecordSetFormula (and as retrieved from DB).
 *  See insert().
 *  @private Not used directly outside of this file.
 *  @param object recordSetHolderOrFormula An instance of either SeLiteData.RecordSetHolder, or of SeLiteData.RecordSetFormula. If it's a formula,
 *  then this.original won't be set, and you can modify this.record. You probably
 *  want to pass a SeLiteData.RecordSetFormula instance if you intend to use this RecordHolder with insert() only.
 *  @param object plainRecord Plain record from the result of the SELECT (using the column aliases, including any joined fields).
 *  Optional; if not present/null/empty object, then this.record will be set to an empty object
 *  (the passed one, if any; a new one otherwise) and its fields won't be checked by watch() - so you can
 *  set its fields later, and then use insert().
 *  DO NOT externally change existing .record field of RecordHolder instance after it was created,
 *  because this.record object won't be the same as plainRecord parameter passed here.
 *  this.record object links to a new SeLiteData.Record instance.
 **/
function RecordHolder( recordSetHolderOrFormula, plainRecord ) {
 /*  I would like to use use Firefox JS Proxies https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
 *  -- try javascript:"use strict"; function MyProxy( target ) { Proxy.constructor.call(this, target, this ); } MyProxy.prototype.save= function() {}; var o=new MyProxy(); o.save()
 *  -- No need to set MyProxy.prototype.constructor to Proxy.constructor*/
    if( recordSetHolderOrFormula instanceof SeLiteData.RecordSetFormula ) {
        this.recordSetHolder= new RecordSetHolder( recordSetHolderOrFormula );
    }
    else
    if( recordSetHolderOrFormula instanceof RecordSetHolder ) {
        this.recordSetHolder= recordSetHolderOrFormula;
    }
    else {
        throw new Error("RecordHolder() expects the first parameter to be an instance of RecordSetHolder or SeLiteData.RecordSetFormula." );
    }
    this.record= new SeLiteData.Record( this, plainRecord );
    if( recordSetHolderOrFormula instanceof SeLiteData.RecordSetFormula && Object.keys(this.record).length>0 ) {
        this.setOriginalAndWatchEntries();
    }
}

/*** Constructor used for object that represents a record in a DB.
 *   @param {Object} recordHolder of private class RecordHolder
 *   @param {?Object|boolean} Object with the record's data, or null/false.
 **/
SeLiteData.Record= function( recordHolder, data ) {
    // Set the link from record to its record holder. The field for this link is non-iterable.
    Object.defineProperty( this, SeLiteData.Record.RECORD_TO_HOLDER_FIELD, { value: recordHolder } );
    if( data ) {
        SeLiteMisc.objectCopyFields( data, this );
    }
};

/** This is a name of Javascript field, used in instances of SeLiteData.Record,
    for which the field value is an instance of private class RecordHolder.
    If this string ever gets in conflict with a field name in your DB table, change it here.
    @private
*/
SeLiteData.Record.RECORD_TO_HOLDER_FIELD= 'RECORD_TO_HOLDER_FIELD';

SeLiteData.Record.prototype.toString= function() { //@TODO Move to SeLiteMisc; then assign here
    var result= '';
    for( var field in this ) {
        if( typeof this[field]!=='function' ) {
            if( result ) {
                result+= '\n';
            }
            result+= field+ ': ' +this[field];
        }
    }
    return result;
};

/** @private Not a part of public API.
 *  @param SeLiteData.Record instance
 *  @return RecordHolder for that instance.
 **/
SeLiteData.recordHolder= function( record ) {
    SeLiteMisc.ensureInstance( record, SeLiteData.Record, 'SeLiteData.Record' );
    return record[SeLiteData.Record.RECORD_TO_HOLDER_FIELD];
}

RecordHolder.prototype.setOriginalAndWatchEntries= function() {
    this.original= {};
    
    var columnsToAliases= this.recordSetHolder.formula.columnsToAliases(this.recordSetHolder.formula.table.name);
    var columnAliases= SeLiteMisc.objectValues( columnsToAliases, true );
    // this.original will store own columns only
    for( var field in columnAliases ) {
        this.original[field]= this.record[field];
        this.original.watch( field, readOnlyOriginal );
    }
    Object.seal( this.original ); // This has effect only in strict mode

    // Don't allow change of joined columns:
    for( field in this.record ) {
        if( !(field in columnAliases) ) {
            this.record.watch( field, readOnlyJoined );
        }
    }
    // Don't allow change of primary key. That's because RecordSetHolder.originals are indexed by primary key.
    this.record.watch( this.recordSetHolder.formula.table.primary, readOnlyPrimary );
    Object.seal( this.record );
};

RecordHolder.prototype.select= function() { throw new Error( "@TODO. In the meantimes, use RecordSetHolder.select() or SeLiteData.RecordSetFormula.select()."); }
RecordHolder.prototype.selectOne= function() { throw new Error( "@TODO. In the meantimes, use RecordSetHolder.selectOne() or SeLiteData.RecordSetFormula.selectOne()."); }

// @TODO RecordHolder.insert() which is linked to an existing RecordSetHolder, and it adds itself to that recordSetHolder.
//       But then the recordSetHolder may not match its formula anymore - have a flag/handler for that.
/** This saves this.record into main table of the formula. As defined by RecordHolder() constructor,
 *  keys/field names in this.record are the column aliases. This re-maps them to the DB columns before inserting.
 *  @TODO set/modify this.originals.
 *  @return mixed value of the primary key
 **/
RecordHolder.prototype.insert= function() {
    // Fields set in formula's onInsert{} override any fields with the same name in this.record
    for( var field in this.recordSetHolder.formula.onInsert ) {
        var value= typeof this.recordSetHolder.formula.onInsert[field]==='function'
            ? this.recordSetHolder.formula.onInsert[field]()
            : this.recordSetHolder.formula.onInsert[field];
        this.record[ field ]= value;
    }
    var entries= this.ownEntries();
    if( this.recordSetHolder.formula.generateInsertKey ) {// @TODO (low priority): || this.recordSetHolder.formula.table.generateInsertKey || this.recordSetHolder.formula.table.db.generateInsertKey
        entries= SeLiteMisc.objectsMerge( new SeLiteData.Settable().set(
            this.recordSetHolder.formula.table.primary,
            new SeLiteData.SqlExpression( "(SELECT MAX(" +this.recordSetHolder.formula.table.primary+ ") FROM " +this.recordSetHolder.formula.table.name+ ")+1")
        ), entries );
    }
    this.recordSetHolder.storage().insertRecord( {
        table: this.recordSetHolder.formula.table.name,
        entries: entries,
        fieldsToProtect: [this.recordSetHolder.formula.table.primary],
        debugQuery: this.recordSetHolder.formula.debugQuery
    });
    var primaryKeyValue= this.recordSetHolder.storage().lastInsertId( this.recordSetHolder.formula.table.name, this.recordSetHolder.formula.table.primary );
    // This requires that the primary key is never aliased. @TODO use column alias, if present?
    this.record[ this.recordSetHolder.formula.table.primary ]= primaryKeyValue;
    return primaryKeyValue;
};

RecordHolder.prototype.ownEntries= function() {
    var allAliasesToSource= this.recordSetHolder.formula.allAliasesToSource();
    for( var field in this.record ) {
        if( !(field in allAliasesToSource) ) {
            throw new Error( "Trying to insert/update a record to table '" +this.recordSetHolder.formula.table.name+
                "' with field '" +field+ "' which is not a listed alias in this formula." );
        }
    }
    
    var columnsToAliases= this.recordSetHolder.formula.columnsToAliases(this.recordSetHolder.formula.table.name);
    var entries= {};
    for( var field in columnsToAliases ) {
        // Some columns listed in the formula may have not be set (if using default values). Let's pass only the ones present.
        if( columnsToAliases[field] in this.record ) {
            entries[ field ]= this.record[ columnsToAliases[field] ];
        }
    }
    return entries;
};

RecordHolder.prototype.update= function() {
     // Fields set in formula's onUpdate{} override any fields with the same name in this.record
    for( var field in this.recordSetHolder.formula.onUpdate ) {
        var value= typeof this.recordSetHolder.formula.onUpdate[field]==='function'
            ? this.recordSetHolder.formula.onUpdate[field]()
            : this.recordSetHolder.formula.onUpdate[field];
        this.record[ field ]= value;
    }
    var entries= this.ownEntries();
    this.recordSetHolder.storage().updateRecordByPrimary( {
        table: this.recordSetHolder.formula.table.name,
        primary: this.recordSetHolder.formula.table.primary,
        entries: entries,
        debugQuery: this.recordSetHolder.formula.debugQuery
    });
    this.setOriginalAndWatchEntries();
};

/** @return null on update; id of the new record on insert; -1 on remove (RecordSetHolder depends on -1)
 **/
RecordHolder.prototype.put= function() {
    if( Object.isFrozen(this.record) ) {
        throw "The record was frozen!";
    }
    if( this.markedToRemove ) {
        this.remove();
        return -1;
    }
    else
    // Insert or update the record, depending on whether its primary key is set (it can be set to 0)
    // @return primary key value, but only when it run an insert
    if( this.record[this.recordSetHolder.formula.table.primary]!==undefined ) {
        // @TODO compare to this.original
        this.update();
        return null;
    }
    else {
        return this.insert();
    }
};

RecordHolder.prototype.markToRemove= function() {
    this.markedToRemove= true;
    this.recordSetHolder.markedToRemove[ this.record[this.recordSetHolder.formula.table.primary] ]= this;
    Object.freeze( this.record );
};

RecordHolder.prototype.remove= function() {
    this.recordSetHolder.storage().removeRecordByPrimary( this.recordSetHolder.formulate.table.name, this.recordSetHolder.formulate.table.primary,
        this.record[ this.recordSetHolder.formulate.table.primary] );
};

/** @constructor Constructor of formula objects.
 *  @param {object} params - Object serving as an associative array; optional, in form {
 *      table: SeLiteData.Table instance
 *      alias: string, alias for this table, used in SQL, optional.
 *          @TODO Check this old documentation - not applicable anymore: object, optional, in form { table-name: columns-alias-info } where each columns-alias-info is of mixed-type:
            - string column alias prefix (it will be prepended in front of all column names); or
            - SeLiteData.RecordSetFormula.ALL_FIELDS (all fields listed in the table object will be selected, unaliased); or
            - an alias map object listing all columns that are to be selected, mapped to string alias, or mapped to true/1 if not aliased; or
            - an array, listing one or more of the following
            --- all unaliased columns
            ---- optional object(s) which is an alias map {string colum name: string alias}; such a map must map to string alias (it must not map to true/1)
            --- optional SeLiteData.RecordSetFormula.ALL_FIELDS indicating usage of all columns under their names (unaliased), unless any map object(s) map them
            Each alias must be unique; that will be checked by SeLiteData.RecordSetFormula constructor (--@TODO).
            The column list must list the primary key of the main table, and it must not be aliased. Their values must exist
            - i.e. you can't have a join that selects records from join table(s) for which there is no record in the main table.
            That's because RecordSetHolder.originals{} are indexed by it.
 *      columns: Object serving as an associative array {
    *      string tableName: mixed, either
    *       - SeLiteData.RecordSetFormula.ALL_FIELDS, or
    *       - an array of [ string columnName or object columnMap, ...], or
    *       - an anonymous object {
    *              string columnName: string alias, or true
    *         }, or
    *       - SeLiteData.RecordSetFormula.ALL_FIELDS
    *      }
 *      joins: Just like the same field passed to SeLiteData.Storage.getRecords(). I.e. Array of objects {
               table: table object;
               alias: string alias, optional;
               type: string type 'INNER LEFT' etc.; optional
               on: string join condition
           }
 *      fetchCondition: String SQL condition,
 *      fetchMatching
 *      parameterNames
 *      sort
 *      sortDirection
 *      indexBy
 *      indexUnique
 *      subIndexBy
 *      process
 *      debugQuery
 *      debugResult
 *      generateInsertKey
 *      onInsert
 *      onUpdate
 *  }
 *  @param object prototype Instance of SeLiteData.RecordSetFormula which serves as the prototype for the new object. Optional.
 *  Any fields not set in params will be inherited from prototype (if present), as they are at the time of calling this constructor.
 *  Any fields set in params will override respective fields in prototype (if any),
 *  except for field(s) present in params and set to null - then values will be copied from prototype, (if present).
 *  @TODO putCondition, putMatching
 *  @TODO Consider making some of parameterNames optional. fetchMatching already can contain callback functions, so extend the mechanism
 *  to pass values of all actual parameters from user's select() call. Similar for putMatching, if we implement it. Possibly the similar for fetchCondition (and for putCondition, if we implement it).
 *  @TODO consider applying fetchMatching in other ways than just SQL = comparison. E.g. LIKE, <>, IS NULL, IS NOT NULL. The same for passing optional column filters to SeLiteData.Storage.prototype.getRecords() via its params.parameters field.
 **/
SeLiteData.RecordSetFormula= function( params, prototype ) {
    SeLiteMisc.PrototypedObject.call( this, prototype );
    params= params ? params : {};
    SeLiteMisc.objectClone( params, ['table', 'alias', 'columns', 'joins', 'fetchCondition', 'fetchMatching', 'parameterNames', 'sort',
            'sortDirection', 'indexBy', 'indexUnique', 'subIndexBy', 'process', 'debugQuery', 'debugResult', 'generateInsertKey',
            'onInsert', 'onUpdate' ],
        null, this );

    if( !Array.isArray(this.joins) ) {
        throw new Error( "params.joins must be an array (of objects), if present." );
    }

    // The following doesn't apply to indexing of RecordSetHolder.originals.
    if( this.table && this.table.primary ) {
        if( this.indexBy===undefined ) {
            this.indexBy= this.table.primary;
        }
        if( this.indexUnique===undefined ) {
            this.indexUnique= this.indexBy==this.table.primary;
        }
    }
    if( this.indexUnique && this.subIndexBy ) {
        throw new Error( "Can't use both indexUnique and subIndexBy. indexUnique may be implied if indexing by this.table.primary (as is by default)." );
    }
    // @TODO check that all own table columns' aliases are unique: Object.keys( SeLiteMisc.objectReverse( ownColumns() ) )
    // @TODO similar check for joined columns?
}
SeLiteData.RecordSetFormula.prototype.constructor= SeLiteData.RecordSetFormula;
SeLiteData.RecordSetFormula.ALL_FIELDS= ["ALL_FIELDS"]; // I compare this using ==, so by making this an array we allow user column alias prefix 'ALL_FIELDS', if (ever) need be

SeLiteData.RecordSetFormula.prototype.alias= null;
SeLiteData.RecordSetFormula.prototype.columns= {};
SeLiteData.RecordSetFormula.prototype.joins= [];
SeLiteData.RecordSetFormula.prototype.fetchCondition= null;
// fetchMatching contains the values unescaped and unqoted; they will be escaped and quoted as needed.
// Each value must represent SQL constant (string or non-string), or a function returning such value.
// String values will be quoted, so they can't be SQL expressions. Javascript null value won't be quoted
// and it will generate an IS NULL statement; other values will generate = comparison.
// If matching-value is a function, it will be called at the time the data is to be fetched from DB.
// Use it to return values which vary during runtime.
SeLiteData.RecordSetFormula.prototype.fetchMatching= {};

// Names of any parameters.
// They will be escaped & quoted as appropriate and they will replace occurrances of their placeholders :<parameter-name>.
// The placeholders can be used in joins[i].on and in fetchCondition, fetchMatching, putCondition, putMatching.
SeLiteData.RecordSetFormula.prototype.parameterNames= [];
SeLiteData.RecordSetFormula.prototype.sort= null;
SeLiteData.RecordSetFormula.prototype.sortDirection= 'ASC';
SeLiteData.RecordSetFormula.prototype.subIndexBy= null;

/** A function which will be called after fetching and indexing the records. Its two parameters will be
 *  records (RecordSet) and RecordSetHolder's bind parameters (if any). It should return RecordSet instance (either the same one, or a new one).
 **/
SeLiteData.RecordSetFormula.prototype.process= null;
SeLiteData.RecordSetFormula.prototype.debugQuery= false;
SeLiteData.RecordSetFormula.prototype.debugResult= false;

SeLiteData.RecordSetFormula.prototype.generateInsertKey= true; // @TODO make this default value null, and use something stored in connection/DB object
SeLiteData.RecordSetFormula.prototype.onInsert= {}; // aliasedFieldName: string value or function; used on insert; it overrides any existing value for that field
SeLiteData.RecordSetFormula.prototype.onUpdate= {}; // aliasedFieldName: string value or function; used on update; it overrides any existing value for that field

SeLiteData.RecordSetFormula.prototype.tableByName= function( tableName ) {
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
 *  That differs from definition field columns passed to SeLiteData.RecordSetFormula() constructor, which allows
 *  unaliased column names to be mapped to true/1. Here such columns get mapped to themselves (to the column names);
 *  that makes it easy to use with SeLiteMisc.objectValues() or SeLiteMisc.objectReverse().
 **/
SeLiteData.RecordSetFormula.prototype.columnsToAliases= function( tableName ) {
    var columnsDefinition= this.columns[ tableName ];
    var result= {};

    var listingAllColumns= columnsDefinition===SeLiteData.RecordSetFormula.ALL_FIELDS ||
        typeof columnsDefinition==="array" && columnsDefinition.indexOf(SeLiteData.RecordSetFormula.ALL_FIELDS)>=0;
    if( listingAllColumns ) {
        var allColumns= this.tableByName(tableName).columns;
        for( var i=0; i<allColumns.length; i++ ) {
            result[ allColumns[i] ]= allColumns[i];
        }
    }
    if( columnsDefinition!==SeLiteData.RecordSetFormula.ALL_FIELDS ) {
        if( Array.isArray(columnsDefinition) ) {
            for( var j=0; j<columnsDefinition.length; j++ ) { //@TODO use loop: for( .. of ..), once NetBeans supports it
                var columnOrMap= columnsDefinition[j];
                if( typeof columnOrMap ==='string' ) {
                    result[ columnOrMap ]= columnOrMap;
                }
                else
                if( typeof columnOrMap ==='object' && columnOrMap!==SeLiteData.RecordSetFormula.ALL_FIELDS ) {
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
SeLiteData.RecordSetFormula.prototype.allAliasesToSource= function() {
    // @TODO update tableByName() to be similar to this, reuse:
    var tableNamesToTables= new SeLiteData.Settable().set( this.table.name, this.table );
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

/** This returns SeLiteData.RecordSet object, i.e. the records themselves.
 *  @see RecordSetHolder.select().
 **/
SeLiteData.RecordSetFormula.prototype.select= function( parametersOrCondition ) {
    return new RecordSetHolder(this, parametersOrCondition ).select();
};

/** This returns the SeLiteData.Record object, i.e. the record itself.
 *  @see RecordSetHolder.selectOne()
 **/
SeLiteData.RecordSetFormula.prototype.selectOne= function( parametersOrCondition ) {
    return new RecordSetHolder(this, parametersOrCondition ).selectOne();
};

/** SeLiteData.RecordSet serves as an associative array, containing SeLiteData.Record object(s), indexed by SeLiteMisc.collectByColumn(formula.indexBy, formula.indexUnique, formula.subIndexBy)
 *  for the formula of recordSetHolder. It is iterable, but it doesn't guarantee the order of entries.
 *  It also keeps a non-iterable reference to recordSetHolder.
 *  @param object recordSetHolder of class RecordSetHolder
 **/
SeLiteData.RecordSet= function( recordSetHolder ) {
    SeLiteMisc.ensureInstance( recordSetHolder, RecordSetHolder, 'RecordSetHolder');
    // Set the link from record to its record holder. The field for this link is non-iterable.
    Object.defineProperty( this, SeLiteData.RecordSet.RECORDSET_TO_HOLDER_FIELD, { value: recordSetHolder } );
};
// This is configurable - if it ever gets in conflict with an index key in your DB table, change it here.
SeLiteData.RecordSet.RECORDSET_TO_HOLDER_FIELD= 'RECORDSET_TO_HOLDER_FIELD';

/** @private
 *  @param SeLiteData.RecordSet instance
 *  @return RecordSetHolder for that instance.
 **/
function recordSetHolder( recordSet ) {
    SeLiteMisc.ensureInstance(recordSet, SeLiteData.RecordSet, 'SeLiteData.RecordSet');
    return recordSet[SeLiteData.RecordSet.RECORDSET_TO_HOLDER_FIELD];
};

/** @private
 * */
SeLiteData.recordOrSetHolder= function( recordOrSet ) {
    if( recordOrSet instanceof SeLiteData.Record ) {
        return SeLiteData.recordHolder(recordOrSet);
    }
    else
    if( recordOrSet instanceof SeLiteData.RecordSet ) {
        return recordSetHolder(recordOrSet);
    }
    else {
        throw new Error( "Parameter recordOrSet must be an instance of SeLiteData.Record or SeLiteData.RecordSet, but it's:\n" +SeLiteMisc.objectToString(recordOrSet, 3) );
    }
};

/** Constructor of RecordSetHolder object.
 *  @private
 *  @param object formula instance of SeLiteData.RecordSetFormula
 *  @param mixed parametersOrCondition Any parameter values whose typeof is not 'string' or 'number'
 *  will passed to formula's process() function (if set), but it won't be passed
 *  as a binding parameter (it won't apply to any parameters in condition/fetchMatching/join).
 *  Any values with typeof 'number' will be transformed into strings.
 *  That's because SQLite only allows binding values with typeof 'string'.
 **/
function RecordSetHolder( formula, parametersOrCondition ) {
    this.formula= formula;
    this.parametersOrCondition= parametersOrCondition || {};
    this.holders= {}; // Object serving as an associative array { primary key value: RecordHolder instance }
    this.recordSet= new SeLiteData.RecordSet( this );
    this.originals= {}; // This will be set to object { primary-key-value: original object... }
    this.markedToRemove= {}; // It keeps RecordHolder instances scheduled to be removed; structure like this.holders
}

RecordSetHolder.prototype.storage= function() {
    return this.formula.table.db.storage;
};

/** @return SeLiteData.RecordSet object
 * */
RecordSetHolder.prototype.select= function() {
    SeLiteMisc.objectDeleteFields( this.recordSet );
    var formula= this.formula;
    
    var columns= {};
    // @TODO potentially use allAliasesToSource() to simplify the following
    for( var tableName in formula.columns ) {
        var columnsToAliases= formula.columnsToAliases( tableName );
        if( tableName==formula.table.name ) {
            var tableAlias= formula.alias;
        }
        else {
            for( var i=0; i<formula.joins.length; i++ ) {//@TODO if I need to do something similar again, extend SeLiteMisc.objectValueToField() to accept a callback function
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
        columns= SeLiteMisc.objectsMerge( columns, columnAliases );
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
                throw new Error( "Unexpected query parameter with name '" +paramName+ "' and value: " +usingParameterCondition[paramName] );
            }
        }
    }
    var joins= [];
    formula.joins.forEach( function(join) {
        var joinClone= SeLiteMisc.objectClone(join);
        joinClone.table= join.table.name;
        joins.push( joinClone );
    } );
    var condition= usingParameterCondition
        ? this.parametersOrCondition
        : null;
    var parameters= !usingParameterCondition
        ? SeLiteMisc.objectClone(this.parametersOrCondition)
        : {};
    var parametersForProcessHandler= !usingParameterCondition
        ? this.parametersOrCondition
        : {};
    for( var param in parameters ) {
        if( typeof parameters[param]==='number' ) {
            parameters[param]= ''+parameters[param];
        }
        else
        if( typeof parameters[param]!=='string') {
            delete parameters[param];
        }
    }
    
    var self= this;
    var data= this.storage().getRecords( {
        table: formula.table.name+ (formula.alias ? ' ' +formula.alias : ''),
        joins: joins,
        columns: columns,
        matching: matching,
        condition: self.storage().sqlAnd( formula.fetchCondition, condition ),
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
        var holder= new RecordHolder( this, data[j] );
        this.holders[ holder.record[formula.table.primary] ]= holder;
        unindexedRecords.push( holder.record );
        this.originals[ holder.record[ formula.table.primary] ]= holder.original;
    }
    SeLiteMisc.collectByColumn( unindexedRecords, formula.indexBy, formula.indexUnique, formula.subIndexBy, this.recordSet );
    if( formula.process ) {
        this.recordSet= formula.process( this.recordSet, parametersForProcessHandler );
    }
    return this.recordSet;
};

/** This runs the query just like select(). Then it checks whether there was exactly 1 result row.
 *  If yes, it returns that row (SeLiteData.Record object). Otherwise it throws an exception.
 **/
RecordSetHolder.prototype.selectOne= function() {
    this.select();
    var keys= Object.keys(this.recordSet);
    if( keys.length!==1 ) {
        throw new Error( "Expecting one record, but there was: " +keys.length+ " of them." );
    }
    return this.recordSet[ keys[0] ];
};

RecordSetHolder.prototype.insert= function() { throw new Error( "@TODO if need be" );
}

RecordSetHolder.prototype.update= function() { throw new Error( "@TODO if need be" );
};

/** This removes the record holder and its record from this set holder and its set. It doesn't
 *  remove the actual DB record.
 **/
RecordSetHolder.prototype.removeRecordHolder= function( recordHolder ) {
    var primaryKeyValue= recordHolder.record[this.formula.table.primary];
    delete this.holders[ primaryKeyValue ];
    delete this.recordSet[ SeLiteMisc.indexesOfRecord(this.recordSet, recordHolder.record) ]; //@TODO This doesn't work if multi-indexed! Then we also need to delete 1st level index, if there are no subentries left.
    delete this.originals[ primaryKeyValue ];
    delete this.markedToRemove[ primaryKeyValue ];
};

RecordSetHolder.prototype.put= function() {
    for( var i=0; i<this.holders.length; i++ ) {
        var recordHolder= this.holders[i];
        var recordResult= recordHolder.put();
        if( recordResult==-1 ) {
            this.removeRecordHolder( recordHolder );
            i--; // Because this.holders[] etc. was updated
        }
    }
};

RecordSetHolder.prototype.remove= function() { throw "TODO";
};

RecordSetHolder.prototype.replace= function() {throw 'todo';
};

var EXPORTED_SYMBOLS= [];