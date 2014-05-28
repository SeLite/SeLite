/*
 *   Copyright 2014 Peter Kehl
# Licensed under the GPL version 2.0 license.
# See LICENSE file or
# http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
*/
"use strict";

// If you extend this framework from another file, see https://code.google.com/p/selite/wiki/TestFramework#Extending_a_test_framework
/** @type{object} A namespace-like object in the global scope.*/
var Dotclear;
if( Dotclear===undefined ) {
    Dotclear= {
        /** @type {string}*/
        selectedUsername: undefined,
        /** @type {SeLiteData.Db}*/
        db: new SeLiteData.Db( SeLiteData.getStorageFromSettings() )
    };
}
(function() {
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    console.warn('Dotclear framework loading');
    /** @type {SeLiteSettings.Module} */
    var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
    commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor'] );

    SeLiteSettings.setTestDbKeeper( 
        new SeLiteSettings.TestDbKeeper.Columns( {
            user: {
                key: 'user_name',
                columns: ['user_name', 'user_pwd']
            }
        })
    );

    Dotclear.tables= {};

    Dotclear.tables.user= new SeLiteData.Table( {
       db:  Dotclear.db,
       name: 'user',
       columns: ['user_id', 'user_super', 'user_status', 'user_pwd', 'user_change_pwd', 'user_recover_key',
           'user_name', 'user_firstname', 'user_displayname', 'user_email',
           'user_url', 'user_desc', 'user_default_blog',
           'user_options', // JSON-encoded object
           'user_lang', 'user_tz', 'user_post_status', 'user_creadt', 'user_upddt'
       ],
       primary: 'user_id' // However, for purpose of matching users I usually use user_name
    });

    Dotclear.formulas= {};
    Dotclear.formulas.user= new SeLiteData.RecordSetFormula( {
        table: Dotclear.tables.user,
        columns: new SeLiteData.Settable().set( Dotclear.tables.user.name/* same as 'user'*/, SeLiteData.RecordSetFormula.ALL_FIELDS )
    });
    console.warn('Dotclear framework loaded');
})();