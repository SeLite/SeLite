/*  Copyright 2011, 2012, 2013, 2014 Peter Kehl
    This file is part of SeLite Db Objects.

    SeLite DB Storage is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite DB Storage is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite DB Storage.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

Components.utils.import( 'chrome://selite-misc/content/SeLiteMisc.js' );
Components.utils.import("chrome://selite-sqlite-connection-manager/content/SqliteConnectionManager.js");
Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
Components.utils.import( 'chrome://selite-db-objects/content/Db.js' );
var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;

/** This provides low-level data functions. It's a constructor of an object,
 *  but the code is procedural. The reason to have it as an object is not to
 *  have name clashes with functions in other files. See SeLite DB Objects for OOP layer on top of this.
 **/
SeLiteData.Storage= function Storage() {
    /** @type{SQLiteConnectionParameters} */
    this.parameters= new SQLiteConnectionParameters();
    this.parameters.errorHandler= console.error;
    this.con= null; // This will be the actual connection - result of Services.storage.openDatabase(file)
};

/** @return SQLite connection or null */
SeLiteData.Storage.prototype.connection= function connection() { return this.con; };

/** @return {string} Table prefix, or an empty string. It never returns undefined.
 *  SeLiteData.Storage doesn't actively use tablePrefix.
 *  When SeLiteData.Storage receives a call to update a record, e.g. SeLiteData.Storage.insertRecord(..),
 *  it doesn't add this tablePrefix to any of the table names - the client must do that. That's because
 *  SeLiteData.Storage doesn't modify queries passed from the client either.
 *  Overriden in private subclass StorageFromSettings.
 * */
SeLiteData.Storage.prototype.tablePrefix= function tablePrefix() { return ''; };

/** Open a new SQLite connection, as specified in parameters. Set it as the connection for this object.
 * Note: if you use this.connection().clone(), it won't inherit PRAGMA locking_mode
 * @return the new connection
 */
SeLiteData.Storage.prototype.open= function open() {
    !this.con || SeLiteMisc.fail( "Already connected to " +this.parameters.fileName );
    this.con= this.parameters.connect();
};

/** Close the connection.
 *  @param {boolean} synchronous Whether to close it ; optional.
 *  @param {function} [callback] Function to call after closed (regardless whether synchronous or asynchronous close)
 *  @TODO check: If you have used any asynchronous (?!) statements, pass true. See same comment in SQLiteConnectionInfo.close()
 * */
SeLiteData.Storage.prototype.close= function close( synchronous, callback ) {
    this.parameters.close( synchronous, callback );
    this.con= null;
};

/** This gets the list of result column names (e.g. names after the last space, if present; otherwise after the last dot, if present)
 *  out of column expressions/parts.
 *  @param array of strings
 *  @return array of strings
 *  For internal use only.
 **/
SeLiteData.Storage.prototype.fieldNames= function fieldNames( columnParts ) {
    var result= [];
    for( var i=0; i<columnParts.length; i++ ) {
        result[i]= this.fieldName( columnParts[i] );
    }
    return result;
};

SeLiteData.Storage.prototype.fieldName= function fieldName( columnPart ) {
    var result= columnPart.trim();
    var lastSpaceIndex= result.lastIndexOf(' ');
    if( lastSpaceIndex>0 ) {
        result= result.substr( lastSpaceIndex+1 );
    }
    else {
        var lastDotIndex= result.lastIndexOf('.');
        if( lastDotIndex>0 ) {
            result= result.substr( lastDotIndex+1 );
        }
    }
    // Remove any leading and trailing back apostrophe:
    if( result.length>1 && result[0]=='`' && result[result.length]=='`' ) {
        result= result.substr( 1, result.length-2 );
    }
    return result;
};

/** This collects fields from within SELECT... FROM part of the given query.
 *  For internal use only.
 **/
