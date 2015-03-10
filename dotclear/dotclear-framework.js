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
        selectedUserId: undefined,
        /** @type {SeLiteData.Db}*/
        db: new SeLiteData.Db( SeLiteData.getStorageFromSettings() )
    };
}
SeLiteMisc.registerOrExtendFramework(
    function() {
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        console.warn('Dotclear framework loading');
        /** @type {SeLiteSettings.Module} */
        var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor'] );
        // @TODO?!! re-apply modified default value of exitConfirmationCheckerMode when I reload Selenium IDE
        // If you use ExitConfirmationChecker add-on, then set its default value to TODO: Basic or Advanced
        // Check whether exitConfirmationChecker is present. If so, set its default mode
        if( commonSettings.getField('exitConfirmationCheckerMode') ) {
            //commonSettings.getField('exitConfirmationCheckerMode').setDefaultKey( 'skipRevertedChanges' );
        }


        /** This sets the user, used by Selenium.prototype.readDotclearEditorBody() and the related functions to determine whether to use a rich editor or not.
         * @param {string} givenUser User's user_id (not the role name).
         * */
        Dotclear.selectUserId= function selectUserId( givenUserId ) {
            Dotclear.selectedUserId= givenUserId;
        };
        Dotclear.selectedUser= function selectedUser() {
            Dotclear.selectedUserId || SeLiteMisc.fail( 'Call Dotclear.selectUserId() first.' );
            return Dotclear.userById( Dotclear.selectedUserId );
        };
        Dotclear.userById= function userById( user_id ) {
            return Dotclear.formulas.user.selectOne( {user_id: user_id} );
        };
        Dotclear.postById= function postById( id ) {
            return Dotclear.formulas.post.selectOne( {post_id: id} );
        };
        /** @return {boolean} Whether the selected user uses a WYSIWYG editor.
         * */
        Dotclear.useRichEditor= function useRichEditor() {
            return Dotclear.config('wysiwyg', true)==='true';
        };

        /**This retrieves user-specific options, stored in JSON notation (as opposed to PHP serialized form in Dotclear app DB).
         * @return {object} Object parsed from user.user_options. Containing zero, one or more entries with option names as in user.user_options (which slightly differs to option names used in form on /admin/preferences.php#user-options):
         * edit_size int
         * enable_wysiwyg bool
         * post_format string - either 'xhtml' or 'wiki'
         * tag_list_format string - either 'more' (its label is 'Short') or 'all (label is 'Extended')
         * */
        Dotclear.userOptions= function userOptions() {
            Dotclear.selectedUserId || SeLiteMisc.fail( 'Call Dotclear.selectUserId() first.' );
            var query= 'SELECT user_options FROM ' +Dotclear.db.storage.tablePrefix()+ "user WHERE user_id=:user_id";
            return JSON.parse( Dotclear.db.storage.selectOne( query, {user_id: Dotclear.selectedUserId} ).user_options );
        };

        /**This updates user-specific options, stored in JSON notation (as opposed to PHP serialized form in Dotclear app DB).
         * @param {object} options Object to be in JSON notation in user.user_options. It replaces previous user.user_options - it doesn't add/merge the old and new object.
         * */
        Dotclear.updateUserOptions= function updateUserOptions( options ) {
            Dotclear.selectedUserId || SeLiteMisc.fail( 'Call Dotclear.selectUserId() first.' );
            var query= 'UPDATE ' +Dotclear.db.storage.tablePrefix()+ "user SET user_options=:user_options WHERE user_id=:user_id";
            Dotclear.db.storage.execute( query, {
                user_id: Dotclear.selectedUserId,
                user_options: JSON.stringify(options)
            } );
        };

        /** This updates the given option within existing user.user_options. If value is undefined, then it removes that option.
         * @param {string} option Option name.
         * @param {(string|number)} value Option value.
         * */
        Dotclear.updateUserOption= function updateUserOption( option, value ) {
            var options= Dotclear.userOptions();
            options[ option ]= value;
            Dotclear.updateUserOptions( options );
        };

        /** @TODO Implement via DbObjects & insert if the entry doesn't exist yet. Currently it only updates an existing entry in config table - it fails otherwise.
         * @param {string} name Name of the config field
         * @param {string} value Value to store
         * @param {boolean} [forUser=false] Whether it's for the currently selected user; otherwise it's a global configuration.
         *   */
        Dotclear.updateConfig= function updateConfig( name, value, forUser ) {
            !forUser || Dotclear.selectedUserId || SeLiteMisc.fail( 'Call Dotclear.selectUserId() first.' );
            var query= 'UPDATE ' +Dotclear.tables.config.nameWithPrefix()+ ' SET value=:value WHERE name=:name '+
                (forUser
                    ? 'AND authorid=(SELECT authorid FROM ' +Dotclear.tables.authors.nameWithPrefix()+ ' WHERE user_id=:selectedUserId)'
                    : 'AND authorid=0'
                );
            LOG.info( 'updateConfig: ' +query );
            var bindings= {
                name: name,
                value: value
            };
            if( forUser ) {
                bindings.selectedUserId= Dotclear.selectedUserId;
            }
            Dotclear.db.storage.execute( query, bindings );
        };

        SeLiteSettings.setTestDbKeeper( 
            new SeLiteSettings.TestDbKeeper.Columns( {
                user: {
                    key: 'user_id',
                    columnsToPreserve: ['user_pwd', 'user_options'],
                    defaults: { user_options: JSON.stringify({}) }
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
               'user_options', // In app DB it's a result of PHP serialize(). In test DB it's a result of JSON.stringify().
               'user_lang', 'user_tz', 'user_post_status', 'user_creadt', 'user_upddt'
           ],
           primary: 'user_id'
        });

        Dotclear.formulas= {};
        Dotclear.formulas.user= Dotclear.tables.user.formula();

        Dotclear.tables.post= new SeLiteData.Table( {
            db: Dotclear.db,
            name: 'post',
            columns: ['post_id', 'blog_id', 'user_id', 'cat_id', 'post_dt',
                'post_tz', 'post_creadt', 'post_upddt',
                'post_password', 'post_type', 'post_format',
                'post_url', 'post_lang', 'post_title', 'post_excerpt', 'post_excerpt_xhtml',
                'post_content', 'post_content_xhtml', 'post_notes',
                'post_meta', 'post_words', 'post_status', 'post_selected',
                'post_position', 'post_open_comment', 'post_open_tb',
                'nb_comment', 'nb_trackback'],
            primary: 'post_id'
        });
        Dotclear.formulas.post= Dotclear.tables.post.formula();

        console.warn('Dotclear framework loaded');
    }
);