/*  Copyright 2014 Peter Kehl
    This file is part of SeLite Auto Check.

    SeLite Auto Check is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite Auto Check is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Auto Check.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

Components.utils.import( "chrome://selite-misc/content/selite-misc.js" );

// The following if() check is needed because Se IDE loads extensions twice - http://code.google.com/p/selenium/issues/detail?id=6697
if( Selenium.reloadScripts ) {
    // @TODO Use $$.fn.interceptAfter from SelBlocks/Global, if it becomes L/GPL
    ( function() {
        var originalReloadScripts= Selenium.reloadScripts;
        Selenium.reloadScripts= function reloadScripts() {
            originalReloadScripts();
            
        };
    } )();
}