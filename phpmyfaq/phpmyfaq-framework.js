/*
 *   Copyright 2014 Peter Kehl
* This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.*/
"use strict";

// If you extend this framework from another file, see https://code.google.com/p/selite/wiki/TestFramework#Extending_a_test_framework
/** @type{object} A namespace-like object in the global scope.*/
var phpMyFAQ;
if( phpMyFAQ===undefined ) {
    phpMyFAQ= {
        /** @type {object} As loaded from 'user' table, with 'pass' field loaded from 'userlogin' table. */
        selectedUser: undefined,
        /** @type {SeLiteData.Db}*/
        db: new SeLiteData.Db( SeLiteData.getStorageFromSettings() )
    };
}
(function() {
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    console.warn('phpMyFAQ framework loading');
    /** @type {SeLiteSettings.Module} */
    var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
    commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor'] );
    // @TODO re-apply modified default value when I reload Selenium IDE
    // If you use ExitConfirmationChecker add-on, then set its default value to TODO: Basic or Advanced
    /*if( commonSettings.getField('exitConfirmationCheckerMode') ) {
        //commonSettings.getField('exitConfirmationCheckerMode').setDefaultKey( 'skipRevertedChanges' );
    }/**/

    phpMyFAQ.selectUserByLogin= function selectUserByLogin( givenLogin ) {
        phpMyFAQ.selectedUser= phpMyFAQ.formulas.user.selectOne( {login: givenLogin} );
        phpMyFAQ.selectedUser.pass= phpMyFAQ.formulas.userlogin.selectOne( {login: givenLogin} ).pass;
    };

        phpMyFAQ.tables= {};
        phpMyFAQ.tables.user= new SeLiteData.Table( {
           db:  phpMyFAQ.db,
           name: 'user',
           columns: ['user_id', 'login', 'session_id', 'session_timestamp', 'ip', 'account_status', 'last_login', 'auth_source', 'member_since', 'remember_me', 'success'
           ],
           primary: 'user_id' // However, for purpose of matching users I usually use 'login'
        });
        phpMyFAQ.tables.userdata= new SeLiteData.Table( {
           db:  phpMyFAQ.db,
           name: 'userdata',
           columns: ['user_id', 'last_modified', 'display_name', 'email'
           ],
           primary: 'user_id'
        });
        phpMyFAQ.tables.userlogin= new SeLiteData.Table( {
           db:  phpMyFAQ.db,
           name: 'userlogin',
           columns: ['login', 'pass'
           ],
           primary: 'login'
        });
        phpMyFAQ.tables.user_group= new SeLiteData.Table( {
           db:  phpMyFAQ.db,
           name: 'user_group',
           columns: ['user_id', 'group_id'],
           primary: ['user_id', 'group_id']//@TODO implement?
        });
        phpMyFAQ.tables.user_right= new SeLiteData.Table( {
           db:  phpMyFAQ.db,
           name: 'user_right',
           columns: ['user_id', 'right_id'],
           primary: ['user_id', 'right_id']
        });
        phpMyFAQ.tables.faqvisits= new SeLiteData.Table( {
           db:  phpMyFAQ.db,
           name: 'faqvisits',
           columns: ['id', 'lang', 'visits', 'last_visit'],
           primary: ['id', 'login']
        });
        
        phpMyFAQ.formulas= {
            user: phpMyFAQ.tables.user.formula(),
            userlogin: phpMyFAQ.tables.userlogin.formula()
        };
        console.warn('phpMyFaq framework loaded');
})();