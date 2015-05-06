/*  Copyright 2013, 2014 Peter Kehl
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
/** @type{object} A namespace-like object in the global scope.*/
var Drupal;
if( Drupal===undefined ) {
    Drupal= {
        /** @type {SeLiteData.Db}*/
        db: new SeLiteData.Db( SeLiteData.getStorageFromSettings() )
    };
}

SeLiteMisc.registerOrExtendFramework(
    function() {
            var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;

            var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
            commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor', 'contributor'] );

            SeLiteSettings.setTestDbKeeper( 
                new SeLiteSettings.TestDbKeeper.Columns( {
                    users: {
                        key: 'name',
                        columnsToPreserve: ['pass'],
                        defaults: { pass: '' }
                    }
                })
            );

            Drupal.tables= {};

            Drupal.tables.users= new SeLiteData.Table( {
               db:  Drupal.db,
               name: 'users',
               columns: ['uid', 'name'/*login*/, 'pass', 'mail', 'theme', 'signature', 'signature_format',
                   'created', 'access', 'login', // timestamps in seconds since Epoch
                   'status', 'timezone', 'language', 'picture', 'init', 'data'
               ],
               primary: 'uid' // However, for purpose of matching users I usually use name
            });

            Drupal.formulas= {};
            Drupal.formulas.users= Drupal.tables.users.formula();

            Drupal.tables.node= new SeLiteData.Table( {
               db:  Drupal.db,
               name: 'node',
               columns: ['nid', 'vid', 'type', 'language', 'title', 'uid', 'status',
                   'created', 'changed',
                   'comment', 'promote', 'sticky', 'tnid', 'translate'
               ],
               primary: 'nid'
            });

            Drupal.tables.field_data_body= new SeLiteData.Table( {
                db: Drupal.db,
                name: 'field_data_body',
                columns: ['entity_type', 'bundle', 'deleted', 'entity_id', 'revision_id', 'language', 'delta', 'body_value', 'body_sumary', 'body_format'],
                primary: ['entity_type', 'entity_id', 'deleted', 'delta', 'language']
            });

            // Can't use: return selenium.browserbot.getCurrentWindow().location.href
            // - it's only available when implementing Selenese
            /** Get node ID of the current page, if applicable.
             *  @param {Window} window It must be passed from your test case.
             *  @return {(number|null)} ID of the node, or null.
             * */
            Drupal.currentPageNodeId= function currentPageNodeId(window) {
                var href= window.location.href;
                var match= href.match( /\/?q=node\/([0-9]+)/ );
                if( match ) {
                    return match[1];
                }
                return null;
            };
    }
);