SeLiteData.Storage.prototype.fieldParts= function fieldParts( query ) {
    // Make lowercase. Make one or more whitespaces be a single space - so that we can locate 'select' and 'from' etc. easily.
    query= query.toLowerCase().replace( /\s+/g, ' ');
    var selectStart= query.indexOf( 'select ');
    if( selectStart<0 ) {
        throw "Query \"" +query+ "\" doesn't contain SELECT.";
    }
    var fromStart= query.indexOf( ' from ', selectStart );
    if( fromStart<0 ) {
        throw "Query \"" +query+ "\" doesn't contain FROM.";
    }
    var selectFrom= query.substring( selectStart+7, fromStart );
    if( selectFrom.indexOf('*')>=0 ) {
        throw "Query \"" +query+ "\" selects columns using *.";
    }
    var fieldParts= selectFrom.split( / ?, ?/ );
    var fields= [];
    for( var i=0; i<fieldParts.length; i++ ) {
        var part= fieldParts[i];
        if( part==='' ) {
            throw "Query \"" +query+ "\" has an empty " +(i+1)+ "-th part of SELECT list.";
        }
        var lastSpace= part.lastIndexOf( ' ' );
        if( lastSpace>=0 ) {
            if( lastSpace==part.length-1 ) {
                throw "Query \"" +query+ "\" has strange " +(i+1)+ "-th part of SELECT list.";
            }
            part= part.substr( lastSpace+1);
        }
        fields.push( part );
    }
    if( fields.length==0 ) {
        throw "Query \"" +query+ "\" has an empty SELECT list.";
    }
    return fields;
};

/** @return string SQL condition containing the given first and second condition(s), whichever of them is present and not empty;
 *  an empty string if there's no condition at all.
 *   This doesn't put oval parenthesis around the condition parts.
 *   It's not the same as [condition1, condition2... ].join( ' AND ' ), because that would put 'AND' between all
 *   parameters, even if some are empty.
 **/
SeLiteData.Storage.prototype.sqlAnd= function sqlAnd( first, second, etc ) {
    var argumentsPresent= [];
    for( var i=0; i<arguments.length; i++ ) {
        if( arguments[i] ) {
            argumentsPresent.push( arguments[i] );
        }
    }
    return argumentsPresent.join( ' AND ' );
};

/** @param string query SQL query. It can contain placeholders in format :placeholderName
 *  (see https://developer.mozilla.org/en/docs/Storage > Binding Parameters.
 *  @param object bindings Optional; Object (serving as associative array) of parameters to bind,
 *  i.e. bindings to replace placeholders in the query. When using the named parameter(s) in the query, prefix them it with a colon - e.g. access parameter xyz as :xyz. See https://developer.mozilla.org/en/Storage#Binding_One_Set_of_Parameters.
 *  @param array fields Optional; array of strings SQL fields (columns) to collect; must match case-sensitively columns
 *  coming from the query. If not present,
 *  then this function will try to collect the column names from the given query, providing
 *  - all required column names are listed, there's no *
 *  - none of the column names is string 'FROM' (case insensitive)
 *  - there are no sub-selects between SELECT...FROM
 *  @return array of objects, one per DB row, each having DB column names as fields; empty array if no matching rows
 *  @throws error on failure
 **/
SeLiteData.Storage.prototype.select= function select( query, bindings, fields ) {
    bindings= bindings || {};
    if( !fields ) {
        fields= this.fieldNames( this.fieldParts( query ) );
    }
    this.con || SeLiteMisc.fail( 'SeLiteData.Storage.connection() is not set. SQLite file name: ' +this.parameters.fileName );
    //console.log( 'SeLite: ' +query );
    var stmt= this.con.createStatement( query );
    for( var field in bindings ) {
        try {
            stmt.params[field]= bindings[field];
        }
        catch(e) {
            throw 'select(): Cannot set field "' +field+ '" to value "' +bindings[field]+ '" - SQLite/schema limitation.';
        }
    }
    var result= [];
    try {
        // MDN Docs on synchronous API are not detailed enough. If iterating over SELECT with stmt.executeStep()
        // - you can't use: for( var field in stmt.row ) - so you need to know the list of columns
        // - fields are accessbile via stmt.row.<column-name> only before you reset the statement!
        while( stmt.executeStep() ) {
            var resultRow= {};
            for( var i=0; i<fields.length; i++ ) {
                resultRow[ fields[i] ]= stmt.row[ fields[i] ];
            }
            result.push( resultRow );
        }
    }
    finally {
        stmt.finalize();
    }
    return result;
};

