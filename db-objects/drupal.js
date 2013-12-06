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
    Components.utils.import('chrome://selite-db-objects/content/basic-storage.js');
    Components.utils.import( 'chrome://selite-db-objects/content/basic-objects.js' );
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    
    var storage= new StorageFromSettings('extensions.selite-settings.basic.testDb');
    var db= new Db( storage, 'mdl_' ); //@TODO Prefix to come from SeLiteSettings - through the module definition?
    
    var users= new Table( {
       db:  db,
       name: 'users',
       columns: ['uid', 'name', 'pass', 'mail', 'theme']
    });
    
    var usersFormula= new RecordSetFormula( {
        table: users,
        columns: new Settable().set( users.name, RecordSetFormula.ALL_FIELDS )
    });
    
    Selenium.prototype.doDrupalUsers= function( first, second) {
        console.log( usersFormula.select() );
    };
})();