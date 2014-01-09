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
    // I suggest that you load this file via SeLite Bootstrap (Selenium IDE > Options > Options > SeLite Bootstrap > Selenium Core extension).
    // If you don't, but you load this file as a Core extension file
    // via Selenium IDE > Options > Options > 'Selenium Core extensions' instead, then
    // you need to uncomment the following statements, along with the enclosing part of if(..)
    
    // Components.utils.import( 'chrome://selite-misc/content/selite-misc.js' );
    // var loadedOddTimes= SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['doDrupalUsers'] || false;
    // if( loadedOddTimes ) { // Ignore the first load, because Se IDE somehow discards that Selenium.prototype
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        
        var storage= SeLiteData.getStorageFromSettings('extensions.selite-settings.basic.testDB');
        var module= SeLiteSettings.Module.forName('extensions.selite-settings');
        var db= new SeLiteData.Db( storage, module.getFieldsDownToFolder()['dbPrefix'] ); //@TODO Prefix to come from SeLiteSettings - through the module definition?

        var users= new SeLiteData.Table( {
           db:  db,
           name: 'users',
           columns: ['uid', 'name', 'pass', 'mail', 'theme']
        });

        var usersFormula= new SeLiteData.RecordSetFormula( {
            table: users,
            columns: new SeLiteData.Settable().set( users.name, SeLiteData.RecordSetFormula.ALL_FIELDS )
        });

        Selenium.prototype.doDrupalUsers= function( first, second) {
            console.log( 'doDrupalUsers: ' +usersFormula.select() );
        };
        Selenium.prototype.testDb= storage;
    // }
    // SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['doDrupalUsers']= !loadedOddTimes;
})();