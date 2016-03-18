/*  Copyright 2015 Peter Kehl
    This file is part of SeLite Misc.

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

// The primary/initial purpose here was to make Selenium IDE 'Log' tab accessible from Misc JS module. It's only for main Selenium IDE instance and not for auxiliary ones (i.e. Selenium IDE instances normally open with URL ending with '#GREEN' etc. - see http://selite.github.io/SeleniumIde) and neither for Selenium IDE in Firefox sidebar (Firefox menu > View > Sidebar > Selenium IDE - which has a different URL: chrome://selenium-ide/content/selenium-ide-sidebar.xul).
if( window.location.href==='chrome://selenium-ide/content/selenium-ide.xul' ) {
    // LOG is defined, but it won't log into Selenium IDE 'Log' tab.
    // This is being called from Editor() constructor, hence editor, editor.selDebugger and editor.selDebugger.log are not set up yet. Only after Editor() loads IDE extensions (including this one), it sets its field selDebugger to an instance of Debugger.
    // When I captured selDebugger.log from window.setTimeout() here, it was different to global LOG at the time of running Selenese.
    // The following tail-overrides Debugger() with code that sets up a tail-override of 'this.init', i.e. Debugger's instance's init(), to capture its this.runner.LOG, after the original init() loads chrome://selenium-ide/content/selenium-runner.js. Beware that it's differen to global LOG at that time.
    ( function() {
        var originalDebugger= Debugger;
        Debugger= function Debugger( editor ) {
            
            originalDebugger.call( this, editor );
            
            var originalInit= this.init;
            this.init= function init() {
                
                originalInit.call( this );
                SeLiteMisc.LOG= this.runner.LOG;
            };
        };
        for( var fieldName in originalDebugger ) {
            Debugger[fieldName]= originalDebugger[fieldName];
        }
        Debugger.prototype= originalDebugger.prototype;
    } ) ();
}
