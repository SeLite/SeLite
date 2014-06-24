/*  Copyright 2014 Peter Kehl
    This file is part of SeLite Exit Confirmation Checker.

    SeLite Exit Confirmation Checker is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite Exit Confirmation Checker is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Exit Confirmation Checker.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

// Anonymous function to prevent leaking into Selenium global namespace
( function() {
    Components.utils.import( "chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js" );
    var loadedTimes= SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteExitConfirmationChecker'] || 0;
    if( loadedTimes===1 ) { // Setup the overrides on the first load, not on the second
        Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js" );
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.Module.forName( 'extensions.selite-settings.common' );
        
        // Override BrowserBot defined in Selenium IDE's chrome://selenium-ide/content/selenium-core/scripts/selenium-browserbot.js
        var oldBrowserBot= BrowserBot;
        BrowserBot= function BrowserBot(topLevelApplicationWindow) {
          console.debug( 'BrowserBot() called as overriden by SeLite Exit Confirmation Checker.' );
          oldBrowserBot.call( this, topLevelApplicationWindow );
          
          //var self= this; // If you need to set fields on the current object, for some reason you can't set them on 'this', but you have to use 'self' instead. See chrome://selenium-ide/content/selenium-core/scripts/selenium-browserbot.js -> definition of function recordPageLoad.
          var oldRecordPageLoad= this.recordPageLoad;
          this.recordPageLoad = function recordPageLoad(elementOrWindow) {
              // This gets registered as a handler & called only for any page that is a direct result of Selenese actions but not a result of a redirect.
              oldRecordPageLoad.call( this, elementOrWindow );
              console.debug( "SeLite Exit Confirmation Checker's override of BrowserBot.recordPageLoad() called." );
              console.error( 'selenium ' +typeof selenium );
              // When I've overriden self.getCurrentWindow(true).onbeforeunload here, it had no effect. It must be too early here. The same for self.getCurrentWindow(true).onload. So here I set a flag, and I consume it in nextCommand() below
              selenium.overrideOnBeforeUnload= true;
          };
        };
        BrowserBot.prototype= oldBrowserBot.prototype;
        BrowserBot.prototype.constructor= BrowserBot;
        for( var classField in oldBrowserBot ) {
            BrowserBot[classField]= oldBrowserBot[classField];
        }

        var originalNextCommand= TestCaseDebugContext.prototype.nextCommand;
        TestCaseDebugContext.prototype.nextCommand= function nextCommand() {
            var result= originalNextCommand.call( this );
            console.debug( 'SeLite Exit ConfirmationChecker tail override of TestCaseDebugContext.prototype.nextCommand().' );
            if( selenium.overrideOnBeforeUnload ) {
                // Following variables won't be set when you run a single Selenese command (rather than the whole test case).
                /** @var object {number index of the input in selenium.inputs => (string|boolean) original value } */selenium.seLiteOriginalInputValues= {}; // It could be an array. But selenium.seLiteModifiedInputValues can't be an array and therefore both are objects serving as associative arrays.
                /** @var object {number index of the input in selenium.inputs => (string|boolean) modified value } */selenium.seLiteModifiedInputValues= {};
                /** @var Array of inputs */selenium.seLiteInputs= [];
                /** @var Array of strings, each being the first used locator for the respective input. Used when reporting the inputs to the user. */selenium.seLiteInputLocators= [];
                
                var window= selenium.browserbot.getCurrentWindow(true);
                var originalOnBeforeUnload= window.onbeforeunload;
                window.onbeforeunload= function onbeforeunload() {
                    var fieldsDownToFolder= settingsModule.getFieldsDownToFolder( /*folderPath:*/undefined, /*dontCache:*/true );
                    var exitConfirmationCheckerMode= fieldsDownToFolder['exitConfirmationCheckerMode'].entry;
                    if( exitConfirmationCheckerMode==='ignored') {
                        return;
                    }
                    var originalResult= originalOnBeforeUnload.call(this);
                    if( exitConfirmationCheckerMode==='inactive' ) {
                        return originalResult;
                    }
                    selenium.seLiteAppAskedToConfirm= originalResult!==undefined;
                    // I can't throw an error here - Firefox ignores it. So I handle it in _executeCurrentCommand() below.
                    // I don't return anything: that suppresses the confirmation popup.
                };
                selenium.overrideOnBeforeUnload= false;
            }
            return result;
        };
        
        var original_executeCurrentCommand= TestLoop.prototype._executeCurrentCommand;
        TestLoop.prototype._executeCurrentCommand= function _executeCurrentCommand() {
            original_executeCurrentCommand.call( this );
            if( !this.result.failed ) { // See also comments in auto-check.js
                var modifiedInputValues= selenium.seLiteModifiedInputValues || {};
                var hadModifiedInputs= Object.keys( modifiedInputValues ).length>0;
                if( selenium.seLiteAppAskedToConfirm!==undefined && selenium.seLiteAppAskedToConfirm!==hadModifiedInputs ) {
                    var message= "Web application's window.onbeforeunload() "
                            +(selenium.seLiteAppAskedToConfirm ? 'asked' : "didn't ask")+ ' to confirm closing of the window/tab, but there ' 
                            +(hadModifiedInputs ? 'were some' : "weren't any")+ ' modified inputs';
                    if( hadModifiedInputs ) {
                        message+= ':';
                        for( var index in modifiedInputValues ) {
                            message+= '\n' +selenium.seLiteInputLocators[index];
                        }
                    }
                    else {
                        message+= '.';
                    }
                    selenium.seLiteAppAskedToConfirm= undefined;
                    if( false ) {//@TODO config field - whether to assert
                        throw new SeleniumError( message );
                    }
                    else {
                        var result= new AssertResult();
                        result.setFailed( message ); // see AssertHandler.prototype.execute() in chrome://selenium-ide/content/selenium-core/scripts/selenium-commandhandlers.js
                        this.result= result;
                        this.waitForCondition = this.result.terminationCondition;
                    }
                }
            }
        };
        
        /** Get a numeric index of the given element in selenium.seLiteInputs[]. If the element is already in selenium.seLiteInputs, returns its index. Otherwise put it there and return its (new) index.
         * @param {object} element
         * @param {string} locator
         * @return {number} index, or -1 if selenium.seLiteInputs is not set (which is when running a single Selenese command rather than a whole test suite)
         * */
        var inputToIndex= function inputToIndex( element, locator ) {
            if( selenium.seLiteInputs===undefined ) {
                return -1;
            }
            var index= selenium.seLiteInputs.indexOf(element);
            if( index>=0 ) {
                return index;
            }
            selenium.seLiteInputLocators.push( locator );
            return selenium.seLiteInputs.push( element ) -1;
        };
        /** Get a numeric index of the lement for the given locator. See inputToIndex(element).
         * @param {string} locator
         * @return {number} index
         * @TODO eliminate if not used
         * */
        var inputLocatorToIndex= function inputLocatorToIndex( locator ) {
            return inputToIndex( selenium.browserbot.findElement(locator), locator );
        };
        
        /** 
         * Based on Selenium.prototype.doSelect in chrome://selenium-ide/content/selenium-core/scripts/selenium-api.js.
         * */
        var inputLocatorToValue= function inputLocatorToValue( locator, optionLocator ) {
            var element = selenium.browserbot.findElement(locator);
            if( optionLocator!==undefined ) {
                if (!("options" in element)) {
                    throw new SeleniumError("Specified element is not a Select (has no options)");
                }
                locator = selenium.optionLocatorFactory.fromLocatorString(optionLocator);
                element= locator.findOption(element);
            }
            return element.value; //@TODO check
        };
        //@TODO <select><option>. Maybe: accept a function for elementValueField
        var inputBeforeChange= function inputBeforeChange( locator, elementValueField ) {
            if( selenium.seLiteInputs===undefined ) {// selenium.seLiteInputs is not set when running a single Selenese commad (rather than a whole test case)
                return;
            }
            elementValueField= elementValueField || 'value';
            var input= selenium.browserbot.findElement(locator);
            var inputIndex= inputToIndex(input, locator);
            if( selenium.seLiteOriginalInputValues[inputIndex]===undefined ) {
                selenium.seLiteOriginalInputValues[inputIndex]= input[elementValueField];
            }
        };

        var inputAfterChange= function inputAfterChange( locator, elementValueField ) {
            if( selenium.seLiteInputs===undefined ) {
                return;
            }
            elementValueField= elementValueField || 'value';
            var fieldsDownToFolder= settingsModule.getFieldsDownToFolder( /*folderPath:*/undefined, /*dontCache:*/true );
            var exitConfirmationCheckerMode= fieldsDownToFolder['exitConfirmationCheckerMode'].entry;
            
            var input= selenium.browserbot.findElement(locator);
            var inputIndex= inputToIndex(input, locator);
            var value= input[elementValueField];
            if( exitConfirmationCheckerMode==='basic' ) {
                selenium.seLiteModifiedInputValues[inputIndex]= value;
            }
            else
            if( exitConfirmationCheckerMode==='skipRevertChanges' ) {
                if( selenium.seLiteOriginalInputValues[inputIndex]!==value ) {
                    selenium.seLiteModifiedInputValues[inputIndex]= value;
                }
                else {
                    delete selenium.seLiteModifiedInputValues[inputIndex];
                }
            }
        };

        
        var oldDoType= Selenium.prototype.doType;
        Selenium.prototype.doType= function doType( locator, text ) {
            inputBeforeChange( locator );
            oldDoType.call( this, locator, text );
            inputAfterChange( locator );
        };
        
        var oldDoSelect= Selenium.prototype.doSelect;
        Selenium.prototype.doSelect= function doSelect( selectLocator, optionLocator ) {
            console.error( '1st ' +selectLocator+ ', extra ' +selectLocator.seLiteExtra );
            console.error( '2st ' +optionLocator+ ', extra ' +optionLocator.seLiteExtra );
            oldDoSelect.call( this, selectLocator, optionLocator );
        };
    }
    SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteExitConfirmationChecker']= loadedTimes+1;
} )();