/*  Copyright 2013 Peter Kehl
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

(function() {  
    // @TODO Doc
    // If you don't use SeLite Bootstrap, but you load this file as a Core extension file
    // (not an XPI, but just a file pointed to from Selenium IDE > Options), then
    // uncomment the following statements thare are commented out
    
    // Components.utils.import( 'chrome://selite-misc/content/selite-misc.js' );
    // var loadedOddTimes= SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['doDrupalUsers'] || false;
    // if( loadedOddTimes ) { // Ignore the first load, because Se IDE somehow discards that Selenium.prototype
        Components.utils.import( 'chrome://selite-db-objects/content/db.js' );
        Components.utils.import('chrome://selite-db-objects/content/basic-storage.js');
        var SeLiteDbObjects= Components.utils.import( 'chrome://selite-db-objects/content/basic-objects.js', {} );
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        
        var storage= SeLiteDb.getStorageFromSettings('extensions.selite-settings.basic.testDb');
        var db= new SeLiteDbObjects.Db( storage, '' ); //@TODO Prefix to come from SeLiteSettings - through the module definition?

        var users= new SeLiteDbObjects.Table( {
           db:  db,
           name: 'users',
           columns: ['uid', 'name', 'pass', 'mail', 'theme']
        });

        var usersFormula= new SeLiteDbObjects.RecordSetFormula( {
            table: users,
            columns: new SeLiteDb.Settable().set( users.name, SeLiteDbObjects.RecordSetFormula.ALL_FIELDS )
        });

        Selenium.prototype.doDrupalUsers= function( first, second) {
            console.log( 'doDrupalUsers: ' +usersFormula.select() );
        };
        Selenium.prototype.testDb= storage;
    // }
    // SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['doDrupalUsers']= !loadedOddTimes;
})();