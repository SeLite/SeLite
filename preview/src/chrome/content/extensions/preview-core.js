/*  Copyright 2016 Peter Kehl
    This file is part of SeLite Preview.

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

// Anonymous function to prevent leaking into Selenium global namespace
( function() {
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
    
    // @TODO asynchronous? <-
    // @TODO Extend Se IDE, so that there is a layer from Selenese to call async commands,
    // which won't block Se IDE, but Se IDE won't continue to the next commands, until the async result is back
    // (or unless Se IDE determines that the current command timed out).
    // -> async if..doIf, while..endWhile
    /** @see Editor.prototype.openPreview()
     *  @param {string} filePathOrURL
     *  @param {object} [config] This supports two fields: addTimestamp and base64. See Editor.prototype.openPreview().
     * */
    Selenium.encodeFile= function encodeFile( filePathOrURL, config={} ) {
        filePathOrURL.indexOf('#')<0 || SeLiteMisc.fail( 'Parameter filePathOrURL must not contain a #hash (fragment): ' +filePathOrURL );
        var url= Selenium.urlFor( filePathOrURL, true );
        if( 'addTimestamp' in config && config.addTimestamp ) {
            url+= ( url.indexOf('?')<0
                ? '?'
                : '&'
            )+ 'seLiteTimestamp=' +Date.now();
        }
        
        'base64' in config || (config.base64=false);
        
        var request = new XMLHttpRequest();
        request.open('GET', url, false);  // `false` makes the request synchronous
        request.send(null);
        if (request.status === 200) {
          var content= request.responseText;
          return config.base64
            ? btoa(content)
            : encodeURIComponent(content);
        }
        SeLiteMisc.fail( "Couldn't load " +url );
    }
}) ();