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

Components.utils.import( "chrome://selite-misc/content/selite-misc.js" );

// The following if() check is needed because Se IDE loads extensions twice - http://code.google.com/p/selenium/issues/detail?id=6697
if( typeof HtmlRunnerTestLoop!=='undefined' ) {
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    // @TODO Use $$.fn.interceptAfter from SelBlocks/Global, if it becomes L/GPL
    ( function() {
        var originalReloadScripts= Selenium.reloadScripts;
        Selenium.reloadScripts= function reloadScripts() {
            originalReloadScripts();
            //@TOdO
        };
        Selenium.prototype.doAutoCheck= function() {
            //LOG.warn( 'document: ' +typeof document );
            LOG.warn( 'TestLoop: ' +typeof TestLoop );
        };
        
        console.warn( 'autocheck setting up an intercept of executeCurrentcommand');
        console.warn( 'HtmlRunnerTestLoop: ' +typeof HtmlRunnerTestLoop);
        // HtmlRunnerTestLoop.prototype
        var original_executeCurrentCommand= HtmlRunnerTestLoop.prototype._executeCurrentCommand;

        TestLoop.prototype._executeCurrentCommand= function _executeCurrentCommand() {
            console.warn( 'calling original _executeCurrentCommand()');
            original_executeCurrentCommand.call( this );
            console.warn( 'custom _executeCurrentCommand():');
            // This intercepts and depends on current implementation of
            // - _executeCurrentCommand() of TestLoop.prototype - defined in selenium-executionloop.js, then copied to HtmlRunnerTestLoop.prototype via objectExtend() in selenium-testrunner.js and selenium-testrunner-original.js
            // - AssertResult.prototype.setFailed and AssertHandler.prototype.execute in selenium-commandhandlers.js
            // verify:
            // For getters (e.g. getEval), this.result is an instance of AccessorResult. won't be set here - it seems that this.result may not be an instance of AssertResult from selenium-commandhandlers.js. That's why the following checks this.result.failed.
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