/** It selects 1 row from the DB. If there are no such rows, or more than one, then it throws an error.
 *  @param {string} query Full SQL query
 *  @param {object} bindings Object serving as an associative array, with bindings for named parameters; optional. see the same parameter of select(). When using the named parameter(s) in the query, prefix them it with a colon - e.g. access parameter xyz as :xyz. See https://developer.mozilla.org/en/Storage#Binding_One_Set_of_Parameters.
 *  @param array fields Optional (unless you use SELECT * etc.); optional - see the same parameter of select().
 *  @return Object (serving as an associative array) for the row.
 *  @throws error on failure
 **/
SeLiteData.Storage.prototype.selectOne= function selectOne( query, bindings, fields ) {
    var rows= this.select( query, bindings, fields );
    if( rows.length!=1 ) {
        throw "Query \"" +query+"\" was supposed to return one result, but it returned " +rows.length+ " of them.";
    }
    return rows[0];
};

/** @param string query SQL query
 *  @param object bindings Optional; see select()
 *  @return void
 *  @throws error on failure
 **/
SeLiteData.Storage.prototype.execute= function execute( query, bindings ) {
    if( bindings==null ) {
        this.con.executeSimpleSQL( query );
    }
    else {
        var stmt= this.con.createStatement( query );
        for( var field in bindings ) {
            stmt.params[field]= bindings[field];
        }
        stmt.execute();
        stmt.finalize();
    }
};

/** Get one record from the DB.
 * @param object params Object just like the same-called parameter for getRecords()
 * @return object of the DB record
 * @throws error on failure, or if no such record, or if more than 1 matching record
 **/
SeLiteData.Storage.prototype.getRecord= function getRecord( params ) {
    var records= this.getRecords( params );
    if( records.length!=1 ) {
        throw "Expected to find one matching record in DB, but found " +records.length+ " of them.";
    }
    return records[0];
};

/** Get (matching) records from the DB.
 * @param object params Object in form {
 *   table: string table name,
 *   columns: mixed - one of
 *     - array of string table names; or
 *     - string containing columns names separated by a comma
 *        or by a comma and space(s). The column names can be simple e.g. 'id'; or SQL column labels e.g. 'created created_time'
 *        or 'created AS created_time', or 'sq-expression-here column-alias-here'
 *        - but if it's not a simple name then you have to use the alias part; or
 *     - object containg DB column names as keys (field names), and their aliases as values or true/1 if no alias to use (then it uses the column name).
 *   joins: optional, array of objects [
 *      {
 *        table: string table name (it may be '<tablename> <tablealias>', then you don't need to use alias field, but alias field is preferred),
 *        alias: string table alias (optional),
 *        type: string 'INNER LEFT' etc.; optional,
 *        on: string join condition without 'ON' itself, optional
 *      }
 *   ],
 *   matching: optional, object {
 *     // String values will be quoted, unless they start with ':' and contain a parameter name listed in parameterNames.
 *     // Javascript null value will generate IS NULL, other values generate = comparison.
 *     fieldXY: value, fieldPQ: value...
 *   },
 *   condition: optional, string SQL condition, properly quoted. Both 'matching' and 'condition'
 *     may be used at the same time, then they are AND-ed,
 *   parameters: object serving as an associative array, listing parameters in form {string parameter-name: mixed parameter-value, ...}. Optional.
 *   parameterNames: array of strings which are acceptable parameter names. Optional, but should be set if you want 'parameters' to be applied.
 *   sort: optional, string column name to sort by
 *   sortDirection: optional, string direction to sort by; 'ASC' by default (if sorting)
 *   debugQuery: optional, use true if you'd like it to show the query in a popup
 *   debugResult: optional, use true if you'd like it to show the result in a popup
 * }
 **/
