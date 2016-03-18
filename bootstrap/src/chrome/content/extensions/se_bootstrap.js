/*  Copyright 2012, 2013, 2014, 2015, 2016 Peter Kehl
    This file is part of SeLite Bootstrap.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";
/** @param {object} global Global object, as per https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects. Its value is value of operator 'this'. I need it, so that I can call loadSubScript() with charset set to 'UTF-8'.
 * */
(function(global) { // Anonymous function separates local variables from Selenium Core scope
    var loadedTimes= SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteBootstrap'] || 0;
    if( loadedTimes===1 ) { // Ignore the first load, because Se IDE somehow discards that Selenium.prototype. So set up the overrides on 2nd load.
        
        /** @var Object serving as an associative array [string file path] => int lastModifiedTime
         **/
        Selenium.bootstrapScriptLoadTimestamps= {};
        var FileUtils= Components.utils.import("resource://gre/modules/FileUtils.jsm", {} ).FileUtils;
        var Services= Components.utils.import("resource://gre/modules/Services.jsm", {} ).Services;
        /** There are two sets of events when we want to call reloadScripts(), which are handled separately:
            - executing a single test command / run a testcase / run each testcase in a testsuite. Handled by tail-intercept of Selenium.prototype.reset() below.
            - run a testcase/testsuite, pause it (or not), modify a file loaded via SeBootstrap (and make the test continue if you paused it earlier), SeBootstrap will not re-trigger Selenium.prototype.reset() (until next run of a single command/testcase/testsuite). That's handled by TestCaseDebugContext.prototype.nextCommand(). This function is defined in sister extension: testcase-debug-context. Then it's intercepted in SelBlocks Global.
        */
        // Tail intercept of Selenium.reset().
          var origReset = Selenium.prototype.reset;

          Selenium.prototype.reset= function reset() {
          // @TODO Use interceptBefore() from SelBlocks - if SelBlocksGlobal stays as a part of SeLite
                Selenium.bootstrapReloadScripts();
                origReset.call(this);
          };

        var /*@TODO const*/ subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                .getService(Components.interfaces.mozIJSSubScriptLoader);

        var bootstrappedListChanged= false;
        var bootstrappedCoreExtensions= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' ).getField( 'bootstrappedCoreExtensions' );
        var bootstrappedCoreExtensionsRecord; // This will be a result of bootstrappedCoreExtensions.getDownToFolder(..). It will be cached, and re-loaded when bootstrappedListChanged is true.
        /*** This (re)loads and processes any updated custom .js file(s) - either if they were not loaded yet,
         *   or if they were modified since then. It also reloads them if their timestamp changed, but the contents didn't
         *   - no harm in that.
         */
        Selenium.bootstrapReloadScripts= function bootstrapReloadScripts() {
            editor.seleniumAPI.Selenium= Selenium;
            editor.seleniumAPI.LOG= LOG;

            if( bootstrappedListChanged || bootstrappedCoreExtensionsRecord===undefined ) {
                bootstrappedCoreExtensionsRecord= bootstrappedCoreExtensions.getDownToFolder( /*folderPath*/undefined, /*dontCache*/true );
                bootstrappedListChanged= false;
            }
            
            var files= {}; // { string filePath: nsIFile object } for all bootstrapped files
            var anyFileNewOrModified= false;
            for( var filePath in bootstrappedCoreExtensionsRecord.entry ) {
                try {
                    files[filePath]= new FileUtils.File(filePath); // Object of class nsIFile
                }
                catch( exception ) {
                    LOG.warn( "SeBootstrap tried to (re)load a non-existing file " +filePath );
                    continue;
                }
                anyFileNewOrModified|= !(filePath in Selenium.bootstrapScriptLoadTimestamps) || Selenium.bootstrapScriptLoadTimestamps[filePath]!==files[filePath].lastModifiedTime;
            }
            if( anyFileNewOrModified ) {
                for( var filePath in files ) { // Reload all files, not just the modified one(s). That allows dependant files to maintain their book keeping.
                    // Let's set the timestamp before loading & executing the file. This ensures that if something goes wrong in that file, it won't be re-run
                    // until it's updated (or until you reload Selenium IDE).
                    Selenium.bootstrapScriptLoadTimestamps[filePath]= files[filePath].lastModifiedTime;

                    var fileUrl= Services.io.newFileURI( files[filePath] );
                    try {
                        // When I passed editor.seleniumAPI, then bootstrapped extension must have defined global variables (without _var_ keyword) and therefore it couldn't use Javascript strict mode.
                        subScriptLoader.loadSubScriptWithOptions( fileUrl.spec, {
                            target: global,
                            charset: 'UTF-8',
                            ignoreCache: true
                        } );
                        // This could also be done via Components.utils.import( tmpFileUrl.spec, scope ) and Components.utils.unload(url). However, the .js file would have to define var EXPORTED_SYMBOLS= ['symbol1', 'symbol2', ...];
                    }
                    catch(error ) {
                        var msg= "SeBootstrap tried to evaluate " +filePath+ " and it failed with:\n"
                            +SeLiteMisc.addStackToMessage( error, true )+ '.';
                        SeLiteMisc.log().error( msg );
                    }
                }
            }
        };
        
        SeLiteSettings.setBootstrappedListAsChanged= function setBootstrappedListAsChanged() {
            bootstrappedListChanged= true;
        };
        
        SeLiteSettings.addTestSuiteFolderChangeHandler( SeLiteSettings.setBootstrappedListAsChanged );
    }
    if( loadedTimes>=2 ) {
        throw new Error('SeLiteBootstrap already loaded ' +loadedTimes );
    }
    SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteBootstrap']= loadedTimes+1;
})(this);