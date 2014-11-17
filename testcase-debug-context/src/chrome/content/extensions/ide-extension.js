/*
 * Copyright 2014 Peter Kehl
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
    var selenium = editor.selDebugger.runner.selenium;
    try{
        this.result = handler.execute(selenium, command); // from _executeCurrentCommand()
        this.waitForCondition = this.result.terminationCondition; // from _executeCurrentCommand()
        editor.selDebugger.runner.Selenium.seLiteAfterCurrentCommand.call( this );
        if( this.result.failed ) {
            editor.testLoopResumeHandleFailedResult.call( this );
        }
        this.continueTestWhenConditionIsTrue(); // from resume()
    }
    catch( e ) {
        editor.testLoopResumeHandleError.call( this, e );
    }
};

setTimeout( //waits until all the sub-scripts are loaded to overload selDebugger.init
    function() {
        
        var originalInit= editor.selDebugger.init;
        editor.selDebugger.init= function init() {
            originalInit.call( this );
            this.runner.IDETestLoop.prototype.resume= editor.testLoopResume;
        }
    },
    0
);
