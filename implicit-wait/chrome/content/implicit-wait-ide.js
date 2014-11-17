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