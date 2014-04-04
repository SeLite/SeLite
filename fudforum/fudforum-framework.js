/*  Copyright 2014 Peter Kehl
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

// Following is a namespace-like object in the global scope.
var FUDforum= {};

(function() {
    // @TODO Doc
    // I suggest that you load this file via SeLite Bootstrap (Selenium IDE > Options > Options > SeLite Bootstrap > Selenium Core extension).
    // If you don't, but you load this file as a Core extension file
    // via Selenium IDE > Options > Options > 'Selenium Core extensions' instead, then
    // you need to uncomment the following statements, along with the enclosing part of if(..)

    // Components.utils.import( 'chrome://selite-misc/content/SeLiteMisc.js' );
    // var loadedOddTimes= SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['doFUDforumUsers'] || false;
    // if( loadedOddTimes ) { // Ignore the first load, because Se IDE somehow discards that Selenium.prototype

    // Do not pre-load any data here. SeLiteData.getStorageFromSettings() doesn't connect to SQLite,
    // until you open/save a test suite. That's because it needs to know the test suite folder
    // in order to resolve Settings field here. Test suite folder is not known when this is loaded,
    // however SeLiteData.getStorageFromSettings() sets a handler via SeLiteSettings.addTestSuiteFolderChangeHandler().
    // Once you open/save a test suite, storage object will get updated automatically and it will open an SQLite connection.

        var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor', 'contributor'] );

        SeLiteSettings.setTestDbKeeper( 
            new SeLiteSettings.TestDbKeeper.Columns( {
                users: {
                    key: 'login', // This is the logical/matching column, rather then a primary key
                    columns: ['login', 'passwd']
                }
            })
        );

        FUDforum.storage= SeLiteData.getStorageFromSettings();
        FUDforum.db= new SeLiteData.Db( FUDforum.storage );
        
        FUDforum.tables= {};
        FUDforum.tables.users= new SeLiteData.Table( {
           db:  FUDforum.db,
           name: 'users',
           columns: ['id', 'login', 'alias', 'passwd', 'salt', 'name', 'email',
               'location', 'interests', 'occupation', 'avatar', 'avatar_loc',
               'icq', 'aim', 'yahoo', 'msnm', 'jabber', 'affero', 'google', 'skype', 'twitter',
               'posts_ppg', 'time_zone', 'birthday'
           ],
           primary: 'id' // However, for purpose of matching users I usually use 'login'
        });
        FUDforum.formulas= {};
        FUDforum.formulas.users= new SeLiteData.RecordSetFormula( {
            table: FUDforum.tables.users,
            columns: new SeLiteData.Settable().set( FUDforum.tables.users.name/* same as 'users' */, SeLiteData.RecordSetFormula.ALL_FIELDS )
        });
        /*@TODO
        FUDforum.tables.node= new SeLiteData.Table( {
           db:  FUDforum.db,
           name: 'node',
           columns: ['nid', 'vid', 'type', 'language', 'title', 'uid', 'status',
               'created', 'changed',
               'comment', 'promote', 'sticky', 'tnid', 'translate'
           ],
           primary: 'nid'
        });
        
        FUDforum.tables.field_data_body= new SeLiteData.Table( {
            db: FUDforum.db,
            name: 'field_data_body',
            columns: ['entity_type', 'bundle', 'deleted', 'entity_id', 'revision_id', 'language', 'delta', 'body_value', 'body_sumary', 'body_format'],
            primary: '@TODO group of columns'
        });*/
    // }
    // SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['doFUDforumUsers']= !loadedOddTimes;
})();