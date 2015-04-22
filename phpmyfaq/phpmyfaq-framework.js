/*
 *   Copyright 2014, 2015 Peter Kehl
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
        db: new SeLiteData.Db( SeLiteData.getStorageFromSettings(), /*prefix:*/undefined, /*generateInsertKey:*/true ),
        mobileWidth: 800,
        desktopWidth: 1100,
        minDesktopWidth: 1024
    };
}
SeLiteMisc.registerOrExtendFramework( function() {
    /** @type {SeLiteSettings.Module} */
    var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
    commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor'] );
    // @TODO re-apply modified default value when I reload Selenium IDE
    // If you use ExitConfirmationChecker add-on, then set its default value to TODO: Basic or Advanced
    /*if( commonSettings.getField('exitConfirmationCheckerMode') ) {
        //commonSettings.getField('exitConfirmationCheckerMode').setDefaultKey( 'skipRevertedChanges' );
    }/**/
    phpMyFAQ.selectUserByLogin= function selectUserByLogin( givenLogin ) {
        phpMyFAQ.selectedUser= phpMyFAQ.formulas.userwithdata.selectOne( {login: givenLogin} );
        // Try login manager first. That helps when userlogin record in the test DB comes from the (initial) app DB, with encrypted password(s) rather than plain text ones.
        phpMyFAQ.selectedUser.pass= SeLiteMisc.loginManagerPassword( givenLogin );
        if( phpMyFAQ.selectedUser.pass===undefined ) {
            phpMyFAQ.selectedUser.pass= phpMyFAQ.formulas.userlogin.selectOne( {login: givenLogin} ).pass;
        }
        phpMyFAQ.selectedUser.pass!==undefined && phpMyFAQ.selectedUser.pass!=='' || SeLiteMisc.fail( "No password known for user login " +givenLogin );
    };

    SeLiteSettings.setTestDbKeeper( 
        new SeLiteSettings.TestDbKeeper.Columns( {
            userlogin: {
                key: 'login', // This is the logical/matching column, rather than a primary key
                columnsToPreserve: ['pass'],
                defaults: { pass: '' }
            }
        })
    );

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
    phpMyFAQ.tables.visits= new SeLiteData.Table( {
       db:  phpMyFAQ.db,
       name: 'visits',
       columns: ['id', 'lang', 'visits', 'last_visit'],
       primary: ['id', 'login']
    });
    phpMyFAQ.tables.categories= new SeLiteData.Table( {
       db:  phpMyFAQ.db,
       name: 'categories',
       columns: ['id', 'lang', 'parent_id', 'name', 'description', 'user_id', 'active'],
       primary: 'id'
    });
// category_user: .category_id, .user_id

    phpMyFAQ.formulas= {
        user: phpMyFAQ.tables.user.formula(),
        userdata: phpMyFAQ.tables.userdata.formula(),
        userlogin: phpMyFAQ.tables.userlogin.formula(),
        userwithdata: new SeLiteData.RecordSetFormula( {
            table: phpMyFAQ.tables.user,
            alias: 'user',
            columns: new SeLiteMisc.Settable().set(
                phpMyFAQ.tables.user.name, SeLiteData.RecordSetFormula.ALL_FIELDS
            ).set(
                phpMyFAQ.tables.userdata.name, SeLiteData.RecordSetFormula.ALL_FIELDS
            ),
            joins: [{
                table: phpMyFAQ.tables.userdata,
                alias: 'userdata',
                on: phpMyFAQ.tables.user.name+ '.user_id=userdata.user_id'
            }]
        }
        ),
        categories: new SeLiteData.RecordSetFormula( {
            table: phpMyFAQ.tables.categories,
            columns: new SeLiteMisc.Settable().set(
                phpMyFAQ.tables.categories.name, SeLiteData.RecordSetFormula.ALL_FIELDS ),
            fetchCondition: "active=1"
        })
    };
}, 'phpMyFAQ' );