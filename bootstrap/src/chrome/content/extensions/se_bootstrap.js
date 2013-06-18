/*  Copyright 2012, 2013 Peter Kehl
    This file is part of SeBootstrap.

 * Whole SeBootstrap is licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 
    This file itself is dual-licensed.
    It is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeBootstrap is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Bootstrap.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

/** @var Object serving as an associative array [string file path] => int lastModifiedTime
 **/
Selenium.prototype.scriptLoadTimestamps= {};

(function() { // Anonymous function makes fileUtilsScope a local variable
    var fileUtilsScope= {};
    Components.utils.import("resource://gre/modules/FileUtils.jsm", fileUtilsScope );
    Selenium.prototype.FileUtils= fileUtilsScope.FileUtils;
    var servicesScope= {};
    Components.utils.import("resource://gre/modules/Services.jsm", servicesScope );
    Selenium.prototype.Services= servicesScope.Services;
})();

/** There are two sets of events when we want to call doReloadScripts(), which are handled separately:
    - executing a single test command / run a testcase / run each testcase in a testsuite.
      Handled by tail-intercept of Selenium.prototype.reset() below.
    - run a testcase/testsuite, pause it (or not), modify a file loaded via SeBootstrap
        (and make the test continue if you paused it earlier), SeBootstrap will not re-trigger Selenium.prototype.reset()
        (until next run of a single command/testcase/testsuite). That's handled by
        TestCaseDebugContext.prototype.nextCommand - as a part of separate (sister) extension testcase-debug-context.
        However, testCase.debugContext.nextCommand doesn't get triggered when running a single test command, therefore 
        I tail intercept both functions.
    If you change the filename in SeBootstrap options, it can't 'unload' a file that it run already. Then if you change the options
    back, it won't re-run the file, unless its timestamp changed.
*/
// Tail intercept of Selenium.reset().
(function () { // wrapper makes variables private
  var origReset = Selenium.prototype.reset;
  
  Selenium.prototype.reset = function() {// this: selenium
        this.bootstrapReloadScripts();
        origReset.call(this);
  };
} )();

const subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
        .getService(Components.interfaces.mozIJSSubScriptLoader);
  
/*** This (re)loads and processes any updated custom .js file(s) - either if they were not loaded yet,
 *   or if they were modified since then. It also reloads them if their timestamp changed, but the contents didn't
 *   - no harm in that.
 */
Selenium.prototype.bootstrapReloadScripts= function() {
    editor.seleniumAPI.Selenium= Selenium;
    editor.seleniumAPI.LOG= LOG;
    
    var filePath= SeBootstrap.instance.scriptFileName; //@TODO support multiple. See also src/chrome/content/ui/ovOptions.js.
    if( !filePath.trim().length ) {
        return;
    }
    try {
        var file= new this.FileUtils.File(filePath); // Object of class nsIFile
    }
    catch( exception ) {
        LOG.warn( "SeBootstrap tried to (re)load a non-existing file " +filePath );
        return;
    }

    if( filePath in this.scriptLoadTimestamps && this.scriptLoadTimestamps[filePath]===file.lastModifiedTime ) {
        return;
    }
    // Let's set the timestamp before loading & executing the file. If something goes wrong in that file, it won't be re-run
    // until it's updated (or until you reload Selenium IDE).
    this.scriptLoadTimestamps[filePath]= file.lastModifiedTime;
    
    var tmpFile= this.FileUtils.getFile( "TmpD", [file.leafName+'-'+Date.now()] ); //  The second parameter is just a suggested name. FileUtils ensures I get a unique file.
    tmpFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE); // This creates an empty file
    tmpFile.remove( false ); // Need to remove it, otherwise copyTo(..) wouldn't copy over an existing file
    file.copyTo( tmpFile.parent, tmpFile.leafName );
    
    var tmpFileUrl= this.Services.io.newFileURI( tmpFile ); // object of type nsIURI
    try {
        subScriptLoader.loadSubScript( tmpFileUrl.spec, editor.seleniumAPI ); // It can't access outer scope!
    }
    catch(error ) {
        var msg= "SeBootstrap tried to evaluate " +filePath+ " and it failed with "
            +error+ '. Following stack excludes the location(s) in that loaded file:\n' +error.stack;
        LOG.error( msg );
    }
    
    /* Following are 2 more ways to load a javascript file. They both cache the file, therefore I copy it under a new temporary name.
     * They both are not useful, though, because the JS file can't access the (incoming) outer scope.
     
        Components.utils.unload( previousTmpFileUrl ); // If an older file was loaded earlier
        Components.utils.import( tmpFileUrl.spec ); // The .js file has to define var EXPORTED_SYMBOLS= ['..', '..'...]; and it can't use any objects from outer scope (including Selenium.prototype etc)
    
    or
        // This uses eval(), therefore we can't have "use strict"; at the top of this file
        var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
                  createInstance(Components.interfaces.nsIFileInputStream);
    var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
                  createInstance(Components.interfaces.nsIConverterInputStream);
    fstream.init(file, -1, -1, 0);
    cstream.init(fstream, "UTF-8", 0, 0);

    var contents= "";
    var str= {};
    var read = 0;
    do {
        read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
        contents += str.value;
    } while (read != 0);
    cstream.close(); // this closes fstream, too

    try {
        eval( contents );
    }
    catch( error )  {
        var msg= "SeBootstrap tried to evaluate " +filePath+ " and it failed with ";
        if( error instanceof SyntaxError) {
            msg+= 'syntax error';
        }
        else {
            msg+= 'non-syntax error';
        }
        // @TODO If we need to report location & stack within the buggy file, then copy it to /tmp and load it from there - see below
        msg+= ' ' +error+ '. Following stack excludes the location(s) in that loaded file:\n' +error.stack;
        LOG.error( msg );
    }
 */
};

// I could load the custom JS (if any) here, so that any Selenese and/or functions/variables are available right away.
// However, LOG wouldn't got to Selenium IDE log, but to Firefox > Tools > Web Developr > Error Console.
// And the same would apply to LOG.xxx() by any Selenese actions/getters defined in the custom JS, on any further
// invocations of those actions/getters, until the custom file would be updated and reloaded, which would reload
// definitions of those actions/getters.
// That's why I don't use the following:
//var temporarySelenium= new Selenium();
//temporarySelenium.bootstrapReloadScripts();