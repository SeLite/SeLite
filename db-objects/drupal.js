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
    var SeLiteMisc= Components.utils.import('chrome://selite-misc/content/selite-misc.js', {});
    var numberOfTimesLoaded= SeLiteMisc.nonXpiCoreExtensions['doDrupalUsers'] || 0;
    // Ignore the first load, because Se IDE somehow discards that Selenium.prototype
    if( numberOfTimesLoaded==1 ) {
        var SeLiteDbStorage= Components.utils.import('chrome://selite-db-objects/content/basic-storage.js', {});
        var SeLiteDbObjects= Components.utils.import( 'chrome://selite-db-objects/content/basic-objects.js', {} );
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;

        var storage= new SeLiteDbStorage.StorageFromSettings('extensions.selite-settings.basic.testDb');
        var db= new SeLiteDbObjects.Db( storage, '' ); //@TODO Prefix to come from SeLiteSettings - through the module definition?

        var users= new SeLiteDbObjects.Table( {
           db:  db,
           name: 'users',
           columns: ['uid', 'name', 'pass', 'mail', 'theme']
        });

        var usersFormula= new SeLiteDbObjects.RecordSetFormula( {
            table: users,
            columns: new SeLiteDbObjects.Settable().set( users.name, SeLiteDbObjects.RecordSetFormula.ALL_FIELDS )
        });

        Selenium.prototype.doDrupalUsers= function( first, second) {
            console.log( 'doDrupalUsers() storage.connection: ' +storage.connection );
            console.log( usersFormula.select() );
        };
        Selenium.prototype.testDb= storage;
    }
    else if( numberOfTimesLoaded>1 ) {
        SeLiteMisc.fail( 'IDE is trying to load this core extension for the 3rd time');
    }
    SeLiteMisc.nonXpiCoreExtensions['doDrupalUsers']= numberOfTimesLoaded+1;
})();