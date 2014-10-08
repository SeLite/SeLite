/*  Copyright 2014 Peter Kehl
    This file is part of SeLite Exit Confirmation Checker.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

/** @var {object} Namespace-like holder. */
var SeLiteExitConfirmationChecker;
if( SeLiteExitConfirmationChecker===undefined ) {
    SeLiteExitConfirmationChecker= {};
}
// Anonymous function to prevent leaking into Selenium global namespace
( function( global ) {
    Components.utils.import( "chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js" );
    var loadedTimes= SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteExitConfirmationChecker'] || 0;
    if( loadedTimes===1 ) { // Setup the overrides on the second load
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.Module.forName( 'extensions.selite-settings.common' );
        
        // Override BrowserBot defined in Selenium IDE's chrome://selenium-ide/content/selenium-core/scripts/selenium-browserbot.js
        var oldBrowserBot= BrowserBot;
        BrowserBot= function BrowserBot(topLevelApplicationWindow) {
          console.debug( 'BrowserBot() called as overriden by SeLite Exit Confirmation Checker.' );
          oldBrowserBot.call( this, topLevelApplicationWindow );
          
          //var self= this; // @TODO Doc: If you need to set fields on the current object, for some reason you can't set them on 'this', but you have to use 'self' instead. See chrome://selenium-ide/content/selenium-core/scripts/selenium-browserbot.js -> definition of function recordPageLoad.
          var oldRecordPageLoad= this.recordPageLoad;
          this.recordPageLoad = function recordPageLoad(elementOrWindow) {
              // This gets registered as a handler & called only for any page that is a direct result of Selenese actions but not a result of a redirect.
              oldRecordPageLoad.call( this, elementOrWindow );
              console.debug( "SeLite Exit Confirmation Checker's override of BrowserBot.recordPageLoad() called." );
              // When I've overriden self.getCurrentWindow(true).onbeforeunload here, it had no effect. It must be too early here. The same when I've overriden self.getCurrentWindow(true).onload here which overrode .onbeforeunload. So here I set a flag, and I consume it in nextCommand() below
              SeLiteExitConfirmationChecker.shouldOverrideOnBeforeUnload= true;
          };
        };
        BrowserBot.prototype= oldBrowserBot.prototype;
        BrowserBot.prototype.constructor= BrowserBot;
        for( var classField in oldBrowserBot ) {
            BrowserBot[classField]= oldBrowserBot[classField];
        }

        SeLiteExitConfirmationChecker.overrideOnBeforeUnload= function overrideOnBeforeUnload() {
            console.debug( "SeLiteExitConfirmationChecker.overrideOnBeforeUnload()" );
            /** @var object {number index of the input in SeLiteExitConfirmationChecker.inputs => (string|boolean) original value } */
            SeLiteExitConfirmationChecker.originalInputValues= {}; // It could be an array. But SeLiteExitConfirmationChecker.modifiedInputValues can't be an array and therefore both are objects serving as associative arrays.
            /** @var object {number index of the input in SeLiteExitConfirmationChecker.inputs => (string|boolean) modified value } */
            SeLiteExitConfirmationChecker.modifiedInputValues= {};
            /** @var Array of inputs. Used to assign a numeric ID to identify each modified input (that ID is an index in this array). I can't use Selenium locators to identify the modified inputs, because the same input can be referred to (and modified through) multiple locators. */
            SeLiteExitConfirmationChecker.inputs= [];
            /** @var Array of strings, each being the first used locator for the respective input. Used only for reporting the inputs to the user. */
            SeLiteExitConfirmationChecker.inputLocators= [];

            var window= selenium.browserbot.getCurrentWindow(true);
            var originalOnBeforeUnload= window.onbeforeunload;
            if( originalOnBeforeUnload && originalOnBeforeUnload.overridenBySeLite ) {
                console.warn( 'SeLite ExitConfirmationChecker already overrode current window.onbeforeunload(). Have you called SeLiteExitConfirmationChecker.overrideOnBeforeUnload() where it is not needed?' );
                return;
            }
            SeLiteExitConfirmationChecker.window= window;
            window.onbeforeunload= function onbeforeunload() {
                console.debug('SeLite ExitConfirmationChecker: window.onbeforeunload() start');
                var fieldsDownToFolder= settingsModule.getFieldsDownToFolder( /*folderPath:*/undefined, /*dontCache:*/true );
                if( !fieldsDownToFolder['exitConfirmationCheckerMode'] ) {
                    console.debug( "SeLite ExitConfirmationChecker: no fieldsDownToFolder['exitConfirmationCheckerMode']");
                    return;
                }
                var exitConfirmationCheckerMode= fieldsDownToFolder['exitConfirmationCheckerMode'].entry;
                if( exitConfirmationCheckerMode.ignored ) {
                    console.debug( 'SeLite ExitConfirmationChecker: window.onbeforeunload ignored');
                    return;
                }
                if( !originalOnBeforeUnload ) {
                    console.debug( 'SeLite ExitConfirmationChecker: No previous window.onbeforeunload' );
                    return;
                }
                var originalResult= originalOnBeforeUnload.call(this);
                if( exitConfirmationCheckerMode.inactive ) {
                    console.debug( 'SeLite ExitConfirmationChecker: window.onbeforeunload inactive - returning originalResult: ' +originalResult );
                    return originalResult;
                }
                console.debug( 'SeLite ExitConfirmationChecker: window.onbeforeunload finishing, not returning anything');
                // I can't throw an error here - Firefox ignores it. So I set SeLiteExitConfirmationChecker.appAskedToConfirm and I handle it in _executeCurrentCommand() below.
                SeLiteExitConfirmationChecker.appAskedToConfirm= originalResult!==undefined;
                // I don't return anything, so there won't be any confirmation popup.
            };
            window.onbeforeunload.overridenBySeLite= true;
        };
        
        var originalSeLitePostCurrentCommand= global.seLitePostCurrentCommand;
        global.seLitePostCurrentCommand= function seLitePostCurrentCommand() {
            console.debug('SeLite ExitConfirmationChecker: seLitePostCurrentCommand');
            if( SeLiteExitConfirmationChecker.shouldOverrideOnBeforeUnload ) {
                SeLiteExitConfirmationChecker.overrideOnBeforeUnload();
                SeLiteExitConfirmationChecker.shouldOverrideOnBeforeUnload= false;
            }
            originalSeLitePostCurrentCommand.call( this );
            
            if( !this.result.failed ) { // See also comments in auto-check.js
                if( SeLiteExitConfirmationChecker.modifiedInputValues!==undefined && SeLiteExitConfirmationChecker.appAskedToConfirm!==undefined ) {
                    var hadModifiedInputs= Object.keys( SeLiteExitConfirmationChecker.modifiedInputValues ).length>0;
                    var appAskedToConfirm= SeLiteExitConfirmationChecker.appAskedToConfirm;
                    SeLiteExitConfirmationChecker.appAskedToConfirm= undefined; // Clear it no matter whether the following if(..) condition is true or not

                    if( appAskedToConfirm!==hadModifiedInputs ) {
                        var message= "Web application's window.onbeforeunload() "
                                +(appAskedToConfirm ? 'asked' : "didn't ask")+ ' to confirm closing of the window/tab, but there ' 
                                +(hadModifiedInputs ? 'were some' : "weren't any")+ ' modified inputs';
                        if( hadModifiedInputs ) {
                            message+= ':';
                            for( var index in SeLiteExitConfirmationChecker.modifiedInputValues ) {
                                message+= '\n' +SeLiteExitConfirmationChecker.inputLocators[index];
                            }
                        }
                        else {
                            message+= '.';
                        }
                        var fieldsDownToFolder= settingsModule.getFieldsDownToFolder( /*folderPath:*/undefined, /*dontCache:*/true );
                        if( fieldsDownToFolder['exitConfirmationCheckerAssert'] && fieldsDownToFolder['exitConfirmationCheckerAssert'].entry ) {
                            throw new SeleniumError( message );
                        }
                        else {
                            // see AssertHandler.prototype.execute() in chrome://selenium-ide/content/selenium-core/scripts/selenium-commandhandlers.js
                            var result= new AssertResult();
                            result.setFailed( "(Ignore this log line, see the other one. It's due to https://code.google.com/p/selite/wiki/ThirdPartyIssues > verify* should show the diff)" );
                            this.result= result;
                            this.waitForCondition = this.result.terminationCondition;
                            LOG.error( message );
                        }
                    }
                }
            }
        };
        
        /** Get a numeric index of the given element in SeLiteExitConfirmationChecker.inputs[]. If the element is already in SeLiteExitConfirmationChecker.inputs, returns its index. Otherwise put it there and return its (new) index. Only use it when current window.onbeforeunload was overriden by ExitConfirmationChecker.
         * @private
         * @param {object} element
         * @param {string} locator
         * @return {number} index (an existing one or new).
         * */
        var inputToIndex= function inputToIndex( element, locator ) {
            var index= SeLiteExitConfirmationChecker.inputs.indexOf(element);
            if( index>=0 ) {
                return index;
            }
            SeLiteExitConfirmationChecker.inputLocators.push( locator );
            return SeLiteExitConfirmationChecker.inputs.push( element ) -1;
        };
        
        /** @private Helper function to retrieve a value from an element, or to call a given function on the element.
         *  @param {object} input
         *  @param {(string|function|undefined)} [elementValueField='value'] Name of the attribute that keeps the value. If a function, then it will be called with input as its only parameter.
         *  @return {*} value (or an array of values)
         * */
        var elementValue= function elementValue( input, elementValueField ) {
            elementValueField= elementValueField || 'value';
            if( typeof elementValueField==='function' ) {
                return elementValueField( input );
            }
            return input[elementValueField];
        };
        
        /** Call this after a Selenese command modified an input that should trigger window.onbeforeunload. Users should call this only for custom inputs (or custom Selenese commands). See also SeLiteExitConfirmationChecker.inputAfterChange().
         * @param {object} locator
         * @param {*} elementValueField Name of the value field, or a function that returns the value.
         * @param {boolean} [ignoreIfNotOverriden] Whether this should pass quietly if the application has not overriden window.onbeforeunload().
         * @returns {void}
         */
        SeLiteExitConfirmationChecker.inputBeforeChange= function inputBeforeChange( locator, elementValueField, ignoreIfNotOverriden ) {
            // @TODO Consider: if( !selenium.browserbot.getCurrentWindow(true).overridenBySeLite )
            if( SeLiteExitConfirmationChecker.window!==selenium.browserbot.getCurrentWindow(true) ) {
                SeLiteExitConfirmationChecker.window= undefined; // To assist garbage collector
                if( !ignoreIfNotOverriden ) {
                    throw Error( "SeLite ExitConfirmationChecker didn't override current window.onbeforeunload, yet you've called SeLiteExitConfirmationChecker.inputBeforeChange() without ignoreIfNotOverriden=true." );
                }
                console.debug( "SeLite ExitConfirmationChecker didn't override current window.onbeforeunload(), therefore SeLiteExitConfirmationChecker.inputBeforeChange() can't validate behaviour of window.onbeforeunload()." );
                return;
            }
            var input= selenium.browserbot.findElement(locator);
            var inputIndex= inputToIndex(input, locator);
            if( SeLiteExitConfirmationChecker.originalInputValues[inputIndex]===undefined ) {
                SeLiteExitConfirmationChecker.originalInputValues[inputIndex]= elementValue( input, elementValueField );
            }
        };
        
        /** Call this after a Selenese command modified an input that should trigger a confirmation from window.onbeforeunload(). For parameters see SeLiteExitConfirmationChecker.inputBeforeChange().
         * */
        SeLiteExitConfirmationChecker.inputAfterChange= function inputAfterChange( locator, elementValueField, ignoreIfNotOverriden ) {
            if( SeLiteExitConfirmationChecker.window!==selenium.browserbot.getCurrentWindow(true) ) {
                SeLiteExitConfirmationChecker.window= undefined; // To assist garbage collector
                if( !ignoreIfNotOverriden ) {
                    throw Error( "SeLite ExitConfirmationChecker didn't override current window.onbeforeunload, yet you've called SeLiteExitConfirmationChecker.inputAfterChange() without ignoreIfNotOverriden=true." );
                }
                console.debug( "SeLite ExitConfirmationChecker didn't override current window.onbeforeunload(), therefore SeLiteExitConfirmationChecker.inputBeforeChange() can't validate behaviour of window.onbeforeunload()." );
                return;
            }
            var fieldsDownToFolder= settingsModule.getFieldsDownToFolder( /*folderPath:*/undefined, /*dontCache:*/true );
            var exitConfirmationCheckerMode= fieldsDownToFolder['exitConfirmationCheckerMode'].entry;
            
            var input= selenium.browserbot.findElement(locator);
            var inputIndex= inputToIndex(input, locator);
            var value= elementValue( input, elementValueField );
            if( exitConfirmationCheckerMode.includeRevertedChanges ) {
                SeLiteExitConfirmationChecker.modifiedInputValues[inputIndex]= value;
            }
            else
            if( exitConfirmationCheckerMode.skipRevertedChanges ) {
                if( SeLiteExitConfirmationChecker.originalInputValues[inputIndex]!==value ) {
                    SeLiteExitConfirmationChecker.modifiedInputValues[inputIndex]= value;
                }
                else {
                    delete SeLiteExitConfirmationChecker.modifiedInputValues[inputIndex];
                }
            }
        };
        
        /** This stores value(s) of selected option(s) of a &lt;select&gt; input (and it handles inputs that allow multi selection). When storing selected option(s) of a select input, I can't just store selectInput.selectedOptions. This returns same (but modified) HTMLCollection object after (de)selecting any options. So I need to make a copy of the list of the options. I also JSON-encode them, so I can compare the results easily (since I can't use == to compare arrays item by item).
         * @param {object} selectInput
         * @returns {string} JSON-encoded array of values of selected options
         */
        SeLiteExitConfirmationChecker.selectedOptions= function selectedOptions( selectInput ) {
            var result= [];
            for( var i=0; i<selectInput.selectedOptions.length; i++ ) {
                result.push( selectInput.selectedOptions[i].value );
            }
            return JSON.stringify( result );
        };
        
        var oldDoType= Selenium.prototype.doType;
        Selenium.prototype.doType= function doType( locator, text ) {
            SeLiteExitConfirmationChecker.inputBeforeChange( locator, undefined, true );
            oldDoType.call( this, locator, text );
            SeLiteExitConfirmationChecker.inputAfterChange( locator, undefined, true );
        };
        
        if( Selenium.prototype.doTypeRandom ) { // SeLite Commands is present. So I override it here.
            var oldDoTypeRandom= Selenium.prototype.doTypeRandom;
            Selenium.prototype.doTypeRandom= function doTypeRandom( locator, paramsOrStore ) {
                SeLiteExitConfirmationChecker.inputBeforeChange( locator, undefined, true );
                oldDoTypeRandom.call( this, locator, paramsOrStore );
                SeLiteExitConfirmationChecker.inputAfterChange( locator, undefined, true );
            };
        }
        
        var oldDoSelect= Selenium.prototype.doSelect;
        Selenium.prototype.doSelect= function doSelect( selectLocator, optionLocator ) {
            SeLiteExitConfirmationChecker.inputBeforeChange( selectLocator, 'selectedIndex', true );
            oldDoSelect.call( this, selectLocator, optionLocator );
            SeLiteExitConfirmationChecker.inputAfterChange( selectLocator, 'selectedIndex', true );
        };
        
        // TODO addSelection, removeSelection, removeAllSelections
        
        // @TODO 'check', 'uncheck'
        // @TODO click at a checkbox
        // @TODO selectRandom, typeRandom, clickRandom
    }
    SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteExitConfirmationChecker']= loadedTimes+1;
} )( this );