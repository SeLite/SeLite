/*  Copyright 2011, 2012, 2013, 2014 Peter Kehl
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";
// Based on
// https://developer.mozilla.org/en/Storage/Performance#Keeping_the_cache_between_transactions
// https://bugzilla.mozilla.org/show_bug.cgi?format=multiple&id=380345
// https://developer.mozilla.org/en/How_to_Build_an_XPCOM_Component_in_Javascript#Creating_the_Component
// https://developer.mozilla.org/en/XPCOM/XPCOM_changes_in_Gecko_2.0

// Don't use SQLite virtual tables neither any full-text indexes in cache mode. See
// https://developer.mozilla.org/en/XPCOM_Interface_Reference/mozIStorageService#openDatabase()

var runningAsComponent= (typeof window==='undefined' || window && window.location && window.location.protocol=='chrome:'); // When set to false, this can be loaded via <script src="file://..."> rather than via Components.utils.import(). Used for limited debugging only. Can't use <script src="chrome://...">
if( runningAsComponent ) {
    Components.utils.import("resource://gre/modules/Services.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
}

function SQLiteConnectionParameters() {}

SQLiteConnectionParameters.prototype= {
  /** @var string filename File name of your SQLite DB file, either
   *  - as it is under your current Firefox profile, no path before it; include any extension; or
   *  - including the full path
      The extension doesn't really matter (as far as it matches the file's extension), but don't use '.sdb' extension - see https://developer.mozilla.org/en/Storage#Opening_a_connection
    */
    fileName: null,
    /** @var bool lockExclusive Whether to use PRAGMA locking_mode=EXCLUSIVE.
      By default, SQLite uses PRAGMA locking_mode=normal. Using EXCLUSIVE speeds things up.
      See http://www.sqlite.org/pragma.html#pragma_locking_mode and https://bugzilla.mozilla.org/show_bug.cgi?format=multiple&id=380345
      Mozilla's wrapper around SQLite may decide to ignore/adjust these settings.
    */
    lockExclusive: false,
    /** @var cacheRatio - Default cache will be set to cacheRatio*current-DB-size, subject to limits by cacheMin and cacheMax
     */
    cacheRatio: null,
    /**  @var int cacheMin Minimal cache size, in DB pages. See http://www.sqlite.org/pragma.html -> pragma cache_size, page_count, page_size
    */
    cacheMin: null,
    /** @var int cacheMax Maximum cache size, in DB pages
     */
    cacheMax: null,
    // preloadCache has effect only when the connection is created. If re-using an existing connection, preloadCache is ignored.
    // @TODO optional parameter: a narrowed down list of tables to pre-load from. The same on Db object, but then append table prefixes.
    preloadCache: false,
    // Used to report any (unlikely) errors when pre-loading tables to the cache. That is done asynchronously, therefore throwing an error
    // from there doesn't get reported.
    // If errorHandler is set, it must be a function that takes one string parameter - error message. You can just use 'alert' for this - without apostrophes.
    errorHandler: null,
    // I'm not implementing neither using clone() to make protective copies of these instances.
    // That could prevent client's stupidity (e.g. the client re-using these instances for
    // connections using different DB files). But it couldn't prevent insecure/malicious
    // - since the client can call Mozilla API directly, anyway.
    
  /** This opens a connection and returns it; if it was open already
   *  then it returns the existing connection.
   *  There may be only 1 type of connection - cached or uncached - per fileName
   *  at any time. If you call this function twice with the same filename and
   *  different boolean values for useCache, you must call close() in between
   *  - otherwise the 2nd call fails.
   *  @return SQLite connection object
   *  @throw whatever bad happens
   **/
  connect: function() {
      var info= locateConnectionInfo( this, 'connect' );
      if( info ) {
          return info.connection;
      }
      var info= new SQLiteConnectionInfo( this );
      info.open();
      SQLiteConnectionInfo.connectionInfos.push( info );
      return info.connection;
  },
          
  /** This closes the connection.
   *  @param mixed fileNameOrConnectionOrParameters
   *  - string: exact (case-sensitive equal) as 'fileName' field of 'parameters' parameter that has been passed to connect(), or
   *  - object: exact as (or equal to, but of the same class as) 'parameters' parameter that has been passed to connect(), or
   *  - DB connection itself.
   *  @param bool synchronous Whether to close it down synchronously; otherwise it's closed down asynchronously (default).
   *  If you've executed any asynchronous statements, then it must be false.
   *  See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/mozIStorageConnection#close%28%29.
   *  Note that when true, I regularly got NS_ERROR_STORAGE_BUSY: Component returned failure code: 0x80630001 (NS_ERROR_STORAGE_BUSY) [mozIStorageConnection.close], even though I have only used synchronous statements! So, it's safer to pass synchronous=true.
   *  @return void
   *  @throw if fileNameOrConnection doesn't match any open connection object
   *  neither its parameters neither any of their filenames, or on underlying failure
   **/
  close: function( synchronous ) {
      var info= locateConnectionInfo( this, 'close' );
      if( info ) {
          info.close( synchronous );
      }
      else {
          throw new Error( "SQLiteConnectionParameters.close() couldn't find an open connection to " +this.fileName );
      }
  },

  beingClosedDown: function() {
      var info= locateConnectionInfo( this, 'beingClosedDown' );
      return info && info.beingClosedDown;
  },
};

