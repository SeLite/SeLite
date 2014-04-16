/*  Copyright 2014 Peter Kehl
 (BSD licensed)
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
*/
"use strict";

// Following is a namespace-like object in the global scope.
var Serendipity= {
    currentAuthorUsername: undefined
};

(function() {
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    console.warn('Serendipity fm start');
    // @TODO Doc
    // I suggest that you load this file via SeLite Bootstrap (Selenium IDE > Options > Options > SeLite Bootstrap > Selenium Core extension).
    // If you don't, but you load this file as a Core extension file
    // via Selenium IDE > Options > Options > 'Selenium Core extensions' instead, then
    // you need to uncomment the following statements, along with the enclosing part of if(..)

    // Components.utils.import( 'chrome://selite-misc/content/SeLiteMisc.js' );
    // var loadedOddTimes= SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['Serendipity'] || false;
    // if( loadedOddTimes ) { // Ignore the first load, because Se IDE somehow discards that Selenium.prototype

    // Do not pre-load any data here. SeLiteData.getStorageFromSettings() doesn't connect to SQLite,
    // until you open/save a test suite. That's because it needs to know the test suite folder
    // in order to resolve Settings field here. Test suite folder is not known when this is loaded,
    // however SeLiteData.getStorageFromSettings() sets a handler via SeLiteSettings.addTestSuiteFolderChangeHandler().
    // Once you open/save a test suite, storage object will get updated automatically and it will open an SQLite connection.
        var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor', 'contributor'] );
        
        /** This sets the user, used by Selenium.prototype.readSerendipityEditorBody() and the related functions to determine whether to use a rich editor or not.
         * @param {string} givenUser User's username (not the role name).
         * */
        Serendipity.selectUsername= function selectUsername( givenUsername ) {
            Serendipity.selectedUsername= givenUsername;
        };
        /** This depends on Serendipity.currentAuthorUsername
         * */
        Serendipity.useRichEditor= function useRichEditor() {
            Serendipity.selectedUsername || SeLiteMisc.fail( 'Call Serendipity.selectUsername() first.' );
            var query= 'SELECT value FROM ' +Serendipity.storage.tablePrefixValue+ "config WHERE name='wysiwyg' AND (authorid=0 OR authorid=(SELECT authorid FROM " +Serendipity.storage.tablePrefixValue+ "authors WHERE username=:selectedUsername)) ORDER BY authorid DESC LIMIT 1";
            console.log( 'useRichEditor: ' +query ); //@TODO extract result:
            return Serendipity.storage.selectOne( query, undefined, {selectedUsername: Serendipity.selectedUsername} ).value==='true';
        };
        
        Selenium.prototype.serendipityEditorBodyRich= function serendipityEditorBodyRich() {
            return this.browserbot.getCurrentWindow().editorbody; // See http://xinha.raimundmeyer.de/JSdoc/Xinha/
        };
        Selenium.prototype.serendipityEditorExtendedRich= function serendipityEditorExtendedRich() {
            return this.browserbot.getCurrentWindow().editorextended;
        };
        
        Selenium.prototype.readSerendipityEditorBody= function readSerendipityEditorBody() {
            return Serendipity.useRichEditor()
                ? this.serendipityEditorBodyRich().getEditorContent()
                : this.page().findElement( 'serendipity[body]' ).value;
        };
        Selenium.prototype.saveSerendipityEditorBody= function saveSerendipityEditorBody(content) {
            if( Serendipity.useRichEditor() ) {
                this.serendipityEditorBodyRich().setEditorContent( content );
            }
            else {
                this.page().findElement( 'serendipity[body]' ).value= content;
            }
        };
        Selenium.prototype.readSerendipityEditorExtended= function readSerendipityEditorExtended() {
            return Serendipity.useRichEditor()
                ? this.serendipityEditorExtendedRich().getEditorContent()
                : this.page().findElement( 'serendipity[extended]' ).value;
        };
        Selenium.prototype.saveSerendipityEditorExtended= function saveSerendipityEditorExtended( content ) {
            if( Serendipity.useRichEditor() ) {
                this.serendipityEditorExtendedRich().setEditorContent( content );
            }
            else {
                this.page().findElement( 'serendipity[extended]' ).value= content;
            }
        };
        
        SeLiteSettings.setTestDbKeeper( 
            new SeLiteSettings.TestDbKeeper.Columns( {
                authors: {
                    key: 'username', // This is the logical/matching column, rather than a primary key
                    columns: ['username', 'password']
                }
            })
        );
        /** @type {SeLiteData.Storage}*/
        Serendipity.storage= SeLiteData.getStorageFromSettings();
        Serendipity.db= new SeLiteData.Db( Serendipity.storage );
        
        Serendipity.tables= {};
        /** @type {SeLiteData.Table} */
        Serendipity.tables.authors= new SeLiteData.Table( {
           db:  Serendipity.db,
           name: 'authors',
           columns: ['authorid', 'realname', 'username', 'password',
               'mail_comments', 'mail_trackbacks', 'email',
               'userlevel', 'right_publish', 'hashtype'
           ],
           primary: 'authorid' // However, for purpose of matching users I usually use 'login'
        });
        Serendipity.formulas= {};
        /** @type {SeLiteData.RecordSetFormula} */
        Serendipity.formulas.authors= new SeLiteData.RecordSetFormula( {
            table: Serendipity.tables.users,
            columns: new SeLiteData.Settable().set( Serendipity.tables.authors.name/* same as 'authors' */, SeLiteData.RecordSetFormula.ALL_FIELDS )
        });
        /** @type {SeLiteData.Table} */
        Serendipity.tables.config= new SeLiteData.Table( {
           db:  Serendipity.db,
           name: 'config',
           columns: ['name', 'value', 'authorid'],
           primary: ['name', 'value', 'authorid']
        });
        /** @type {SeLiteData.RecordSetFormula} */
        Serendipity.formulas.config= new SeLiteData.RecordSetFormula( {
            table: Serendipity.tables.config,
            columns: new SeLiteData.Settable().set( Serendipity.tables.config.name/* same as 'config' */, SeLiteData.RecordSetFormula.ALL_FIELDS )
        });
    // }
    // SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['Serendipity']= !loadedOddTimes;
    console.warn('Serendipity fm end');
})();