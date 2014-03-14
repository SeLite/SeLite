/*  Copyright 2014 Peter Kehl
    This file is part of SeLite Auto Check.
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";
var SeLiteAutoCheck= {};

/** Parent class of all Auto Check detectors. For description of items of parameters required, refused and ignored check the actual implementation subclasses.
 *  @param {string[]} required Array of entries matching any required contents. In default implementation an entry can be any Selenese locator.
 *  @param {string[]) refused Array of entries matching any refused contents. In default implementation an entry can be any Selenese locator.
 *  @param {string[]) ignored Array of entries matching any ignored notices/warnings/errors. In default implementation an entry can be any Selenese locator.
 *  @param {boolean} assert Whether to run the checks as assertions; otherwise they are run as validation only. Optional, false by default.
 * */
SeLiteAutoCheck.Detector= function Detector( required, refused, ignored, assert ) {
    this.required= required || [];
    this.refused= refused || [];
    this.ignored= ignored || [];
    this.assert= assert || false;
    Array.isArray(this.required) || SeLiteMisc.fail( 'parameter required must be an array, if provided' );
    Array.isArray(this.refused) || SeLiteMisc.fail( 'parameter refused must be an array, if provided' );
    Array.isArray(this.ignored) || SeLiteMisc.fail( 'parameter ignoredmust be an array, if provided' );
    typeof this.assert==='boolean' || SeLiteMisc.fail( 'parameter assert must be a boolean, if provided' );
};
SeLiteAutoCheck.DetectorPHP.prototype.checkRequired= function checkRequired( document ) {
    for( var i=0; i<this.required.length; i++ ) {//@TODO for..of.. once NetBeans supports it
        if( eval_locator( this.required[i], document ).length===0 ) {
            
        }
    }
};


/** Auto Check for PHP (optionally with XDebug).
 * @param {string[]} required Array of locators.
 * @param {string[]} refused Array of locators.
 * @param {string[]} ignored Array of XPath expressions. They must be relative within Xdebug container (if used) - use '.' to refer to that container. They must not start with '//' or 'xpath='. (This doesn't allow location methods other than XPath. See implementation of Selenium IDE's eval_locator()).
 *  @param {boolean} assert See the same parameter of SeLiteAutoCheck.Detector().
*/
SeLiteAutoCheck.DetectorPHP= function DetectorPHP( required, refused, ignored, assert ) {
    SeLiteAutoCheck.Detector.call( this, required, refused, ignored, assert );
};
SeLiteAutoCheck.DetectorPHP.prototype= new SeLiteAutoCheck.Detector();
SeLiteAutoCheck.DetectorPHP.prototype.constructor= SeLiteAutoCheck.DetectorPHP;

SeLiteAutoCheck.DetectorPHP.prototype
table class="xdebug-error

var EXPORTED_SYMBOLS= ['SeLiteAutoCheck'];