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
        if( false ) {//@TODO Remove if we don't have any custom settings
            var useRichEditor= new SeLiteSettings.Field.Bool('useRichEditor', /*default:*/false, /*requireAndPopulate:*/false);
            commonSettings.addField( useRichEditor );
        }
        /** This depends on Serendipity.currentAuthorUsername
         * */
        Serendipity.useRichEditor= function useRichEditor() {
            //SELECT * FROM serendipity_config WHERE name='wysiwyg' AND (authorid=1 OR authorid=0) ORDER BY authorid DESC LIMIT 1
        };
        
        Selenium.prototype.serendipityEditorBodyRich= function serendipityEditorBodyRich() {
            return this.browserbot.getCurrentWindow().editorbody; // See http://xinha.raimundmeyer.de/JSdoc/Xinha/
        };
        Selenium.prototype.serendipityEditorExtendedRich= function serendipityEditorExtendedRich() {
            return this.browserbot.getCurrentWindow().editorextended;
        };
        
        Selenium.prototype.readSerendipityEditorBody= function readSerendipityEditorBody() {
            return this.useRichEditor()
                ? this.serendipityEditorBodyRich().getEditorContent()
                : serendipity[body]; // @TODO
        };
        Selenium.prototype.saveSerendipityEditorBody= function saveSerendipityEditorBody(content) {
            
        };
        Selenium.prototype.readSerendipityEditorExtended= function readSerendipityEditorExtended() {
        };
        Selenium.prototype.saveSerendipityEditorExtended= function saveSerendipityEditorExtended() {
        //serendipity[extended]
        };
        
        SeLiteSettings.setTestDbKeeper( 
            new SeLiteSettings.TestDbKeeper.Columns( {
                authors: {
                    key: 'username', // This is the logical/matching column, rather than a primary key
                    columns: ['username', 'password']
                }
            })
        );

        Serendipity.storage= SeLiteData.getStorageFromSettings();
        Serendipity.db= new SeLiteData.Db( Serendipity.storage );
        
        Serendipity.tables= {};
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
        Serendipity.formulas.authors= new SeLiteData.RecordSetFormula( {
            table: Serendipity.tables.users,
            columns: new SeLiteData.Settable().set( Serendipity.tables.authors.name/* same as 'authors' */, SeLiteData.RecordSetFormula.ALL_FIELDS )
        });
        Serendipity.tables.config= new SeLiteData.Table( {
           db:  Serendipity.db,
           name: 'config',
           columns: ['name', 'value', 'authorid'],
           primary: ['name', 'value', 'authorid']
        });
        Serendipity.formulas.config= new SeLiteData.RecordSetFormula( {
            table: Serendipity.tables.config,
            columns: new SeLiteData.Settable().set( Serendipity.tables.config.name/* same as 'config' */, SeLiteData.RecordSetFormula.ALL_FIELDS )
        });
    // }
    // SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['Serendipity']= !loadedOddTimes;
    console.warn('Serendipity fm end');
})();