/** This opens the file and a connection (and a cache-keeping connection, if needed).
 *  When this is called, it's assumed that there's no existing connection for given fileName.
 **/
function SQLiteConnectionInfo( parameters ) {
    if( !(parameters instanceof SQLiteConnectionParameters) ) {
        throw Error( 'SQLiteConnectionInfo() expects parameter "parameters" to be of class SQLiteConnectionParameters.' );
    }
    this.parameters= parameters;
}

SQLiteConnectionInfo.prototype= {
    parameters: null, //SQLiteConnectionParameters instance
    connection: null,
    beingClosedDown: false
};

/** @var 'static' field, an array of SQLiteConnectionInfo instances for which there are SQLite connections currently open or being shut down
 * */
SQLiteConnectionInfo.connectionInfos= [];

function preloadCacheTable( connection, tableNames, tableIndex, errorHandler ) {
    tableIndex= tableIndex || 0;
    if( tableIndex==tableNames.length ) {
        connection.asyncClose();
        return;
    }
    var statement= connection.createAsyncStatement( 'SELECT * FROM ' +tableNames[tableIndex] );
    statement.executeAsync( {
        handleResult: function(aResultSet) {
            // This gets called only if there was data returned from DB
            // This may be called several times per same statement!
            while( aResultSet.getNextRow() );
        },
        handleError: function(aError) {
            if( errorHandler ) {
                errorHandler( "Couldn't pre-load cache for table " +tableNames[tableIndex]+ ': ' +aError );
            }
        },
        handleCompletion: function(aReason) {
            // Chain - preload the rest of the tables, recursively. This gets called whether there was any data returned or not
            preloadCacheTable( connection, tableNames, tableIndex+1, errorHandler );
        }
    } );
}

function preloadCache( connection, errorHandler ) {
    try {
        connection= connection.clone( true );
        var stmt= connection.createStatement( "SELECT name FROM SQLITE_MASTER where type='table'" );
        var tableNames= [];
        try {
            while( stmt.executeStep() ) {
                tableNames.push( stmt.row.name );
            }
        }
        finally {
            stmt.reset();
        }
    }
    catch( error ) {
        throw new Error( "Couldn't fetch a list of tables for pre-loading the cache: " +error );
    }
    preloadCacheTable( connection, tableNames, 0, errorHandler );
}

/** This opens the connection and sets it as required. If successfull, it
 *  assigns the connection to this.connection; otherwise it returns without setting it.
 *  @return void
 *  @throws Error on failure */
SQLiteConnectionInfo.prototype.open= function() {
    var file;
    try {
        file= FileUtils.getFile( "ProfD", [this.parameters.fileName] );
    }
    catch( error ) {
        file= new FileUtils.File( this.parameters.fileName );
    }
    var connection= Services.storage.openDatabase( file );
    // There's no need neither a way to 'close' file. See https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIFile
    if( !connection.connectionReady ) {
        throw "Created the connection, but it wasn't ready.";
    }
    if( this.parameters.lockExclusive ) {
        connection.executeSimpleSQL( "PRAGMA locking_mode=EXCLUSIVE" );
    }
    if( this.parameters.cacheRatio!=null || this.parameters.cacheMin!=null || this.parameters.cacheMax!=null ) {
        
        var cacheSize= null; // By the end of this block, cacheSize will be the result cache size, in DB pages
        if( this.parameters.cacheRatio!=null ) {
            var stmt= connection.createStatement( "PRAGMA page_count" );
            if( !stmt.executeStep() ) {
                throw "Couldn't get PRAGMA page_count";
            }
            // typeof stmt.row.page_count is 'number' - very good
            var dbSize= stmt.row.page_count; // in DB pages
            stmt.reset();
            cacheSize= Math.round( dbSize*this.parameters.cacheRatio );
        }
        else { // get the default page size
            var stmt= connection.createStatement( "PRAGMA cache_size" );
            try {
                if( !stmt.executeStep() ) {
                    throw "Couldn't get PRAGMA cache_size";
                }
                var msg= '';
                for( var field in stmt.row ) {
                    msg+= field+ ': '+ stmt.row[field]+ '; ';
                }
                cacheSize= stmt.row.cache_size;
            }
            finally {
                stmt.reset();
            }
        }

        if( this.parameters.cacheMin!=null || this.parameters.cacheMax!=null ) {
            var stmt= connection.createStatement( "PRAGMA page_size" );
            try {
                if( !stmt.executeStep() ) {
                    throw "Couldn't get PRAGMA page_size";
                }
                var pageSize= stmt.row.page_size; // in bytes
            }
            finally {
                stmt.reset();
            }

            // Let's get min & max values in DB pages
            var MB= 1024*1024;
            if( this.parameters.cacheMin!=null ) {
                var cacheMin= Math.round( this.parameters.cacheMin*MB/pageSize );
                cacheSize= Math.max( cacheSize, cacheMin );
            }
            if( this.parameters.cacheMax!=null ) {
                var cacheMax= Math.round( this.parameters.cacheMax*MB/pageSize );
                cacheSize= Math.min( cacheSize, cacheMax );
            }
        }
        connection.executeSimpleSQL( "PRAGMA cache_size=" +cacheSize );
    }
    this.connection= connection;
    if( this.parameters.preloadCache ) {
        preloadCache( connection, this.parameters.errorHandler );
    }
};

