/*  Copyright 2011, 2012, 2013, 2014 Peter Kehl
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

Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js" );

// Anonymous function to prevent leaking into Selenium global namespace
( function() {
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;

/*  This is here, rather than in selite-misc.js component, because it needs to access global variable 'selenium'.
 *  I've tried to have it in selite-misc.js and to load the component using
 *  Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js", {selenium: selenium} );
 *  above, but that failed, because variable selenium is not yet defined when selite-misc-core.js is processed.
 *  @TODO Document that in JavascriptAdvanced.wiki
 */
 /**  This returns value of given parameter (if present) from current URL;
 *  if parameter name is not given, then it returns value of the last parameter in the URL.
 *  @param string paramName optional
 *  @return string value of the parameter; null if there are no parameters at all, or if the requested parameter is not present.
 *  I've tried to have this as a Selenium command, using
 *  Selenium.prototype.getUrlParam= function( locator, unused ) {...};
 *  That auto-generated Selenium command storeUrlParam, but the parameters were not passed to it!
 */
SeLiteMisc.getUrlParam= function getUrlParam( paramName ) {
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
};

    var loginManagerInstance = Components.classes["@mozilla.org/login-manager;1"].
        getService(Components.interfaces.nsILoginManager);

/** This retrieves a web form password for a user. It doesn't work with .htaccess/HTTP authentication,
    but that can be retrieved too, see
    <br> https://developer.mozilla.org/En/Using_nsILoginManager
    <br> https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsILoginManager
    <br> https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsILoginInfo

    @param {string} username Case-sensitive username.
    @param {mixed} hostnameOrUseBaseURL String hostname in form 'https://server-name.some.domain'. It must contain http or https. It can contain the port (if not standard),
    but no trailing slash / neither any URI (path). Optional; if not present, then this uses the current website.
    If it's true (boolean), then the function uses Selenium IDE's "Base URL" field - which may be different to the test website (e.g. single-sign-on). @TODO Once/if http://code.google.com/p/selenium/issues/detail?id=3116 is fixed, I'd need to extract the protocol+host+port from Base URL here.
    @return {string} password if found; null otherwise
*/
SeLiteMisc.loginManagerPassword= function loginManagerPassword( username, hostnameOrUseBaseURL ) {
    // You could also use passwordManager.getAllLogins(); it returns an array of nsILoginInfo objects
    var testLocation= selenium.browserbot.getCurrentWindow().location;
    SeLiteMisc.ensureType( hostnameOrUseBaseURL, ['undefined', 'string', 'boolean'], 'Param hostnameOrUseBaseURL must be undefined, string or a boolean.' );
    var hostname= hostnameOrUseBaseURL
        ? (typeof hostnameOrUseBaseURL==='string'
            ? hostnameOrUseBaseURL
            : selenium.browserbot.baseUrl
          )
        : testLocation.protocol+ '//' +testLocation.hostname+
            (testLocation.port
            ? ':' +testLocation.port
            : '');
    console.log( 'SeLiteMisc.loginManagerPassword(): hostname is ' +hostname );
    var logins = loginManagerInstance.findLogins(
        {}, hostname,
        '', // null doesn't work here. See https://developer.mozilla.org/En/Using_nsILoginManager: it says to use blank for web form auth.
        null
    );
    
    for( var i=0; i<logins.length; i++ ) {
        if( logins[i].username==username ) {
            return logins[i].password;
        }
    }
    return null;
};

}) ();