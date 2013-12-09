/*  Copyright 2011, 2012, 2013 Peter Kehl
    This file is part of SeLite Misc.

    SeLite Miscellaneous is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite Miscellaneous is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Miscellaneous.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

var SeLiteMisc= Components.utils.import( "chrome://selite-misc/content/selite-misc.js", {} );

Selenium.prototype.robustNullToken= 'robustNullReplacementString';

/** This detects whether an expression within qs{expression} or prefixqs{expression} or prefixqs{expression}postfix evaluated into null.
 *  @param valueOrSimpleLocator a result of 'expression' as passed to a Selenium action; its value
 *  @return bool as described
 */
function isRobustNull( valueOrSimpleLocator ) {
    // A bit simplified, but good enough. Prefix and Postfix around qs{...} should be simple and shouldn't contain robustNullToken
    return typeof valueOrSimpleLocator=='string' && valueOrSimpleLocator.indexOf(Selenium.prototype.robustNullToken)>=0;
};

/** It returns value of given parameter (if present) from current URL;
 *  if parameter name is not given, then it returns value of the last parameter in the URL.
 *  @param string paramName optional
 *  @return string value of the parameter; null if there are no parameters at all, or if the requested parameter is not present.
 *  I've tried to have this as a Selenium command, using
 *  Selenium.prototype.getUrlParam= function( locator, unused ) {...};
 *  That auto-generated Selenium command storeUrlParam, but the parameters were not passed to it!
 */
function getUrlParam( paramName ) {
    var search= selenium.browserbot.getCurrentWindow().location.search; // If the URL has no parameters, then this is an empty string
    if( search!=='' ) {
        search= search.substr( 1 ); // removing leading '?'
    }
    var pairs= search.split( '&' );
    if( paramName ) {
        var paramNameEquals= paramName+'=';
        for( var i=0; i<pairs.length; i++ ) {
            var pair= pairs[i];
            if( pair.indexOf(paramNameEquals)==0 ) {
                return pair.substr( paramNameEquals.length );
            }
        }
    }
    else
    if( pairs.length>0 ) {
        var pair= pairs[ pairs.length-1 ];
        var equalsIndex= pair.indexOf('=');
        if( equalsIndex>=0 ) {
            return pair.substr( equalsIndex+1 );
        }
    }
    return null;
}