SeLiteData.Storage.prototype.getRecords= function getRecords( params ) {
    var parameterNames= params.parameterNames || {};
    if( typeof params.columns=='string' ) {
        var columnsString= params.columns;
        var columnsList= params.columns.split( / ?, ?/ );
    }
    else if( Array.isArray(params.columns) ) {
        var columnsString= params.columns.join(', ');
        var columnsList= params.columns;
    }
    else if( typeof params.columns ==='object' ) {
        var columnsString= '';
        var columnsList= [];
        for( var column in params.columns ) {
            if( columnsString ) {
                columnsString+= ', ';
            }
            if( typeof params.columns[column] ==='string' ) {
                columnsString+= column+ ' ' +params.columns[column];
                columnsList.push( params.columns[column] );
            }
            else
            if( params.columns[column]===true || params.columns[column]===1 ) {
                columnsString+= column;
                columnsList.push( this.fieldName(column) );
            }
            else {
                throw new Error( "getRecords(): column '" +column+ "' has an unsupported non-string alias " +params.columns[column] );
            }
        }
    }
    else throw new Error( "params.columns not recognised" );
    columnsList= this.fieldNames( columnsList );
    var query= "SELECT " +columnsString+ " FROM " +params.table;

    if( params.joins!==undefined ) {
        for( var i=0; i<params.joins.length; i++ ) {
            var join= params.joins[i];
            if( join.type!==undefined ) {
                query+= ' ' +join.type;
            }
            query+= ' JOIN ' +join.table;
            if( join.alias!==undefined ) {
                query+= ' ' +join.alias;
            }
            if( join.on!==undefined ) {
                query+= " ON " +join.on;
            }
        }
    }

    var conditionParts= [];
    if( params['matching']!==undefined && !SeLiteMisc.isEmptyObject(params['matching']) ) {
        for( var field in params.matching ) {
            var matchedValue= params.matching[field];
            matchedValue= typeof matchedValue==='string' && matchedValue.length>1
                && matchedValue[0]===':' && parameterNames.indexOf(matchedValue.substr(1))>=0
                ? matchedValue // Don't quote SQLite parameters :xyz - SQLite will escape & quote automatically
                : this.quote( matchedValue );
            if( matchedValue!==null ) {
                conditionParts.push( field+ '=' +matchedValue );
            }
            else {
                conditionParts.push( field+ ' IS NULL' );
            }
        }
    }
    if( params['condition']!==undefined && params['condition']!=='' && params['condition']!=null ) {
        conditionParts.push( '('+params.condition+')' );
    }
    if( conditionParts.length ) {
        query+= " WHERE " +conditionParts.join(' AND ');
    }
    if( typeof params['sort']!=='undefined' && params.sort ) {
        var sortDirection= (params['sortDirection']===undefined || !params.sortDirection)
            ? 'ASC'
            : params.sortDirection;
        query+= " ORDER BY " +params.sort+ ' ' +sortDirection;
    }
    if( params.debugQuery!==undefined && params.debugQuery ) {
        console.log( query );
    }

    var result= this.select( query, params.parameters, columnsList );
    if( params.debugResult!==undefined && params.debugResult ) {
        console.log( SeLiteMisc.rowsToString(result) );
    }
    return result;
};

/** Update (matching) records in the DB.
 * @param object params Object in form {
 *   table: string table name,
 *   entries: object (serving as an associative array) with the columns to update in the given table. In form
 *       { field: value,
 *         field: value...
 *       }. The values will be quoted.
 *   fieldsToProtect: optional, array of strings, which are names of fields whose
 *       values won't be quoted. Use for SQL expressions or for values that were already securely quoted
 *   matching: optional, object (all values will be quoted) {
 *     fieldXY: value, fieldPQ: value...
 *   },
 *   condition: optional, string SQL condition, properly quoted. Both 'matching' and 'condition'
 *     may be used at the same time, then they are AND-ed.
 *   debugQuery: optional, use true if you'd like it to show the query in a popup
 * }
 * @return void
 * @throws an error on failure
 **/
SeLiteData.Storage.prototype.updateRecords= function updateRecords( params ) {
    var fieldsToProtect= params.fieldsToProtect!==undefined
        ? params.fieldsToProtect
        : [];
    var entries= this.quoteValues( params.entries, fieldsToProtect );

    var setPairs= [];
    for( var field in entries ) {
        setPairs.push( field+ '=' +entries[field] );
    }
    if( !setPairs.length ) {
        LOG.error( 'updateRecords() requires params.entries not to be empty.' );
    }
    var query= "UPDATE " +params.table+ " SET " +setPairs.join(', ');

    var conditionParts= [];
    if( typeof params['matching'] !=='undefined' ) {
        for( var field in params.matching ) {
            conditionParts.push( field+ '=' +this.quote( params.matching[field] ) );
        }
    }
    if( params['condition']!==undefined && params['condition']!=='' && params['condition']!=null ) {
        conditionParts.push( '('+params.condition+')' );
    }
    if( conditionParts.length ) {
        query+= " WHERE " +conditionParts.join(' AND ');
    }

    if( params.debugQuery!==undefined && params.debugQuery ) {
        console.log( query );
    }
    var stmt= this.con.createStatement( query );
    stmt.execute();
    stmt.finalize();
};

