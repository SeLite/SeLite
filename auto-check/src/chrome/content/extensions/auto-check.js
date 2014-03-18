/*  Copyright 2014 Peter Kehl
    This file is part of SeLite Auto Check.

    SeLite Auto Check is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite Auto Check is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Auto Check.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

// The following if() check is needed because Se IDE loads extensions twice - http://code.google.com/p/selenium/issues/detail?id=6697
if( typeof HtmlRunnerTestLoop!=='undefined' ) {
    // @TODO Use $$.fn.interceptAfter from SelBlocks/Global, if it becomes L/GPL
    ( function(global) {
        Components.utils.import( "chrome://selite-misc/content/selite-misc.js" );
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        //console.warn( 'autocheck setting up an intercept of executeCurrentcommand');
        //console.warn( 'HtmlRunnerTestLoop: ' +typeof HtmlRunnerTestLoop);
        
        var settingsModule= SeLiteSettings.Module.forName( 'extensions.selite-settings.common' );
        
        // This intercepts and depends on current implementation of
        // - _executeCurrentCommand() of TestLoop.prototype - defined in selenium-executionloop.js, then copied to HtmlRunnerTestLoop.prototype via objectExtend() in selenium-testrunner.js and selenium-testrunner-original.js
        // I have no idea why the following works when I intercept TestLoop.prototype._executeCurrentCommand() rather than HtmlRunnerTestLoop.prototype._executeCurrentCommand() in Se 2.5.0. Maybe Selenium IDE loads chrome://selenium-ide/content/selenium-core/scripts/selenium-testrunner.js twice. Anyway, if this stops working, I may have to change it to intercept HtmlRunnerTestLoop.prototype._executeCurrentCommand() 
        var original_executeCurrentCommand= TestLoop.prototype._executeCurrentCommand;

        TestLoop.prototype._executeCurrentCommand= function _executeCurrentCommand() {
            //console.warn( 'calling original _executeCurrentCommand()');
            original_executeCurrentCommand.call( this );
            //console.warn( 'custom _executeCurrentCommand():');
            // - AssertResult.prototype.setFailed and AssertHandler.prototype.execute in selenium-commandhandlers.js
            // For getters (e.g. getEval), this.result is an instance of AccessorResult, which doesn't have field .passed (as of Selenium IDE 2.5.0). That's why the following checks !this.result.failed rather than this.result.passed.
            if( !this.result.failed ) { // Only perform the checks, if there was no Selenese failure already
                var detector;
                var fieldsDownToFolder= settingsModule.getFieldsDownToFolder( /*folderPath:*/undefined, /*dontCache:*/true );
                if( fieldsDownToFolder['autoCheckDetector'].entry ) {
                    var detectorClassName= Object.keys( fieldsDownToFolder['autoCheckDetector'].entry )[0];
                }
                else
                if( fieldsDownToFolder['autoCheckDetectorCustom'].entry ) {
                    //@TODO Load custom .js, if any
                }
                if( detectorClassName && !SeLiteMisc.cascadeField(global, detectorClassName, true) ) {
                    throw new SeleniumError( 'SeLite AutoCheck is configured to use unknown class ' +detectorClassName );
                }
                if( detectorClassName ) {
                    //console.warn( "detectorClass= fieldsDownToFolder['autoCheckDetector'].entry: " +detectorClassName );
                    var detectorClass= SeLiteMisc.cascadeField(global, detectorClassName, true);
                    detector= new detectorClass( fieldsDownToFolder['autoCheckRequired'].entry, fieldsDownToFolder['autoCheckRefused'].entry, fieldsDownToFolder['autoCheckIgnored'].entry, fieldsDownToFolder['autoCheckAssert'].entry );
                    //var doc= selenium.browserbot.getCurrentWindow().document;
                    var doc= selenium.browserbot.getDocument();
                    console.error( 'document: ' +doc );
                    console.error( 'location: ' +selenium.browserbot.getCurrentWindow().location );
                    var message= detector.failedRequired( doc ) || detector.failedRefused( doc ) || detector.failedNotIgnored( doc );
                    if( message ) {
                        if( detector.assert ) {
                            throw new SeleniumError( message );
                        }
                        else {
                            var result= new AssertResult();
                            result.setFailed( message ); // see AssertHandler.prototype.execute() in chrome://selenium-ide/content/selenium-core/scripts/selenium-commandhandlers.js
                            this.result= result;
                            this.waitForCondition = this.result.terminationCondition;
                        }
                    }
                }
            }
            //console.warn( 'end of custom _executeCurrentCommand');
        }
    } )( this );
}