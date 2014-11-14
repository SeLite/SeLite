/*
 * Copyright 2012 Florent Breheret
 * http://code.google.com/p/selenium-implicit-wait/
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

(function(){ // closure keeps the local variables out of global scope
/**
 * Class: Adds the implicit wait feature to SeleniumIDE.
 * @param {Object} editor
 */
function ImplicitWait(editor){
    this.editor = editor;
    
    setTimeout(function(){      //waits all the sub-scripts are loaded to wrap selDebugger.init 
        //this===editor.implicitwait
        wrap(editor.selDebugger, 'init', this, this.wrap_selDebugger_init);
    }.bind(this), 0);
}

ImplicitWait.prototype = {
    
    DEFAULT_TIMEOUT: 5000,
    
    wait_forced: false,
    wait_timeout: 0,
    postcondition_timeout: 0,
    postcondition_func: null,
    postcondition_run: null,
    
    /** Callback for the click on the  hourglass button*/
    toggleButton: function(button) {
        if( (this.wait_forced = (button.checked ^= true)) ) {
            this.wait_timeout = this.DEFAULT_TIMEOUT;
        }
        else {
            this.wait_timeout = 0;
        }
    },
    
    /** Call from the setImplicitWait command*/
    setImplicitWait: function(timeout){
        this.wait_timeout = +timeout || 0;
    },
        
    /** Call from the setImplicitWaitCondition command*/
    setImplicitWaitCondition: function(timeout, condition_js){
        if((this.postcondition_timeout = +timeout || 0)){
            this.postcondition_func = new Function('return ' + condition_js);
            this.postcondition_func.__string__ = condition_js;
        }else{
            this.postcondition_func = null;
        }
        this.postcondition_run = null;
    },
    
    /** Overrides Debugger.init: function() in debugger.js line 23 */
    wrap_selDebugger_init: function(base, fn, args/*[]*/){
        // base===editor.selDebugger
        // this===editor.implicitwait
        fn.apply(base, args);   //calls the original method
        base.runner.MozillaBrowserBot.prototype.findElement = BrowserBot_findElement;
        base.runner.MozillaBrowserBot.prototype.locateElementByXPath= BrowserBot_locateElementByXPath;
        // Implicit Wait 1.0.13 (before integrating with SeLite) used to call: wrap(base.runner.IDETestLoop.prototype, 'resume', this, this.wrap_IDETestLoop_resume); That is now refactored into SeLite Test Case Debug Context > ide-extension.js -> editor.testLoopResume
        this.wait_timeout = (this.wait_forced && this.DEFAULT_TIMEOUT) || 0;
        this.postcondition_timeout = 0;
        this.postcondition_func = this.postcondition_run = null;
    },
    
    /** Overrides TestLoop.prototype.resume: function() in selenium-executionloop.js line 71 */
    wrap_IDETestLoop_resume: function(base, fn, args/*[]*/){
        // this===editor.implicitwait
        // base: instance of IDETestLoop
        var selDebugger = this.editor.selDebugger,
            runner = selDebugger.runner,
            selenium = runner.selenium,
            browserbot = selenium.browserbot,
            LOG = runner.LOG;
        
        // From TestLoop's resume() in selenium-executionloop.js:
        LOG.debug("currentTest.resume() - actually execute modified");
        browserbot.runScheduledPollers();
        
        runner.Selenium.seLiteBeforeCurrentCommand.call();
        
        // Following is from TestLoop's _executeCurrentCommand() in selenium-runner.js
        var command = base.currentCommand;
        LOG.info("Executing: |" + command.command + " | " + command.target + " | " + command.value + " |");

        var handler = base.commandFactory.getCommandHandler(command.command);
        if (handler === null)
            throw new SeleniumError("Unknown command: '" + command.command + "'");
            
        command.target = selenium.preprocessParameter(command.target);
        command.value = selenium.preprocessParameter(command.value);
        LOG.debug("Command found, going to execute " + command.command);
        
        runner.updateStats(command.command);
        // end of code based on _executeCurrentCommand() - except for its last two lines, which are handled in loopFindElement() below
        
        // Following replaces:
        // - two lines from _executeCurrentCommand() and
        // - a call to this.continueTestWhenConditionIsTrue() and
        // - error handling from TestLoop's resume() in selenium-executionloop.js:
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
    }
};


/** 
 * Overriding for BrowserBot.prototype.findElement: function(locator, win) in selenium-browserbot.js line 1524
 * @param {String} locator
 * @param {Object} win
 */
var BrowserBot_findElement = function (locator, win){
    var element = this.findElementOrNull(locator, win);
    if(element === null)
        throw new ElementNotFountError(locator);
    return window.core.firefox.unwrap(element);
};

var BrowserBot_locateElementByXPath= function locateElementByXPath(xpath, inDocument, inWindow) {
    try {
        return this.xpathEvaluator.selectSingleNode(inDocument, xpath, null,
            inDocument.createNSResolver
              ? inDocument.createNSResolver(inDocument.documentElement)
              : this._namespaceResolver);
    }
    catch(e) {
      if( e.name==='NS_ERROR_ILLEGAL_VALUE' ) { // for https://code.google.com/p/selenium-implicit-wait/issues/detail?id=3
          return null;
      }
      throw e;
    }
};


/**
 * Class: Error specific to findElement
 * @param {String} locator
 */
function ElementNotFountError(locator) {
    this.locator = locator;
}
ElementNotFountError.prototype = {
    isSeleniumError: true,
    isElementNotFoundError: true,
    get message(){ return 'Element ' + this.locator + ' not found'; },
    toString: function(){ return this.message; }
};


/**
 * Wraps a method call to a function on a specified context. Skips the wrapping if already done.
 * @param {Object} obj Object containing the function to intercept
 * @param {String} key Name of the function to intercept
 * @param {Object} context Object on which the intercepting function func will be applied
 * @param {Function} func  Function intercepting obj[method] : function(context, function, arguments)
 */
function wrap(obj, key, context, func){
    var fn = obj[key], w;
    if(!(w=fn.__wrap__) || w.src !== fn || w.tgt !== func ){
        (obj[key] = function(){
            return func.call(context, this, fn, arguments);
        }).__wrap__ = {src:fn, tgt:func};
    }
}


//Instantiates the plug-in
editor.implicitwait = new ImplicitWait(editor);

})();