/** Update a in the DB, matching it by 'id' field (i.e. params.entries.id).
 * @param object params Object in form {
 *   table: string table name,
 *   primary: string primary key name, or an array of string column names (for a multi-column primary key),
 *   entries: object (serving as an associative array) with the columns to update in the given table. In form
 *       { field: value,
 *         field: value...
 *       }. The values will be quoted.
 *   entries must contain '<primary>' field(s), which will be matched in the DB (but, indeed, the primary field(s) won't be updated).
 *   fieldsToProtect: optional, array of strings, which are names of fields whose
 *       values won't be quoted. Use for SQL expressions or for values that were already securely quoted
 *   debugQuery: optional, use true if you'd like it to show the query in a popup
 *   }
 * @return void
 * @throws an error on failure
 */
SeLiteData.Storage.prototype.updateRecordByPrimary= function updateRecordByPrimary( params ) {
    var copiedParams= SeLiteMisc.objectClone( params, ['table', 'entries', 'fieldsToProtect', 'debugQuery'], ['table', 'entries'] );
    copiedParams.entries= SeLiteMisc.objectClone( copiedParams.entries );
    var primaryKey= params.primary;
    var primaryKeyColumns= typeof primaryKey==='string'
        ? [primaryKey]
        : primaryKey;
    copiedParams.matching= {};
    for( var i=0; i<primaryKeyColumns.length; i++ ) { //@TODO for(..of..) once NetBeans like it
        var column= primaryKeyColumns[i];
        copiedParams.entries[column]!==undefined || SeLiteMisc.fail( "updateRecordByPrimary(): params.entries." +column+ " is not set." );
        copiedParams.matching[column]= copiedParams.entries[column];
        delete copiedParams.entries[column];
    }
    this.updateRecords( copiedParams );
};

/** Delete a record in the DB, matching it by the given field and its value.
 *  The value will be quoted and it must not be null.
 * @param {string} tableName
 * @param {string|array} primaryKey
 * @param {object} record
 * @return void
 * @throws an error on failure
 */
SeLiteData.Storage.prototype.removeRecordByPrimary= function removeRecordByPrimary( tableName, primaryKey, record ) {
    if( typeof primaryKey==='string' ) {
        primaryKey= [primaryKey];
    }
    var conditionParts= [];
    for( var i=0; i<primaryKey.length; i++ ) {//@TODO for(..of..) once NetBeans likes it
        conditionParts.push( primaryKey[i]+ '=' +this.quoteValues( record[primaryKey[i]] ) );
    }
    var query= "DELETE FROM " +tableName+ " WHERE " +conditionParts.join( 'AND' );
    var stmt= this.con.createStatement( query );
    stmt.execute();
    stmt.finalize();
};

/**Insert the  record into the DB.
 * @param object params Object in form {
 *   table: string table name,
 *   entries: object (serving as an associative array) to store in the given table. In form
 *       { field: value,
 *         field: value...
 *       }. The values will be quoted.
 *   fieldsToProtect: optional, array of strings, which are names of fields whose
 *       values won't be quoted. Use for SQL expressions or for values that were already securely quoted
 *   debugQuery: optional; use true if you'd like to show the query in a popup
 * }
 * @return void
 * @throws an error on failure
 */
SeLiteData.Storage.prototype.insertRecord= function insertRecord( params ) {
    var fieldsToProtect= params.fieldsToProtect!==undefined
        ? params.fieldsToProtect
        : [];
    var entries= this.quoteValues( params.entries, fieldsToProtect );
    var columns= [];
    var values= [];
    for( var field in entries ) {
        columns.push( field );
        values.push( entries[field] );
    }
    var query= 'INSERT INTO ' +params.table+ '(' +columns.join(', ')+ ') VALUES ('+
        values.join(', ')+ ')';
    if( params.debugQuery!==undefined && params.debugQuery ) {
        console.log( query );
    }
    var stmt= this.con.createStatement( query );
    stmt.execute();
    stmt.finalize();
};

