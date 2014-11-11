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

/**
 * Specifies the amount of time it should wait when searching for an element if it is not immediately present.
 * @param {Integer} timeout Timeout in millisecond, set 0 to disable it
 * @exemple
     setImplicitWait | 0
     setImplicitWait | 1000
 */
Selenium.prototype.doSetImplicitWait = function(timeout){
    window.editor.implicitwait.setImplicitWait(timeout);
};

/**
 * Specifies the amount of time it should wait for a condition to be true to continue to the next command.
 * @param {Integer} timeout Timeout in millisecond, set 0 to disable it
 * @param {String} condition_js Javascript logical expression that need to be true to execute each command.
 * @exemple
     setImplicitWaitCondition |  0  |  
     setImplicitWaitCondition |  1000  | !window.Sys || !window.Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack();
     setImplicitWaitCondition |  1000  | !window.dojo || !window.dojo.io.XMLHTTPTransport.inFlight.length;
     setImplicitWaitCondition |  1000  | !window.Ajax || !window.Ajax.activeRequestCount;
     setImplicitWaitCondition |  1000  | !window.tapestry || !window.tapestry.isServingRequests();
     setImplicitWaitCondition |  1000  | !window.jQuery || !window.jQuery.active;
 */
Selenium.prototype.doSetImplicitWaitCondition = function(timeout, condition_js) {
    window.editor.implicitwait.setImplicitWaitCondition(timeout, condition_js);
}