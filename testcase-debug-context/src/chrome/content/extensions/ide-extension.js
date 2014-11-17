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

/**
    It's based on three functions in TestLoop from selenium-executionloop.js:
    - the rest of _executeCurrentCommand() that wasn't processed by testLoopResume() itself above, and
    - a call to continueTestWhenConditionIsTrue() and
    - error handling from resume()
 * */
editor.testLoopResumeExecuteAndHandleErrors= function testLoopResumeExecuteAndHandleErrors( command, handler ) {
    var selDebugger = editor.selDebugger;
    var runner = selDebugger.runner;
    var selenium = runner.selenium;
    var browserbot = selenium.browserbot;
    
    var locator_endtime = editor.implicitwait.wait_timeout && new Date().getTime() + editor.implicitwait.wait_timeout;
    var self = this;
    
    var loopFindElement= function loopFindElement() {
        try{
            self.result = handler.execute(selenium, command); // from _executeCurrentCommand()
            self.waitForCondition = self.result.terminationCondition; // from _executeCurrentCommand()
            
            var loopCommandCondition= function loopCommandCondition() {    //handles the andWait condition in replacement of continueTestWhenConditionIsTrue
                try{
                    browserbot.runScheduledPollers();
                    if( self.waitForCondition && !self.waitForCondition() ) {
                        return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopCommandCondition, 15);
                    }
                    self.waitForCondition = null;
                    var postcondition_endtime = self.postcondition_run && new Date().getTime() + self.postcondition_timeout;
                    self.postcondition_run = self.postcondition_func;
                    var loopPostCondition= function loopPostCondition() {    //handles the customized postcondition
                        if(postcondition_endtime){
                            try{
                                if( new Date().getTime() > postcondition_endtime ) {
                                    self.result = {failed: true, failureMessage: 'Timed out on postcondition ' + self.postcondition_func.__string__};
                                }
                                else if( !self.postcondition_func.call(selenium) ) {
                                    return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopPostCondition, 15);
                                }
                            }catch(e){
                                 self.result = {failed: true, failureMessage: 'Exception on postcondition ' + self.postcondition_func.__string__ + '  Exception:' + extractExceptionMessage(e)};
                            }
                        }
                        try { // If the following fails, I don't let the exception bubble up, because the nearest enclosing try..catch in loopCommandCondition() would suppress this error. That would work against the expectations of e.g. Exit Confirmation Checker in assert mode.
                            runner.Selenium.seLiteAfterCurrentCommand.call( self );
                        }
                        catch( e ) {
                            editor.testLoopResumeHandleError.call( self, e );
                            return;
                        }
                        if( self.result.failed ) {
                            editor.editor.testLoopResumeHandleFailedResult.call( self );
                        }
                        self.commandComplete(self.result);
                        self.continueTest();
                    };
                    loopPostCondition();
                }catch(e){
                    self.result = {failed: true, failureMessage: extractExceptionMessage(e)};
                    // I don't need to call runner.Selenium.seLiteAfterCurrentCommand.call( self ); here.
                    editor.testLoopResumeHandleFailedResult.call( self );
                    self.commandComplete(self.result);
                    self.continueTest();
                }
            };
            loopCommandCondition();
        } catch(e){
            if(e.isElementNotFoundError && locator_endtime && new Date().getTime() < locator_endtime) {
                return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopFindElement, 20);
            }
            editor.testLoopResumeHandleError.call( self, e );
        }
    };
    loopFindElement();
};

if( false ) {
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
}

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
