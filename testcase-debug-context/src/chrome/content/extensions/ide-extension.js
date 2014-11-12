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
    var base= editor.selDebugger;
    
    // From TestLoop's resume() in selenium-executionloop.js:
    LOG.debug("currentTest.resume() - actually execute modified");
    browserbot.runScheduledPollers();

    runner.Selenium.seLiteBeforeCurrentCommand.call();

    // Following is from TestLoop's _executeCurrentCommand() in selenium-runner.js
    var command = base.currentCommand;
    LOG.info("Executing: |" + command.command + " | " + command.target + " | " + command.value + " |");

    // I've moved 'var handler' to testLoopResumeExecuteAndHandleErrors()
    command.target = selenium.preprocessParameter(command.target);
    command.value = selenium.preprocessParameter(command.value);
    LOG.debug("Command found, going to execute " + command.command);

    runner.updateStats(command.command);
    // end of code based on _executeCurrentCommand() - except for its three lines, which are handled in testLoopResumeExecuteAndHandleErrors() below
};
editor.testLoopResumeExecuteAndHandleErrors= function testLoopResumeExecuteAndHandleErrors() {
    var selDebugger = editor.selDebugger;
    var runner = selDebugger.runner;
    var selenium = runner.selenium;
    var browserbot = selenium.browserbot;
    var LOG = runner.LOG;
    var base= selDebugger;
    
    // Following replaces:
    // - three lines from _executeCurrentCommand() and
    // - a call to this.continueTestWhenConditionIsTrue() and
    // - error handling from TestLoop's resume() in selenium-executionloop.js:
    var handler = base.commandFactory.getCommandHandler(command.command);
    if (handler === null) {
        throw new SeleniumError("Unknown command: '" + command.command + "'");
    }
    var locator_endtime = this.wait_timeout && new Date().getTime() + this.wait_timeout;
    var self = this;
    var loopFindElement= function loopFindElement() {
        try{
            base.result = handler.execute(selenium, command); // from _executeCurrentCommand()
            base.waitForCondition = base.result.terminationCondition; // from _executeCurrentCommand()
            var loopCommandCondition= function loopCommandCondition() {    //handles the andWait condition in replacement of continueTestWhenConditionIsTrue
                try{
                    browserbot.runScheduledPollers();
                    if(base.waitForCondition && !base.waitForCondition())
                        return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopCommandCondition, 15);
                    base.waitForCondition = null;
                    var postcondition_endtime = self.postcondition_run && new Date().getTime() + self.postcondition_timeout;
                    self.postcondition_run = self.postcondition_func;
                    var loopPostCondition= function loopPostCondition() {    //handles the customized postcondition
                        if(postcondition_endtime){
                            try{
                                if(new Date().getTime() > postcondition_endtime)
                                    base.result = {failed: true, failureMessage: 'Timed out on postcondition ' + self.postcondition_func.__string__};
                                else if(!self.postcondition_func.call(selenium))
                                    return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopPostCondition, 15);
                            }catch(e){
                                 base.result = {failed: true, failureMessage: 'Exception on postcondition ' + self.postcondition_func.__string__ + '  Exception:' + extractExceptionMessage(e)};
                            }
                        }
                        runner.Selenium.seLiteAfterCurrentCommand.call( base );
                        base.commandComplete(base.result);
                        base.continueTest();
                    };
                    loopPostCondition();
                }catch(e){
                    base.result = {failed: true, failureMessage: extractExceptionMessage(e)};
                    base.commandComplete(base.result);
                    base.continueTest();
                }
            };
            loopCommandCondition();
        } catch(e){
            if(e.isElementNotFoundError && locator_endtime && new Date().getTime() < locator_endtime)
                return selDebugger.state !== 2/*PAUSE_REQUESTED*/ && window.setTimeout(loopFindElement, 20);
            if(base._handleCommandError(e))
                base.continueTest();
            else
                base.testComplete();
        }
    };
    loopFindElement();
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
