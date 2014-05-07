/*  Copyright 2012, 2013, 2014 Peter Kehl
    This file is part of SeLite Bootstrap.

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
/** @param {object} global Global object, as per https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects. Its value is value of operator 'this'. I need it, so that I can call loadSubScript() with charset set to 'UTF-8'.
 * */
(function(global) { // Anonymous function separates local variables from Selenium Core scope
    Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js" );
    var loadedOddTimes= SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['doFUDforumUsers'] || false;
    if( loadedOddTimes ) { // Ignore the first load, because Se IDE somehow discards that Selenium.prototype
        
        /** @var Object serving as an associative array [string file path] => int lastModifiedTime
         **/
        Selenium.scriptLoadTimestamps= {};
        ;
        var FileUtils= Components.utils.import("resource://gre/modules/FileUtils.jsm", {} ).FileUtils;
        var Services= Components.utils.import("resource://gre/modules/Services.jsm", {} ).Services;
        Components.utils.import( 'chrome://selite-settings/content/SeLiteSettings.js' );

        /** There are two sets of events when we want to call reloadScripts(), which are handled separately:
            - executing a single test command / run a testcase / run each testcase in a testsuite. Handled by tail-intercept of Selenium.prototype.reset() below.
            - run a testcase/testsuite, pause it (or not), modify a file loaded via SeBootstrap (and make the test continue if you paused it earlier), SeBootstrap will not re-trigger Selenium.prototype.reset() (until next run of a single command/testcase/testsuite). That's handled by TestCaseDebugContext.prototype.nextCommand(). This function is defined in sister extension: testcase-debug-context. Then it's intercepted in sel-blocks-global.
        */
        // Tail intercept of Selenium.reset().
          var origReset = Selenium.prototype.reset;

          Selenium.prototype.reset= function reset() {
          // @TODO Use interceptBefore() from SelBlocks - if SelBlocksGlobal stays as a part of SeLite
                Selenium.reloadScripts();
                origReset.call(this);
          };

        const subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                .getService(Components.interfaces.mozIJSSubScriptLoader);

        var bootstrappedListChanged= false;
        var bootstrappedCoreExtensions= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' ).getField( 'bootstrappedCoreExtensions' );
        var bootstrappedCoreExtensionsRecord;
        /*** This (re)loads and processes any updated custom .js file(s) - either if they were not loaded yet,
         *   or if they were modified since then. It also reloads them if their timestamp changed, but the contents didn't
         *   - no harm in that.
         */
        Selenium.reloadScripts= function reloadScripts() {
            editor.seleniumAPI.Selenium= Selenium;
            editor.seleniumAPI.LOG= LOG;

            if( bootstrappedListChanged || bootstrappedCoreExtensionsRecord===undefined ) {
                bootstrappedCoreExtensionsRecord= bootstrappedCoreExtensions.getDownToFolder( /*folderPath*/undefined, /*dontCache*/true );
                bootstrappedListChanged= false;
            }

            for( var filePath in bootstrappedCoreExtensionsRecord.entry ) {
                try {
                    var file= new FileUtils.File(filePath); // Object of class nsIFile
                }
                catch( exception ) {
                    LOG.warn( "SeBootstrap tried to (re)load a non-existing file " +filePath );
                    return;
                }

                if( filePath in Selenium.scriptLoadTimestamps && Selenium.scriptLoadTimestamps[filePath]===file.lastModifiedTime ) {
                    return;
                }
                // Let's set the timestamp before loading & executing the file. This ensures that if something goes wrong in that file, it won't be re-run
                // until it's updated (or until you reload Selenium IDE).
                Selenium.scriptLoadTimestamps[filePath]= file.lastModifiedTime;

                var tmpFile= FileUtils.getFile( "TmpD", [file.leafName+'-'+Date.now()] ); //  The second parameter is just a suggested name. FileUtils ensures I get a unique file.
                tmpFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE); // This creates an empty file
                tmpFile.remove( false ); // Need to remove it, otherwise copyTo(..) wouldn't copy over an existing file
                file.copyTo( tmpFile.parent, tmpFile.leafName );

                var tmpFileUrl= Services.io.newFileURI( tmpFile ); // object of type nsIURI
                try {
                    // When I passed editor.seleniumAPI, then bootstrapped extension must have defined global variables (without _var_ keyword) and therefore it couldn't use Javascript strict mode.
                    subScriptLoader.loadSubScript( tmpFileUrl.spec, global, 'UTF-8' );
                    // This could also be done via Components.utils.import( tmpFileUrl.spec, scope ) and Components.utils.unload(url). However, the .js file would have to define var EXPORTED_SYMBOLS= ['symbol1', 'symbol2', ...];
                }
                catch(error ) {
                    var msg= "SeBootstrap tried to evaluate " +filePath+ " and it failed with "
                        +error+ '. Following stack excludes the location(s) in that loaded file:\n' +error.stack;
                    LOG.error( msg );
                }
            }
        };

        SeLiteSettings.addTestSuiteFolderChangeHandler( function handler() {
            bootstrappedListChanged= true;
        });
    }
    SeLiteMisc.nonXpiCoreExtensionsLoadedOddTimes['doFUDforumUsers']= !loadedOddTimes;
})(this);