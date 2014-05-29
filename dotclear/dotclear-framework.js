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

    /** This sets the user, used by Selenium.prototype.readDotclearEditorBody() and the related functions to determine whether to use a rich editor or not.
     * @param {string} givenUser User's username (not the role name).
     * */
    Dotclear.selectUsername= function selectUsername( givenUsername ) {
        Dotclear.selectedUsername= givenUsername;
    };
    Dotclear.selectedUser= function selectedUser() {
        return Dotclear.formulas.user.selectOne( {user_name: Dotclear.selectedUsername} );
    };
    Dotclear.userById= function userById( user_id ) {
        return Dotclear.formulas.author.selectOne( {user_id: user_id} );
    };
    Dotclear.postById= function postById( id ) {
        return Dotclear.formulas.post.selectOne( {post_id: id} );
    };
    /** @return {boolean} Whether the selected user uses a WYSIWYG editor.
     * */
    Dotclear.useRichEditor= function useRichEditor() {
        return Dotclear.config('wysiwyg', true)==='true';
    };

    /**This retrieves a user-specific or global value of a given config field. It doesn't cache any values - it wasn't reported to be a significant bottleneck, and it will most likely never be one.
     * @param {string} name Name of the config field 
     * @param {boolean} [useSelectedUsername] If true and the user has the field configured (overriden), then this returns the value for that user. If true then this function depends on Dotclear.selectedUsername being set.
     * @return {string} Cell of 'value' column from serendipity_config, or undefined if there is no such record
     * @TODO if Dotclear team can confirm that there can only be settings that are global or only per-user, but no mixed setting (that could be specified either globally or per user), then simplify this.
     * */
    Dotclear.config= function config( name, useSelectedUsername ) {
        !useSelectedUsername || Dotclear.selectedUsername || SeLiteMisc.fail( 'Call Dotclear.selectUsername() first.' );
        var query= 'SELECT value FROM ' +Dotclear.db.storage.tablePrefixValue+ "config WHERE name=:name AND ";
        query+= useSelectedUsername
            ? "(authorid=0 OR authorid=(SELECT authorid FROM " +Dotclear.tables.authors.nameWithPrefix()+ " WHERE username=:selectedUsername)) "
            : "authorid=0";
        var bindings= {
            name: name
        };
        if( useSelectedUsername ) {
            query+= " ORDER BY authorid DESC LIMIT 1";
            bindings.selectedUsername= Dotclear.selectedUsername;
        }
        console.log( 'Dotclear.config(): ' +query );
        var records= Dotclear.db.storage.select( query, bindings );
        return records.length>0
            ? records[0].value
            : undefined;
    };
    /** @TODO Implement via DbObjects & insert if the entry doesn't exist yet. Currently it only updates an existing entry in config table - it fails otherwise.
     * @param {string} name Name of the config field
     * @param {string} value Value to store
     * @param {boolean} [forUser=false] Whether it's for the currently selected user; otherwise it's a global configuration.
     *   */
    Dotclear.updateConfig= function updateConfig( name, value, forUser ) {
        !forUser || Dotclear.selectedUsername || SeLiteMisc.fail( 'Call Dotclear.selectUsername() first.' );
        var query= 'UPDATE ' +Dotclear.tables.config.nameWithPrefix()+ ' SET value=:value WHERE name=:name '+
            (forUser
                ? 'AND authorid=(SELECT authorid FROM ' +Dotclear.tables.authors.nameWithPrefix()+ ' WHERE username=:selectedUsername)'
                : 'AND authorid=0'
            );
        LOG.info( 'updateConfig: ' +query );
        var bindings= {
            name: name,
            value: value
        };
        if( forUser ) {
            bindings.selectedUsername= Dotclear.selectedUsername;
        }
        Dotclear.db.storage.execute( query, bindings );
    };

    SeLiteSettings.setTestDbKeeper( 
        new SeLiteSettings.TestDbKeeper.Columns( {
            user: {
                key: 'user_id',
                columns: ['user_id', 'user_pwd', 'user_options'],
                defaults: {
                    user_options: JSON.stringify({})
                }
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
    Dotclear.formulas.user= new SeLiteData.RecordSetFormula( {
        table: Dotclear.tables.user,
        columns: new SeLiteData.Settable().set( Dotclear.tables.user.name/* same as 'user'*/, SeLiteData.RecordSetFormula.ALL_FIELDS )
    });
    
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
    Dotclear.formulas.post= new SeLiteData.RecordSetFormula( {
        table: Dotclear.tables.post,
        columns: new SeLiteData.Settable().set( Dotclear.tables.post.name/* same as 'post'*/, SeLiteData.RecordSetFormula.ALL_FIELDS )
    });
    
    console.warn('Dotclear framework loaded');
})();