/** This returns the last successfully inserted record.
 *  It only works when called right after the relevant INSERT statement, i.e. there must
 *  be no other INSERT statements before calling this, even if those INSERT statements would
 *  insert into a different table.
 *  It requires the DB table not to have any column called "rowid", "oid" or "_rowid_".
 *  See http://sqlite.org/lang_corefunc.html and http://sqlite.org/lang_createtable.html#rowid
 *  @param {string} tableName Table name (including any prefix); it must be the table that was used with the last INSERT/UPDATE.
 *  @param {(array)} columns Names of the columns to retrieve; optional - ['id'] by default
 *  @return {object} Record object with given column(s).
*/
SeLiteData.Storage.prototype.lastInsertedRow= function lastInsertedRow( tableName, columns ) {
    columns= columns || ['id'];
    var query= "SELECT " +columns.join(',')+ " FROM " +tableName+ " WHERE rowid=last_insert_rowid()";
    var record= this.selectOne( query, {}, columns );
    return record;
};

/** This adds enclosing apostrophes and doubles any apostrophes in the given value, if it's a string.
 *  <br>It does add enclosing apostrophes around Javascript strings "null" or "NULL" etc! So use Javascript null instead.
 *  Use SqlExpression if you don't want quotes to be added.
 *  <br>For Javascript null, it returns unqouted string 'NULL'. That way we can pass values part of the result of quoteValues()
 *  (which returns an array of quoted items) through Array.join(). Otherwise, if we kept Javascript null values as they were,
 *  we couldn't use Array.join(), because it uses empty strings for Javascript nulls! See functions that call quoteValues().
 */
SeLiteData.Storage.prototype.quote= function quote( value ) {
    if( value===null ) {
        return 'NULL';
    }
    if( value instanceof SeLiteData.SqlExpression ) {
        return ''+value;
    }
    return "'" +(''+value).replace( "'", "''" )+ "'";
};

/** Use instances of SeLiteData.SqlExpression so that they don't get quoted/escaped by quote() and quoteValues().
 **/
SeLiteData.SqlExpression= function SqlExpression( string ) {
    this.string= string;
};
SeLiteData.SqlExpression.prototype.toString= function toString() {
    return this.string;
};

/** This adds enclosing apostrophes and doubles any apostrophes in values in entries for SQLite. See quote() for details on escaping.
 *  @param mixed entries it can be an array (created using new Array() or [...]), or an object {...} serving as an associative array
 *  @param array fieldsToProtect Optional array of strings, which are field (column) names for fields that shouldn't be quoted. Use it
 *  if passing SQL expressions for their values. fieldToProtect has only effect if entries is an object.
 *  @return new array or object, based on the original, with the treated values. Original array/object is not modified.
 **/
SeLiteData.Storage.prototype.quoteValues= function quoteValues( entries, fieldsToProtect ) {
    if( typeof entries !='object' ) {
        throw "quoteValues(): parameter should be an object or array, but it was " +values;
    }
    if( Array.isArray(entries) ) {
        var result= [];
        for( var i=0; i<entries.length; i++ ) {
            result[i]= this.quote( entries[i] );
        }
    }
    else {
        fieldsToProtect= fieldsToProtect || [];
        var result= {};
        for( var field in entries ) {
            if( fieldsToProtect.indexOf(field)>=0 ) {
                result[field]= entries[field];
            }
            else {
                result[field]= this.quote( entries[field] );
            }
        }
    }
    return result;
};

