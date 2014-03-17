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
    ( function() {
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        console.warn( 'autocheck setting up an intercept of executeCurrentcommand');
        console.warn( 'HtmlRunnerTestLoop: ' +typeof HtmlRunnerTestLoop);
        // I have no idea why the following works when I intercept TestLoop.prototype._executeCurrentCommand() rather than HtmlRunnerTestLoop.prototype._executeCurrentCommand() in Se 2.5.0. Maybe Selenium IDE loads chrome/content/selenium-core/scripts/selenium-testrunner.js twice. Anyway, if this stops working, I may have to change it to intercept HtmlRunnerTestLoop.prototype._executeCurrentCommand() 
        var original_executeCurrentCommand= TestLoop.prototype._executeCurrentCommand;

        TestLoop.prototype._executeCurrentCommand= function _executeCurrentCommand() {
            console.warn( 'calling original _executeCurrentCommand()');
            original_executeCurrentCommand.call( this );
            console.warn( 'custom _executeCurrentCommand():');
            // This intercepts and depends on current implementation of
            // - _executeCurrentCommand() of TestLoop.prototype - defined in selenium-executionloop.js, then copied to HtmlRunnerTestLoop.prototype via objectExtend() in selenium-testrunner.js and selenium-testrunner-original.js
            // - AssertResult.prototype.setFailed and AssertHandler.prototype.execute in selenium-commandhandlers.js
            // verify:
            // For getters (e.g. getEval), this.result is an instance of AccessorResult, which doesn't have field .passed (as of Selenium IDE 2.5.0). That's why the following checks !this.result.failed rather than this.result.passed.
            if( /*@TODO*/false && !this.result.failed ) { // Only trigger an assert failure, if there was no Selenese failure already
                var result= new AssertResult();
                // When debugging this, beware that running a single verification that fails (by double-clicking) doesn't log any message about the failure. It only highlights the command (in the editor matrix) in red/pink.
                // Only when you run a test case/suite then any failed verifications log their messages in the log (in red).
                result.setFailed('TODO');
                this.result= result;

                this.waitForCondition = this.result.terminationCondition;
            }
            console.warn( 'end of custom _executeCurrentCommand');
            // assert: @TODO find out whether I should clear this.result and this.waitForCondition. @TODO throw;
            //throw new SeleniumError('e.failureMessage');
        /**/
        }
    } )();
}