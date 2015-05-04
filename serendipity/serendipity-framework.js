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

// If you extend this framework from another file, see http://selite.github.io/TestFramework#Extending_a_test_framework#Extending_a_test_framework
/** @type{object} A namespace-like object in the global scope.*/
var Serendipity;
if( Serendipity===undefined ) {
    Serendipity= {
        /** @type {string}*/
        selectedUsername: undefined,
        /** @type {SeLiteData.Db}*/
        // @TODO:
        // 1. This throws an error, therefore Serendipity stays undefined
        // 2. How to handle non-existing DB file?
        db: new SeLiteData.Db( SeLiteData.getStorageFromSettings() )
    };
}
SeLiteMisc.registerOrExtendFramework( function() {
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    console.warn('Serendipity framework loading');
        /** @type {SeLiteSettings.Module} */
        var commonSettings= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        commonSettings.getField( 'roles' ).addKeys( ['admin', 'editor', 'contributor'] );
        commonSettings.removeField( 'webRoot'); // see Serendipity.webRoot()
        console.log( 'Serendipity:' +Serendipity);
        /** This sets the user, used by Selenium.prototype.readSerendipityEditorBody() and the related functions to determine whether to use a rich editor or not.
         * @param {string} givenUsername User's username (not the role name).
         * */
        Serendipity.selectUsername= function selectUsername( givenUsername ) {
            Serendipity.selectedUsername= givenUsername;
        };
        Serendipity.selectedAuthor= function selectedAuthor() {
            return Serendipity.formulas.authors.selectOne( {username: Serendipity.selectedUsername} );
        };
        Serendipity.authorById= function authorById( authorid ) {
            return Serendipity.formulas.authors.selectOne( {authorid: authorid} );
        };
        Serendipity.entryById= function entryById( id ) {
            return Serendipity.formulas.entries.selectOne( {id: id} );
        };
        /** @return {boolean} Whether the selected user uses a WYSIWYG editor.
         * */
        Serendipity.useRichEditor= function useRichEditor() {
            return Serendipity.config('wysiwyg', true)==='true';
        };
        
        /**This retrieves a user-specific or global value of a given config field. It doesn't cache any values - it wasn't reported to be a significant bottleneck, and it will most likely never be one.
         * @param {string} name Name of the config field 
         * @param {boolean} [useSelectedUsername] If true and the user has the field configured (overriden), then this returns the value for that user. If true then this function depends on Serendipity.selectedUsername being set.
         * @return {string} Cell of 'value' column from serendipity_config, or undefined if there is no such record
         * @TODO if Serendipity team can confirm that there can only be settings that are global or only per-user, but no mixed setting (that could be specified either globally or per user), then simplify this.
         * */
        Serendipity.config= function config( name, useSelectedUsername ) {
            !useSelectedUsername || Serendipity.selectedUsername || SeLiteMisc.fail( 'Call Serendipity.selectUsername() first.' );
            var query= 'SELECT value FROM ' +Serendipity.db.storage.tablePrefix()+ "config WHERE name=:name AND ";
            query+= useSelectedUsername
                ? "(authorid=0 OR authorid=(SELECT authorid FROM " +Serendipity.tables.authors.nameWithPrefix()+ " WHERE username=:selectedUsername)) "
                : "authorid=0";
            var bindings= {
                name: name
            };
            if( useSelectedUsername ) {
                query+= " ORDER BY authorid DESC LIMIT 1";
                bindings.selectedUsername= Serendipity.selectedUsername;
            }
            console.log( 'Serendipity.config(): ' +query );
            var records= Serendipity.db.storage.select( query, bindings );
            return records.length>0
                ? records[0].value
                : undefined;
        };
        /** @TODO Implement via DbObjects & insert if the entry doesn't exist yet. Currently it only updates an existing entry in config table - it fails otherwise.
         * @param {string} name Name of the config field
         * @param {string} value Value to store
         * @param {boolean} [forUser=false] Whether it's for the currently selected user; otherwise it's a global configuration.
         *   */
        Serendipity.updateConfig= function updateConfig( name, value, forUser ) {
            !forUser || Serendipity.selectedUsername || SeLiteMisc.fail( 'Call Serendipity.selectUsername() first.' );
            var query= 'UPDATE ' +Serendipity.tables.config.nameWithPrefix()+ ' SET value=:value WHERE name=:name '+
                (forUser
                    ? 'AND authorid=(SELECT authorid FROM ' +Serendipity.tables.authors.nameWithPrefix()+ ' WHERE username=:selectedUsername)'
                    : 'AND authorid=0'
                );
            LOG.info( 'updateConfig: ' +query );
            var bindings= {
                name: name,
                value: value
            };
            if( forUser ) {
                bindings.selectedUsername= Serendipity.selectedUsername;
            }
            Serendipity.db.storage.execute( query, bindings );
        };
        
        /** @param {string} name Name of the config field (i.e. matching column serendipity_config.name).
         *  @return {string} URL to the given path, based on SeLite Settings' webRoot field and serendipity_config.value for name='indexFile' and for the passed name. Return undefined if there's no config value for indexFile or given name.
         *  @TODO this may not be needed
         * */
        Serendipity.path= function path( name ) {
            var indexFile= Serendipity.config('indexFile');
            var value= Serendipity.config(name);
            return indexFile!==undefined && value!==undefined
                ? Serendipity.webRoot()+ indexFile+value
                : undefined;
        };
        
        /** @param {boolean} [full=false] Whether it should return a full link (based on serendipity_config for name='defaultBaseURL'). Otherwise it returns an absolute link (based on serendipity_config for name='serendipityHTTPPath'.
         * @return {string} Base URL for the installation
         * */
        Serendipity.webRoot= function webRoot( full) {
            return Serendipity.config( full
                ? 'defaultBaseURL'
                : 'serendipityHTTPPath' );
        };
        
        /** Get a URL of the index file.
         *  @param {boolean} [full=false] Whether it should return a full link (based on serendipity_config for name='defaultBaseURL). Otherwise it returns an absolute link (based on serendipity_config for name='serendipityHTTPPath'.
         * @return {string} Base URL of the index file for the installation
         * */
        Serendipity.webRootIndex= function webRoot( full) {
            return Serendipity.webRoot( full )+Serendipity.config( 'indexFile' );
        };
        
        /** Generate a permalink for a given record. Similar to serendipity_makePermalink in Serendipity source, but simplified: it doesn't support day/month/year for entry and 'parentname' for category.
         *  @param {string} linkType Postfix after 'permalink', which (together with prefix 'permalink') matches serendipity_config.name for the intended type of permalink.
         * @param {object} record DB record from a relevant table, which contains any fields surrounded by a par of '%' in serendipity_config.value for the given type of permalink.
         * @param {boolean} [full=false] Whether it should return a full link (based on serendipity_config for name='defaultBaseURL'). Otherwise it returns an absolute link (based on serendipity_config for name='serendipityHTTPPath'.
         *  @return {string} Generated permalink URL for the given record and permalink type. Return undefined if there's no config value for indexFile or no config value matching given linkType.
         * */
        Serendipity.permalink= function permalink( linkType, record, full ) {
            var value= Serendipity.config( 'permalink'+linkType );
            var recordTablePerLinkType= {
                Structure: 'entry',
                AuthorStructure: 'authors',
                CategoryStructure: 'category'
            };
            var recordTable= recordTablePerLinkType[linkType];
            var fieldMatcher= /%([a-z0-9_]+)%/g;
            value= value.replace( fieldMatcher,
                function replacer(match, field) {
                    var replacement;
                    switch( field ) {
                        case 'id':
                            var idColumnPerTable= {
                                entry:'id',
                                authors:'authorid',
                                category: 'categoryid'
                            };
                            replacement= ''+record[ idColumnPerTable[recordTable] ];
                            break;
                        case 'lowertitle':
                            replacement= ( '' +record.title ).toLowerCase();
                            break;
                        case 'name':
                            recordTable==='category' || SeLiteMisc.fail("Permalink field 'name' is only available for links for records from 'category' table, but it was passed for link from table " +recordTable );
                            replacement= '' +record.category_name;
                            break;
                        case 'description':
                            recordTable==='category' || SeLiteMisc.fail("Permalink field 'description' is only available for records from 'category' table, but it was passed for link from table " +recordTable );
                            replacement= '' +record.category_description;
                            break;
                        default:
                            replacement= '' +record[field];
                    }
                    return Serendipity.makeFileName( replacement, recordTable!=='entry' );
                } );
            return value!==undefined
                ? Serendipity.webRootIndex(full)+'?/'+value
                : undefined;
        };
        
        var PAT_FILENAME= /0-9a-z\.\_!;,\+\-\%'/gi; // characters to accept as a result of makeFileName(). See PAT_FILENAME in 
        var space= / /g;
        var percent= /%/g;
        var dot= /\./g;
        var consecutiveHyphen= /-{2,}/g;
        var hyphenToTrim= /(^-+)|(-+$)/g;
        /** Treat a given filename, like serendipity_makeFilename() in Serendipity source. a bit simplified - it doesn't use i1
         * @param {string} filename Given filename
         * @param {boolean} [stripDots=false] See the same parameter of serendipity_makeFilename().
         * @return {string} Treated filename.
         */
        Serendipity.makeFileName= function makeFileName( filename, stripDots ) {
            filename= filename.replace( space, '-' ).replace( percent, '%25' );
            filename= filename.replace( PAT_FILENAME, '' );
            if( stripDots ) {
                filename= filename.replace( dot, '' );
            }
            filename= filename.replace( consecutiveHyphen, '-' );
            filename= filename.replace( hyphenToTrim, '' );
            return filename;
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
                : this.browserbot.findElement( 'name=serendipity[body]' ).value;
        };
        Selenium.prototype.saveSerendipityEditorBody= function saveSerendipityEditorBody(content) {
            if( Serendipity.useRichEditor() ) {
                //@TODO Following fails with checkout e12b998bf7 
                this.serendipityEditorBodyRich().setEditorContent( content );
            }
            else {
                this.browserbot.findElement( 'name=serendipity[body]' ).value= content;
            }
        };
        Selenium.prototype.readSerendipityEditorExtended= function readSerendipityEditorExtended() {
            return Serendipity.useRichEditor()
                ? this.serendipityEditorExtendedRich().getEditorContent()
                : this.browserbot.findElement( 'name=serendipity[extended]' ).value;
        };
        Selenium.prototype.saveSerendipityEditorExtended= function saveSerendipityEditorExtended( content ) {
            if( Serendipity.useRichEditor() ) {
                this.serendipityEditorExtendedRich().setEditorContent( content );
            }
            else {
                this.browserbot.findElement( 'name=serendipity[extended]' ).value= content;
            }
        };
        
        SeLiteSettings.setTestDbKeeper( 
            new SeLiteSettings.TestDbKeeper.Columns( {
                authors: {
                    key: 'username', // This is the logical/matching column, rather than a primary key
                    columnsToPreserve: ['password'],
                    defaults: { password: '' }
                }
            })
        );
        
        Serendipity.tables= {};
        Serendipity.formulas= {};
        
        /** @type {SeLiteData.Table} */
        Serendipity.tables.authors= new SeLiteData.Table( {
           db:  Serendipity.db,
           name: 'authors',
           columns: ['authorid', 'realname', 'username', 'password',
               'mail_comments', 'mail_trackbacks', 'email',
               'userlevel', 'right_publish', 'hashtype'
           ],
           primary: 'authorid' // However, for purpose of matching users I usually use 'username'
        });
        /** @type {SeLiteData.RecordSetFormula} */
        Serendipity.formulas.authors= Serendipity.tables.authors.formula();
        
        /** @type {SeLiteData.Table} */
        Serendipity.tables.config= new SeLiteData.Table( {
           db:  Serendipity.db,
           name: 'config',
           columns: ['name', 'value', 'authorid'],
           primary: ['name', 'value', 'authorid']
        });
        /** @type {SeLiteData.RecordSetFormula} */
        Serendipity.formulas.config= Serendipity.tables.config.formula();
        
        /** @type {SeLiteData.Table} */
        Serendipity.tables.entries= new SeLiteData.Table( {
            db: Serendipity.db,
            name: 'entries',
            columns: ['id', 'title',
                'timestamp', // number of seconds since Unix epoch, as returned by PHP function time()
                'body', 'comments', 'trackbacks', 'extended', 'exflag',
                'author', // authors.username
                'authorid', // authors.authorid
                'isdraft', 'allow_comments', 'last_modified', 'moderate_comments'
            ],
            primary: 'id'
        });
        Serendipity.tables.authorgroups= new SeLiteData.Table( {
           db:  Serendipity.db,
           name: 'authorgroups',
           columns: ['groupid', 'authorid'],
           primary: ['groupid', 'authorid']
        });

        /** @type {SeLiteData.RecordSetFormula} */
        Serendipity.formulas.entries= Serendipity.tables.entries.formula();
    console.warn('Serendipity framework loaded');
}, 'Serendipity' );