/** Used to generate object parts of 'columns' part of the parameter to SeLiteData.RecordSetFormula() constructor, if your table names are not constants,
    i.e. you have a configurable table prefix string, and you don't want to have a string variable for each table name itself, but you want
    to refer to .name property of the table object. Then your table name is not string constant, and you can't use string runtime expressions
    as object keys in anonymous object construction {}. That's when you can use new SeLiteData.Settable().set( tableXYZ.name, ...).set( tablePQR.name, ...)
    as the value of 'columns' field of SeLiteData.RecordSetFormula()'s parameter.
    Its usage assumes that no table name (and no value for parameter field) is 'set'.
*/
SeLiteData.Settable= function Settable() {
    if( arguments.length>0 ) {
        throw new Error( "Constructor Settable() doesn't use any parameters." );
    }
};
// I don't want method set() to show up when iterating using for( .. in..), therefore I use defineProperty():
Object.defineProperty( SeLiteData.Settable.prototype, 'set', {
        value: function set( field, value ) {
            this[field]= value;
            return this;
        }
} );

/** @constructor Subclass of SeLiteData.Storage, that is based on SeLiteSettings.Field pointing to an SQLite source, and an optional Field indicating table prefix.
 * @private
 *  @param {SeLiteSettings.Field.SQLite} dbField
 *  @param {SeLiteSettings.Field.String} [tablePrefixField]
 * */
function StorageFromSettings( dbField, tablePrefixField ) {
    SeLiteData.Storage.call( this );

    !(dbField.name in StorageFromSettings.instances) || SeLiteMisc.fail('There already is an instance of StorageFromSettings for ' +dbField.name );
    this.dbField= dbField;
    this.tablePrefixField= tablePrefixField;
    this.tablePrefixValue= undefined; // This will be a cached configuration value for Field instance stored in this.tablePrefixField for current test suite (once known)
    
    StorageFromSettings.instances[ dbField.name ]= this;
    // I don't call this.open() here, because the test suite folder may not be known yet - and it can override any default configuration set
}

StorageFromSettings.prototype= new SeLiteData.Storage();
StorageFromSettings.prototype.constructor= StorageFromSettings;

/** @private Object serving as an associative array {
 *      string full field name: instance of StorageFromSettings
 *  }
 * */
StorageFromSettings.instances= {};

/** Create connection on demand, if it wasn't created already. See Storage.prototype.connection(). */
StorageFromSettings.prototype.connection= function connection() {
    if( !this.con ) {
        try { this.open(); }
        catch( e ) { console.debug( "Couldn't open SQLite DB " +this.parameters.fileName ); }
    }
    return this.con;
};

StorageFromSettings.prototype.open= function open() {
    if( SeLiteSettings.getTestSuiteFolder() ) {
        var newFileName= this.dbField.getDownToFolder().entry;
        if( newFileName ) {
            this.parameters.fileName= newFileName;
        }
    }
    else {
        var fields= this.dbField.module.getFieldsOfSet();
        if( fields[this.dbField.name] && fields[this.dbField.name].entry ) {
            this.parameters.fileName= fields[this.dbField.name].entry;
        }
    }
    SeLiteData.Storage.prototype.open.call( this );
    if( this.tablePrefixField ) {
        if( SeLiteSettings.getTestSuiteFolder() ) {
            var fieldEntry= this.tablePrefixField.getDownToFolder().entry;
            this.tablePrefixValue= fieldEntry!==undefined
                ? fieldEntry
                : '';
        }
        else {
            var fields= this.tablePrefixField.module.getFieldsOfSet();
            this.tablePrefixValue= fields[this.tablePrefixField.name] && fields[this.tablePrefixField.name].entry!==undefined
                ? fields[this.tablePrefixField.name].entry
                : '';
        }
    }
    else {
        this.tablePrefixValue= '';
    }
};

StorageFromSettings.prototype.close= function close( synchronous ) {
    SeLiteData.Storage.prototype.close.call( this, synchronous );
    this.tablePrefixValue= undefined;
    this.dbField.name in StorageFromSettings.instances || SeLiteMisc.fail( 'StorageFromSettings.close() for field ' +this.dbField.name+ " couldn't find a connection for dbField." );
};

/** @return {string} Table prefix, or an empty string. It never returns undefined.
 *  @overrides SeLiteData.Storage.tablePrefix()
 * */
StorageFromSettings.prototype.tablePrefix= function tablePrefix() {
    return this.tablePrefixValue;
};

