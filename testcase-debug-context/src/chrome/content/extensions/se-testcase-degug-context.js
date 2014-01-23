/* Copyright 2005 Shinya Kasatani
 * Copyright 2013 Peter Kehl
 * Based on Selenium code of ide/main/src/content/testCase.js
 *
 * This is needed for SelBlocksGlobal to work until Selenium accepts https://code.google.com/p/selenium/issues/detail?id=5495
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Do not have: "use strict"; - otherwise I can't defined TestCaseDebugContext at Selenium scope
// @TODO Here and SelBlocksGlobal etc - for some reason, this is called 2x
// 1.at start of Se IDE
// 2. the first time a test command or a test case is run
// See http://code.google.com/p/selenium/issues/detail?id=6697. It was so even before this used SeLiteExtensionSequencer

/*var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
try {
    throw new Error('FYI');
} catch(e) {
    console.log( e.stack );
}*/
if( typeof TestCaseDebugContext==="undefined" ) {
    // Do not use function TestCaseDebugContext(testCase) { ... } here, because it won't be visible outside
    // Use TestCaseDebugContext= function( testCase ) { ... } instead.
    // Do not use 'var' in the following, i.e. do not use TestCaseDebugContext= function( testCase ) { ... },
    // otherwise it won't get set at Selenium scope.
    TestCaseDebugContext= function( testCase ) {
        this.testCase= testCase;
    };

    TestCaseDebugContext.prototype.reset= function() {
        this.failed = false;
        this.started = false;
        this.debugIndex = -1;
    };

    TestCaseDebugContext.prototype.nextCommand= function() {
        if (!this.started) {
            this.started = true;
            this.debugIndex = this.testCase.startPoint
                ? this.testCase.commands.indexOf(this.testCase.startPoint)
                : 0;
        } else {
            this.debugIndex++;
        }
        for (; this.debugIndex < this.testCase.commands.length; this.debugIndex++) {
            var command = this.testCase.commands[this.debugIndex];
            if (command.type == 'command') {
                return command;
            }
        }
        return null;
    };

    TestCaseDebugContext.prototype.currentCommand= function() {
        var command = this.testCase.commands[this.debugIndex];
        if (!command) {
            this.testCase.log.warn("currentCommand() not found: commands.length=" + this.testCase.commands.length + ", debugIndex=" + this.debugIndex);
        }
        return command;
    };
    // Anonymous function keeps origTestCasePrototype out of global scope
    ( function() {
        //var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        var origTestCasePrototype;
        if( origTestCasePrototype===undefined ) { // This check is needed because of http://code.google.com/p/selenium/issues/detail?id=6697
            origTestCasePrototype= TestCase.prototype;
            //console.log( 'TestCase Debug Context replacing TestCase with a head-intercept. typeof origTestCasePrototype: ' +typeof origTestCasePrototype );

            // Do not use function TestCase(tempTitle) { ... } here, because that won't make it visible outside of the anonymous function
            // use TestCase=function(tempTitle) { ... }; instead
            TestCase= function(tempTitle) {
                if (!tempTitle) tempTitle = "Untitled";
                this.log = new Log("TestCase");
                this.tempTitle = tempTitle;
                this.formatLocalMap = {};
                this.commands = [];
                this.recordModifiedInCommands();
                this.baseURL = "";

                this.debugContext= new TestCaseDebugContext( this );
            };

            TestCase.prototype= origTestCasePrototype;
        }
    } )();
}