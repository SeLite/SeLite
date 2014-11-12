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
debugger;
//alert( typeof editor.selDebugger.runner );
// editor.testLoopResume replaces resume() from selenium-executionloop.js.
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
    if (handler === null) {//@TODO error handling as per resume()?
        throw new SeleniumError("Unknown command: '" + command.command + "'");
    }
    
    command.target = selenium.preprocessParameter(command.target);
    command.value = selenium.preprocessParameter(command.value);
    LOG.debug("Command found, going to execute " + command.command);

    runner.updateStats(command.command);
    // end of code based on _executeCurrentCommand() - except for a few lines, which are handled in testLoopResumeExecuteAndHandleErrors() below
    
    editor.testLoopResumeExecuteAndHandleErrors.call( this, command, handler );
};
/**
    It's based on:
    - the rest of _executeCurrentCommand() that wasn't processed by testLoopResume() itself above, and
    - a call to continueTestWhenConditionIsTrue() and
    - error handling from TestLoop's resume() in selenium-executionloop.js:
 * */
editor.testLoopResumeExecuteAndHandleErrors= function testLoopResumeExecuteAndHandleErrors( command, handler ) {
    var selDebugger = editor.selDebugger;
    var runner = selDebugger.runner;
    var selenium = runner.selenium;
    var browserbot = selenium.browserbot;
    
    //@TODO editor.implicitwait:
    var locator_endtime = editor.implicitwait.wait_timeout && new Date().getTime() + editor.implicitwait.wait_timeout;
    var self = editor.implicitwait;
    var loopFindElement= function loopFindElement() {
        try{
            //@TODO change most or all: selDebugger -> this
            selDebugger.result = handler.execute(selenium, command); // from _executeCurrentCommand()
            selDebugger.waitForCondition = selDebugger.result.terminationCondition; // from _executeCurrentCommand()
            var loopCommandCondition= function loopCommandCondition() {    //handles the andWait condition in replacement of continueTestWhenConditionIsTrue
                try{
                    browserbot.runScheduledPollers();
                    if( selDebugger.waitForCondition && !selDebugger.waitForCondition() ) {
                        return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopCommandCondition, 15);
                    }
                    selDebugger.waitForCondition = null;
                    var postcondition_endtime = self.postcondition_run && new Date().getTime() + self.postcondition_timeout;
                    self.postcondition_run = self.postcondition_func;
                    var loopPostCondition= function loopPostCondition() {    //handles the customized postcondition
                        if(postcondition_endtime){
                            try{
                                if( new Date().getTime() > postcondition_endtime ) {
                                    selDebugger.result = {failed: true, failureMessage: 'Timed out on postcondition ' + self.postcondition_func.__string__};
                                }
                                else if( !self.postcondition_func.call(selenium) ) {
                                    return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopPostCondition, 15);
                                }
                            }catch(e){
                                 selDebugger.result = {failed: true, failureMessage: 'Exception on postcondition ' + self.postcondition_func.__string__ + '  Exception:' + extractExceptionMessage(e)};
                            }
                        }
                        runner.Selenium.seLiteAfterCurrentCommand.call( selDebugger );
                        selDebugger.commandComplete(selDebugger.result);
                        selDebugger.continueTest();
                    };
                    loopPostCondition();
                }catch(e){
                    selDebugger.result = {failed: true, failureMessage: extractExceptionMessage(e)};
                    selDebugger.commandComplete(selDebugger.result);
                    selDebugger.continueTest();
                }
            };
            loopCommandCondition();
        } catch(e){
            if(e.isElementNotFoundError && locator_endtime && new Date().getTime() < locator_endtime)
                return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopFindElement, 20);
            if(selDebugger._handleCommandError(e))
                selDebugger.continueTest();
            else
                selDebugger.testComplete();
        }
    };
    loopFindElement();
};

editor.testLoopResumeExecuteAndHandleErrors= function testLoopResumeExecuteAndHandleErrors( command, handler ) {
    var selenium = editor.selDebugger.runner.selenium;
    try{
        this.result = handler.execute(selenium, command); // from _executeCurrentCommand()
        this.waitForCondition = this.result.terminationCondition; // from _executeCurrentCommand()
        this.continueTestWhenConditionIsTrue(); // from resume()
    }
    catch( e ) {
        if (!this._handleCommandError(e)) {
            this.testComplete();
        } else {
            this.continueTest();
        }
    }
};

setTimeout( //waits until all the sub-scripts are loaded to overload selDebugger.init
    function() {
        
        var originalInit= editor.selDebugger.init;
        editor.selDebugger.init= function init() {
            originalInit.call( this );
            if( this.runner.IDETestLoop.prototype.resume!==editor.testLoopResume ) {
                this.runner.IDETestLoop.prototype.resume= editor.testLoopResume;
            }
        }
    },
    0
);