/** Create a new instance of StorageFromSettings, based on the given field (or its name), or
 *  re-use an existing instance of StorageFromSettings based on that field.
 *  @param {string|SeLiteSettings.Field} appDbFieldOrFieldName Either string, or SeLiteSettings.Field.SQLite instance.
 *  If it is a string, it must be a full field name. See SeLiteSettings.getField(). Optional, it defaults to 'extensions.selite-settings.common.testDB'.
 *  @param {string|SeLiteSettings.Field} [tablePrefixFieldOrFieldName] Either string, or SeLiteSettings.Field.SQLite instance.
 *  If it is a string, it must be a full field name. See SeLiteSettings.getField(). Optional, it defaults to 'extensions.selite-settings.common.tablePrefix'. If you want to use an empty table prefix and to override any value of 'extensions.selite-settings.common.tablePrefix' field, pass an empty string '' or null.
 *  @param {boolean} [dontCreate=false] If true then this won't create a storage object,
 *  if it doesn't exist yet (then this returns null). False by default.
 *  @return {StorageFromSettings}
 */
SeLiteData.getStorageFromSettings= function getStorageFromSettings( appDbFieldOrFieldName, tablePrefixFieldOrFieldName, dontCreate ) {
    appDbFieldOrFieldName= appDbFieldOrFieldName!==undefined
        ? appDbFieldOrFieldName
        : 'extensions.selite-settings.common.testDB';
    var appDBfield= SeLiteSettings.getField(appDbFieldOrFieldName);
    appDBfield instanceof SeLiteSettings.Field.SQLite || SeLiteMisc.fail('Parameter appDbFieldOrFieldName must be an instance of SeLiteSettings.Field.SQLite, or a string, but it is (after processing) ' +appDbFieldOrFieldName+ '; appDBfield: ' +appDBfield );
    
    tablePrefixFieldOrFieldName= tablePrefixFieldOrFieldName!==undefined
        ? tablePrefixFieldOrFieldName
        : 'extensions.selite-settings.common.tablePrefix';
    var tablePrefixDBfield= tablePrefixFieldOrFieldName
        ? SeLiteSettings.getField(tablePrefixFieldOrFieldName)
        : undefined;
    tablePrefixFieldOrFieldName===undefined || tablePrefixDBfield instanceof SeLiteSettings.Field.String || SeLiteMisc.fail('Parameter tablePrefixDBfield must be an instance of SeLiteSettings.Field.String, or a string, but it is (after processing) ' +tablePrefixFieldOrFieldName+ '; tablePrefixField: ' +tablePrefixDBfield );
    
    dontCreate= dontCreate || false;
    SeLiteMisc.ensureType( dontCreate, 'boolean', 'Parameter dontCreate must be a boolean, if specified.' );
    var instance= appDBfield.name in StorageFromSettings.instances
        ? StorageFromSettings.instances[appDBfield.name]
        : (dontCreate
            ? null
            : new StorageFromSettings( appDBfield, tablePrefixDBfield )
          );
    return instance;
};

function testSuiteFolderChangeHandler() {
    Object.keys(StorageFromSettings.instances).length===0 || SeLiteSettings.getTestSuiteFolder()
    || console.log( 'SeLiteSettings: there are ' +Object.keys(StorageFromSettings.instances).length+ ' instance(s) of StorageFromSettings, yet the current test suite has no folder yet.' );
    for( var fieldName in StorageFromSettings.instances ) {
        /** @type{StorageFromSettings} */
        var instance= StorageFromSettings.instances[fieldName];
        instance instanceof StorageFromSettings || fail();
        var newFileName= instance.dbField.getDownToFolder().entry;
        if( instance.con ) {
            if( instance.parameters.fileName===newFileName ) {
                continue;
            }
            instance.close( true, function callback() {
                instance.parameters.fileName= null;
                if( newFileName ) {
                    instance.parameters.fileName= newFileName;
                    instance.open();
                }
            });
        }
        if( !newFileName ) {
            console.log( 'SeLiteSettings: The current test suite has a folder, but field ' +instance.dbField+ ' is not defined for it.' );
        }
    }
}
SeLiteSettings.addTestSuiteFolderChangeHandler( testSuiteFolderChangeHandler );

function ideCloseHandler() {
    StorageFromSettings.instances= {};
}
SeLiteSettings.addClosingIdeHandler( ideCloseHandler );

var EXPORTED_SYMBOLS= [];