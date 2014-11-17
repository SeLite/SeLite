/* Copyright 2005 Shinya Kasatani
 * Copyright 2013, 2014 Peter Kehl
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

"use strict";
// Anonymous function keeps global and origTestCasePrototype out of global scope
( function(global) {
    // Se IDE loads this file twice, and with a different scope object! I need to create TestCaseDebugContext when this file is loaded for the first time. I couldn't use 'var TestCaseDebugContext=...', or global.TestCaseDebugContext= .... because it would disappear (due to the different scope object). Since I want "use strict"; I set it on TestCase, which exists outside the loading scope, and therefore it's preserved between both loadings of this file.
    // See http://code.google.com/p/selenium/issues/detail?id=6697
    if( typeof TestCase.TestCaseDebugContext==="undefined" ) {
        global.TestCaseDebugContext= function TestCaseDebugContext( testCase ) {
            this.testCase= testCase;
        };

        global.TestCaseDebugContext.prototype.reset= function reset() {
            this.failed = false;
            this.started = false;
            this.debugIndex = -1;
        };

        global.TestCaseDebugContext.prototype.nextCommand= function nextCommand() {
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
                if (command.type==='command') {
                    return command;
                }
            }
            return null;
        };

        global.TestCaseDebugContext.prototype.currentCommand= function currentCommand() {
            var command = this.testCase.commands[this.debugIndex];
            if (!command) {
                this.testCase.log.warn("currentCommand() not found: commands.length=" + this.testCase.commands.length + ", debugIndex=" + this.debugIndex);
            }
            return command;
        };
        var origTestCasePrototype;
        if( origTestCasePrototype===undefined ) { // This check is needed because of http://code.google.com/p/selenium/issues/detail?id=6697
            origTestCasePrototype= TestCase.prototype;
            TestCase= function TestCase(tempTitle) {
                if (!tempTitle) tempTitle = "Untitled";
                this.log = new Log("TestCase");
                this.tempTitle = tempTitle;
                this.formatLocalMap = {};
                this.commands = [];
                this.recordModifiedInCommands();
                this.baseURL = "";

                this.debugContext= new TestCase.TestCaseDebugContext( this );
            };

            TestCase.prototype= origTestCasePrototype;
            TestCase.TestCaseDebugContext= global.TestCaseDebugContext;
        }
    }
    else {
        // This is so that SelBlocksGlobal can intercept TestCaseDebugContext.
        // I set it here when Se IDE loads this file for the second time.
        global.TestCaseDebugContext= TestCase.TestCaseDebugContext;
        
        /** This will be inserted before standard _executeCurrentCommand() through a head override.
         * */
        global.Selenium.seLiteBeforeCurrentCommand= function seLiteBeforeCurrentCommand() {};
        /** This will be appended after standard _executeCurrentCommand() through a tail override.
         * */
        global.Selenium.seLiteAfterCurrentCommand= function seLiteAfterCurrentCommand() {};
    }
} )( this );