/** This closes the connection asynchronously. It sets beingClosedDown=true
 * until the asynchronous close completes; then it removes this SQLiteConnectionInfo
 * instance from list of instances.
 * @param bool synchronous Whether to close it down synchronously; otherwise it's closed down asynchronously (default).
 * @return void
 * @throw on error (or if beingClosedDown was set already)
 * */
SQLiteConnectionInfo.prototype.close= function( synchronous ) {
    if( this.beingClosedDown ) {
        throw new Error( 'SQLiteConnectionInfo.close(): the connection is already being closed down.' );
    }
    var info= this;
    var completionHandler= {
        complete: function() {
            // remove itself from SQLiteConnectionInfo.connectionInfos
            for( var i=0; i<SQLiteConnectionInfo.connectionInfos.length; i++ ) {
                if( SQLiteConnectionInfo.connectionInfos[i]===info ) {
                    SQLiteConnectionInfo.connectionInfos.splice( i, 1 );
                }
            }
            this.beingClosedDown= false;
            this.connection= null;
            if( !synchronous ) {
                console.log( "SQLiteConnectionInfo.close() successfully closed asynchronously." );
            }
        }
    };
    this.beingClosedDown= true;
    if( synchronous ) {
        this.connection.close();
        completionHandler.complete();
    }
    else {
        this.connection.asyncClose( completionHandler );
    }
};

/** Locate SQLiteConnectionInfo instance, if any. 'Private function'.
 *  @param mixed fileNameOrConnectionOrParameters Either instance of SQLiteConnectionParameters, or a full path+filename of an SQLite file
 *  @param string callerFunctionName Used to make the error messages nicer.
 *  @return SQLiteConnectionInfo instance, if matched; null if not matched but no error
 *  @throw Error if fileNameOrConnectionOrParameters is of incorrect type
 *  */
function locateConnectionInfo( fileNameOrConnectionOrParameters, callerFunctionName ) {
      for( var i=0; i<SQLiteConnectionInfo.connectionInfos.length; i++ ) {
          var info= SQLiteConnectionInfo.connectionInfos[i];

          if( typeof fileNameOrConnectionOrParameters=='object' ) {
              if( fileNameOrConnectionOrParameters instanceof SQLiteConnectionParameters ) {
                  if( info.parameters.fileName==fileNameOrConnectionOrParameters.fileName ) {
                      if( info.parameters.lockExclusive==fileNameOrConnectionOrParameters.lockExclusive ) {
                          return info;
                      }
                      throw new Error( 'SQLiteConnectionParameters.' +callerFunctionName+ '() called with an object parameter, '+
                        'whose fileName matched, but lockExclusive was different: ' +fileNameOrConnectionOrParameters.lockExclusive );
                  }
              }
              else {
                  if( info.connection==fileNameOrConnectionOrParameters ) {
                      return info;
                  }
              }
          }
          else
          if( typeof fileNameOrConnectionOrParameters=='string' ) {
              if( info.parametersfile.fileName==fileNameOrConnectionOrParameters ) {
                  return info;
              }
          }
          else {
              throw new Error( 'SQLiteConnectionParameters.' +callerFunctionName+ '() called with a parameter of unsupported type: ' +(typeof fileNameOrConnectionOrParameters) );
          }
      }
      return null;
}

var EXPORTED_SYMBOLS= ['SQLiteConnectionParameters', 'SQLiteConnectionInfo'];