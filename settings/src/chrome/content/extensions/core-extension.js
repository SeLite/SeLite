/*  Copyright 2013, 2014 Peter Kehl
    This file is part of SeLite Settings.
    
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

(function() { // Anonymous function to make the variables local
    //var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
  
    //@TODO Store the test suite folder via JS component. Have API to return via SeLiteSettings JS component.
    // Tail-intercept of TestSuite.loadFile(file)
    var originalLoadFile= TestSuite.loadFile;
    TestSuite.loadFile= function loadFile(file) {
        var result= originalLoadFile.call( this, file );
        window.location.href!=='chrome://selenium-ide/content/selenium-ide.xul' || SeLiteSettings.setTestSuiteFolder( file.parent.path );
        return result;
    };
    
    // Tail-intercept of TestSuite.prototype.save(newFile)
    var originalSave= TestSuite.prototype.save;
    TestSuite.prototype.save= function save(newFile) {
        var result= originalSave.call(this, newFile);
        // If !this.file or newFile, then the original function call is not saving the file, but it calls itself recursively.
        // That recursive call has this.file and newFile. See the original code in IDE's chrome/content/testSuite.js
        if( this.file && !newFile ) {
            window.location.href!=='chrome://selenium-ide/content/selenium-ide.xul' || SeLiteSettings.setTestSuiteFolder( this.file.parent.path );
        }
        return result;
    };
    
    // Tail-intercept TestSuite constructor itself. Copy all the fields (i.e. static methods & prototype).
    // That (as of Se IDE 2.4.0) is compatible with how original IDE's chrome/content/testSuite.js applies observable(TestSuite) - see also IDE's chrome/content/tools.js
    var originalTestSuite= TestSuite;
    TestSuite= function TestSuite() {
        originalTestSuite.call(this);
        window.location.href!=='chrome://selenium-ide/content/selenium-ide.xul' ||SeLiteSettings.setTestSuiteFolder( undefined );
    };
    for( var i in originalTestSuite ) {
        TestSuite[i]= originalTestSuite[i];
    }
    TestSuite.prototype= originalTestSuite.prototype;
} )();