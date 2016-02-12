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

    /* Not used. The only place that would use it for now is SeLite Misc ovOptions.js. However, it would need this function to match parameters that don't have part '=value', too.
     *     This is here, rather than in selite-misc.js component, because it needs to access global variable 'selenium'.
     *  I've tried to have it in selite-misc.js and to load the component using
     *  Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js", {selenium: selenium} );
     *  above, but that failed, because variable selenium is not yet defined when this file itself is processed.
     *  @TODO Document that in http://selite.github.io/JavascriptComplex
     */
     /**  This returns value of given parameter (if present) from current URL;
     *  if parameter name is not given, then it returns value of the last parameter in the URL.
     *  @param {string} paramName optional
     *  @return {string} value of the parameter (unescaped of URL encoding); undefined if there are no parameters at all, or if the requested parameter is not present.
     
    SeLiteMisc.getUrlParam= function getUrlParam( paramName ) {
        SeLiteMisc.ensureType( paramName, 'string', 'paramName' );
        var search= selenium.browserbot.getCurrentWindow().location.search; // If the URL has no parameters, then this is an empty string
        if( search!=='' ) {
            search= search.substr( 1 ); // removing leading '?'
        }
        var pairs= search.split( '&' );
        var paramNameEquals= paramName+'=';
        for( var i=0; i<pairs.length; i++ ) {
            var pair= pairs[i];
            if( pair.indexOf(paramNameEquals)===0 ) {
                return unescape( pair.substr(paramNameEquals.length) );
            }
        }
        return undefined;
    };/**/

        var loginManagerInstance = Components.classes["@mozilla.org/login-manager;1"].
            getService(Components.interfaces.nsILoginManager);

    var extractHostname= function extractHostname( hostnameOrUseBaseURL ) {
        var testLocation= selenium.browserbot.getCurrentWindow().location;
        SeLiteMisc.ensureType( hostnameOrUseBaseURL, ['undefined', 'string', 'boolean'], 'hostnameOrUseBaseURL' );
        return hostnameOrUseBaseURL
            ? (typeof hostnameOrUseBaseURL==='string'
                ? hostnameOrUseBaseURL
                : selenium.browserbot.baseUrl
              )
            : testLocation.protocol+ '//' +testLocation.hostname+
                (testLocation.port
                ? ':' +testLocation.port
                : '');
    };

    /** This retrieves a web form password for a user. It doesn't work with .htaccess/HTTP authentication,
        but that can be retrieved too, see
        <br> https://developer.mozilla.org/En/Using_nsILoginManager
        <br> https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsILoginManager
        <br> https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsILoginInfo

        @param {string} username Case-sensitive username.
        @param {mixed} hostnameOrUseBaseURL String hostname in form 'https://server-name.some.domain'. It must contain http or https. It can contain the port (if not standard),
        but no trailing slash / neither any URI (path). Optional; if not present, then this uses the current website.
        If it's true (boolean), then the function uses Selenium IDE's "Base URL" field - which may be different to the test website (e.g. single-sign-on). @TODO Once/if https://github.com/SeleniumHQ/selenium/issues/1550 is fixed, I'd need to extract the protocol+host+port from Base URL here.
        @param {boolean} [returnLoginInfo] Whether to return nsILoginInfo object (if any); otherwise (and by default) this returns a string password (if any).
        @return {string} password if found; undefined otherwise
    */
    SeLiteMisc.loginManagerPassword= function loginManagerPassword( username, hostnameOrUseBaseURL, returnLoginInfo ) {
        SeLiteMisc.ensureType( username, 'string', 'username' );
        SeLiteMisc.ensureType( hostnameOrUseBaseURL, ['string', 'boolean', 'undefined'], 'hostnameOrUseBaseURL' );
        SeLiteMisc.ensureType( returnLoginInfo, ['boolean', 'undefined'], 'returnLoginInfo' );
        // You could also use passwordManager.getAllLogins(); it returns an array of nsILoginInfo objects
        var hostname= extractHostname( hostnameOrUseBaseURL );
        console.log( 'SeLiteMisc.loginManagerPassword(): hostname is ' +hostname );
        var logins = loginManagerInstance.findLogins(
            {}, hostname,
            '', // null doesn't work here. See https://developer.mozilla.org/En/Using_nsILoginManager: it says to use blank for web form auth.
            null
        );

        for( var i=0; i<logins.length; i++ ) {
            if( logins[i].username==username ) {
                return returnLoginInfo
                    ? logins[i]
                    : logins[i].password;
            }
        }
    };

    /** It inserts or updates details in Firefox Login Manager.
     * */
    SeLiteMisc.setLoginManagerEntry= function setLoginManagerEntry( username, password, hostnameOrUseBaseURL, formActionOrUserBaseURL ) {
        SeLiteMisc.ensureType( username, 'string', 'username' );
        SeLiteMisc.ensureType( password, 'string', 'password' );
        SeLiteMisc.ensureType( hostnameOrUseBaseURL, ['string', 'boolean', 'undefined'], 'hostnameOrUseBaseURL' );
        SeLiteMisc.ensureType( formActionOrUserBaseURL, ['string', 'boolean', 'undefined'], 'formActionOrUserBaseURL' );
        var loginInfo= Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                    .createInstance(Components.interfaces.nsILoginInfo);
        loginInfo.hostname= extractHostname( hostnameOrUseBaseURL );
        loginInfo.formSubmitURL= extractHostname( formActionOrUserBaseURL );
        loginInfo.httpRealm= null;
        loginInfo.username= username;
        loginInfo.password= password;
        loginInfo.usernameField= SeLiteSettings.commonSettings.fields['usernameField'].getDownToFolder().entry;
        loginInfo.passwordField= SeLiteSettings.commonSettings.fields['passwordField'].getDownToFolder().entry;
        var existingInfo= SeLiteMisc.loginManagerPassword( username, hostnameOrUseBaseURL, true );
        if( existingInfo===undefined ) {
            loginManagerInstance.addLogin( loginInfo );
        }
        else {
            loginManagerInstance.modifyLogin( existingInfo, loginInfo );
        }
    };

    var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    
    var originalSelenium= Selenium;
    Selenium= function Selenium(browserbot) {
        originalSelenium.call( this, browserbot );
        SeLiteMisc.selenium= this;
    };
    Selenium.prototype= originalSelenium.prototype;
    for( var functionName in originalSelenium ) {
        Selenium[functionName]= originalSelenium[functionName];
    }
    
    Selenium.prototype.doRunJavascript= function doRunJavascript( fileURL, scope ) {
        fileURL+= fileURL.indexOf('?')<0
            ? '?'
            : '&';
        fileURL+= Date.now();
        try {
            if( scope ) {
                subScriptLoader.loadSubScript( fileURL, scope );
            }
            else {
                subScriptLoader.loadSubScript( fileURL );
            }
        }
        catch( e ) {
            throw SeLiteMisc.addStackToMessage( e, true );
            // doRunJavascript@chrome://selite-misc/content/extensions/core-extension.js
        }
    };
}) ();