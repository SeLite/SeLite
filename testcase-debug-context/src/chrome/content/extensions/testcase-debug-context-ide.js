/*
 * Copyright 2014, 2016 Peter Kehl
 * Based on code from Selenium IDE, which is Copyright 2011 Software Freedom Conservancy.
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

// Functions set on 'editor' object here are not to be run on 'editor' object, but on TestLoop instance. These functions are set on 'editor' object only because there seems no better place to set them, where they could be intercepted from both Core and IDE extensions.

editor.testLoopResume= function testLoopResume() {
    var runner = editor.selDebugger.runner;
    var selenium = runner.selenium;
    var browserbot = selenium.browserbot;
    var LOG = runner.LOG;
    
    // From TestLoop's resume() in selenium-executionloop.js:
    LOG.debug("currentTest.resume() - actually execute modified");
    browserbot.runScheduledPollers();

    runner.Selenium.seLiteBeforeCurrentCommand.call();

    // Following is from TestLoop's _executeCurrentCommand() in selenium-runner.js
    var command = this.currentCommand;
    LOG.info("Executing: |" + command.command + " | " + command.target + " | " + command.value + " |");

    var command = this.currentCommand;
    var handler = this.commandFactory.getCommandHandler(command.command);
    if( handler===undefined ) {
        this._handleCommandError( SeleniumError("Unknown command: '" + command.command + "'") );
        this.testComplete(); // Simplified version of error handling in resume(), since this._handleCommandError() returns true for this error
        return;
    }
    
    command.target = selenium.preprocessParameter(command.target);
    command.value = selenium.preprocessParameter(command.value);
    LOG.debug("Command found, going to execute " + command.command);

    runner.updateStats(command.command);
    // end of code based on _executeCurrentCommand() - except for a few lines, which are handled in testLoopResumeExecuteAndHandleErrors() below
    editor.testLoopResumeExecuteAndHandleErrors.call( this, command, handler );
};

/** This is called when this.result.failed is true in editor.testLoopResumeExecuteAndHandleErrors() - i.e. after a verification failure.
 * */
editor.testLoopResumeHandleFailedResult= function testLoopResumeHandleFailedResult() {};

/** This is called when there's an error caught in editor.testLoopResumeExecuteAndHandleErrors() - i.e. after a command failure or an assertion failure. */
editor.testLoopResumeHandleError= function testLoopResumeHandleError(e) {
    if (!this._handleCommandError(e)) {
        this.testComplete();
    } else {
        this.continueTest();
    }
};

/** This replaces _executeCurrentCommand() and a part of resume(), both from selenium-executionloop.js.
 */
editor.testLoopResumeExecuteAndHandleErrors= function testLoopResumeExecuteAndHandleErrors( command, handler ) {
    LOG.debug('testLoopResumeExecuteAndHandleErrors starts');
    var selenium = editor.selDebugger.runner.selenium;
    try{
        this.result = handler.execute(selenium, command); // from _executeCurrentCommand()
        this.waitForCondition = this.result.terminationCondition; // from _executeCurrentCommand()
        editor.selDebugger.runner.Selenium.seLiteAfterCurrentCommand.call( this );
        if( this.result.failed ) {
            LOG.debug('testLoopResumeExecuteAndHandleErrors failure -> testLoopResumeHandleFailedResult');
            editor.testLoopResumeHandleFailedResult.call( this );
        }
        LOG.debug('testLoopResumeExecuteAndHandleErrors -> continueTestWhenConditionIsTrue');
        this.continueTestWhenConditionIsTrue(); // from resume()
    }
    catch( e ) {
        LOG.debug('testLoopResumeExecuteAndHandleErrors caught');
        var callFrame= selenium.callStack().top();
        if( callFrame.frameFromAsync ) { // This stack call frame was invoked from selenium.callBackOutFlow(). Hence it has no Selenese try..catch/finally envolope. However, it needs special handling, to pass control back to JS level that invoked selenium.callBackOutFlow().
            if( selenium.handleCommandError(e) ) {
                this.continueTestWhenConditionIsTrue();
            }
            else {
                !callFrame.onFailure || callFrame.onFailure();
                this.testComplete();
            }
            return;
        }
        editor.testLoopResumeHandleError.call( this, e );
    }
};

setTimeout( //waits until all the sub-scripts are loaded. Only then it can overload selDebugger.init().
    function() {
        // In Firefox 48.0a1 (2016-03-08) setTimeout() runs immediately (async?)
        // even when e10s electrolysis is off. Hence two ways of tail-override of selDebugger.init():
        var selDebuggerInitOriginal;
        var selDebuggerInitSeLite= function selDebuggerInitSeLite() {
            selDebuggerInitOriginal.call( this );
            this.runner.IDETestLoop.prototype.resume= editor.testLoopResume;
            
            /** Based on continueTestWhenConditionIsTrue() in TestLoop.prototype in selenium-executionloop.js.
             *  Both the original and the following derivative get called via two paths in Selenium IDE:
             * 1. from testLoopResume() -> testLoopResumeExecuteAndHandleErrors() above (original: TestLoop.prototype's resume() in selenium-executionloop.js) when command evaluation didn't pause via setTimeout() - yet or if it doesn't use setTimeout() at all; or
             * 2. from IDETestLoop.prototype.continueTestWhenConditionIsTrue() in selenium-runner.js in case of timeout function-decorated commands, if those are called for the 2nd or further time (via setTimeout()).
             * #2 originally didn't handle exceptions in the command's continue test, or the timeout. Hence the following adds handling of those exceptions, and it calls editor.testLoopResumeHandleError().
             * */
            this.runner.TestLoop.prototype.continueTestWhenConditionIsTrue= function continueTestWhenConditionIsTrue() {
                var runner = editor.selDebugger.runner;
                var selenium = runner.selenium;
                selenium.browserbot.runScheduledPollers();
                
                if (this.waitForCondition == null) {
                    LOG.debug("null condition; let's continueTest()");
                    LOG.debug("Command complete");
                    this.commandComplete(this.result);
                    this.continueTest();
                } else {
                    var waitForConditionResult;
                    try {
                        waitForConditionResult= this.waitForCondition();
                    }
                    catch( e ) {
                        // Handling an exception in path #2 (see above):
                        LOG.debug("waitForCondition() failed or was repeated until it timed out.");
                        editor.testLoopResumeHandleError.call( this, e );
                        return;
                    }
                    if( waitForConditionResult ) {
                        LOG.debug("condition satisfied; let's continueTest()");
                        this.waitForCondition = null;
                        LOG.debug("Command complete");
                        this.commandComplete(this.result);
                        this.continueTest();
                    } else {
                        LOG.debug("waitForCondition() was false; keep waiting!");
                        window.setTimeout(fnBind(this.continueTestWhenConditionIsTrue, this), 10);
                    }
                }
            };
        }
        if( editor.selDebugger ) {
            selDebuggerInitOriginal= editor.selDebugger.init;
            editor.selDebugger.init= selDebuggerInitSeLite;
        }
        else {
            var debuggerOriginal= Debugger;
            Debugger= function DebuggerSeLite(editor) {
                debuggerOriginal.call( this, editor );
                selDebuggerInitOriginal= this.init;
                this.init= selDebuggerInitSeLite;
            };
            Debugger.prototype= debuggerOriginal.prototype;
        }
    },
    0
);
