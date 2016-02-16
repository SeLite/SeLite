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

// If you extend this framework from another file, see http://selite.github.io/GeneralFramework#extending-a-test-framework
/** @type {object} A namespace-like object in the global scope.*/
var FUDforum;
if( FUDforum===undefined ) {
    FUDforum= {
        /** @type {SeLiteData.Db}*/
        db: new SeLiteData.Db( SeLiteData.getStorageFromSettings() )
    };
}

SeLiteMisc.registerOrExtendFramework(
    function() {
            var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
            commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor', 'contributor'] );

            SeLiteSettings.setTestDbKeeper( 
                new SeLiteSettings.TestDbKeeper.Columns( {
                    users: {
                        key: 'login', // This is the logical/matching column, rather then a primary key
                        columnsToPreserve: ['passwd'],
                        defaults: { passwd: '' }
                    }
                })
            );

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
            FUDforum.formulas.users= FUDforum.tables.users.formula();
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
    }
);