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
    var console= Components.utils.import("resource://gre/modules/Console.jsm", {}).console;
    
    var nsIMIMEService= Components.classes["@mozilla.org/mime;1"].getService(Components.interfaces.nsIMIMEService);
                      
    // @TODO asynchronous? <-
    // @TODO Extend Se IDE, so that there is a layer from Selenese to call async commands,
    // which won't block Se IDE, but Se IDE won't continue to the next commands, until the async result is back
    // (or unless Se IDE determines that the current command timed out).
    // -> async if..doIf, while..endWhile
    /** Encode a file as a data: URI. See https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs.
     *  It also loads content of files referenced by <img src="...">, <link href="..." with rel="stylesheet" or with as="script" or with type="...">,  <script src="...">. It changes src="..." or href="..." of those elements to use data: containing the loaded content.
     *  @see Editor.prototype.openPreview()
     *  @param {string} documentURL URL of the HTM or XHTML document. This (as passed) can't be a data: URL.
     *  @param {boolean} [base64] Whether to base64-encode, instead of url-encode.
     *  @return {string} data: URI for content of given documentURL, including content of images/scripts/stylesheets through data: URLs, too.
     * */
    Selenium.encodeFile= function encodeFile( documentURL, base64=false ) {
        // Refuse data: URL. XMLHttpRequest supports data: URLs, but then responseXML is null. See https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
        if( documentURL.indexOf( 'data:' )>=0 ) {
            throw new Error( "Parameter documentURL must not ba a data: URL: " +documentURL );
        }
        
        var request = new XMLHttpRequest();
        request.open('GET', documentURL, false);  // `false` makes the request synchronous
        request.send(null);
        if (request.status === 200) {
          var mime= nsIMIMEService.getTypeFromURI( documentURL );
          var content= request.responseText;
          
          //  Enclose the encoded result within quotes "...", not within apostrophes '...' - because the encoded text may contain apostrophes, but no quotes.
          if( request.responseXML ) {
              var doc= request.responseXML; // Not defined for data: URLs
              
              // getElementsByTagNameNS( "http://www.w3.org/1999/xhtml", ...) works even if the document's MIME is text/html rather than text/xml
              var body= doc.getElementsByTagNameNS( "http://www.w3.org/1999/xhtml", 'body')[0];
              body.setAttribute( 'onload', 'alert("hi")');
              //body.innerHTML;
              
              // Loop over elements. If can't get the file, skip.
              //Convert relative links to absolute. Following leaves already absolute links unmodified.
              var parentAbsoluteURL= new URL( '.', documentURL ).href; // Based on https://developer.mozilla.org/en-US/docs/Web/API/URL/URL

              // Try to modify DOM and then user innerHTML
          }
          // .xhtml -->application/xhtml+xml - which in Firefox invokes Javascript just like text/xml does
          
          var encoded= base64
            ? btoa(content)
            : encodeURIComponent(content);
          return 'data:' +mime+
            (base64
                ? ';base64'
                : ''
            ) + ',' + encoded;
        }
        SeLiteMisc.fail( "Couldn't load " +documentURL );
    }
}) ();