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
    
    /** Load a given file asynchronously.
     *  @param {string} url URL of the file. It must not be a data: URL. It must not contain a #hash/fragment part.
     *  @return {Promise} A Promise that will resolve to content of the file. On failure or timeout it will be rejected.
     * */
    Selenium.prototype.loadFile= function loadFile( url ) {
        // Refuse data: URL. That's because even though XMLHttpRequest supports 'data:' URLs, then its responseXML is null. See https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
        if( url.indexOf( 'data:' )===0 ) {
            throw new Error( "Parameter documentURL must not ba a data: URL: " +url );
        }
        return new Promise( (resolve, reject)=> {
            var request = new XMLHttpRequest();
            request.onload= ()=> {
                if (request.readyState === 4) {
                    if (request.status === 200) {
                        resolve( request.responseText );
                    }
                    else {
                        reject( "Couldn't load " +url+ ". " +request.statusText );
                    }
                }
            };
            request.onerror= (event)=> {
                reject( "Couldn't load " +url );
            };
            request.ontimeout= (event)=> {
                reject( "Loading " +url+ " timed out." );
            };

            request.open("GET", url, true );
            request.timeout= this.defaultTimeout-50;
            request.send( null );
        } );
    };
    
    /** Encode a file as a data: URI. See https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs.
     *  It also loads content of files referenced by <img src="...">, <link href="..." with rel="stylesheet" or with as="script" or with type="...">,  <script src="...">. It changes src="..." or href="..." of those elements to use data: containing the loaded content.
     *  @see Editor.prototype.openPreview()
        @param {string} filePathOrURL File path or URL of the HTML/XML preview file/template. If it's a file path, you can use either / or \ as directory separators (they will get translated for the current system). To make it portable, specify it as a relative path and pass it appended to result of SeLiteSettings.getTestSuiteFolder(). See also parameter url of Selenium.prototype.loadFile().
     *  @param {boolean} [base64] Whether to base64-encode, instead of url-encode.
     *  @return {Promise} Promise that resolves to encoded content; it rejects on error or on timeout. On success it resolves to string, which is a data: URI for content of given documentURL, including content of images/scripts/stylesheets through data: URIs, too.
     * */
    Selenium.prototype.encodeFile= function encodeFile( filePathOrURL, base64=false ) {
        var url= Selenium.urlFor( filePathOrURL, true ); // if a filepath, this translates it to a URL
        var uri= Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI( url, null, null);
        
        return this.loadFile( url ).then( (content)=>{
            return Selenium.encodeContent( content, nsIMIMEService.getTypeFromURI( uri ), base64 );
        } );
    };
    
    /**
    @return {Promise} Promise that resolved to encoded content; it rejects on error or on timeout.
    */
    Selenium.encodeContent= function encodeContent( content, mime, base64=false ) {
        //  TODO When you pass the result as a part of processed HTML of another file - e.g. the result of this function will serve in as a URL in link="..." or src="..." attributes, then enclose the encoded result within quotes "...", not within apostrophes '...' - because the encoded text may contain apostrophes, but no quotes.

            //@TODO var body= doc.getElementsByTagNameNS( "http://www.w3.org/1999/xhtml", 'body')[0]; // this works even if the document's MIME is text/html rather than text/xml
            //body.innerHTML;

            // Loop over elements. If can't get the file, skip.
            //Convert relative links to absolute. Following leaves already absolute links unmodified.
            //var parentAbsoluteURL= new URL( '.', documentURL ).href; // Based on https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
            // Try to modify DOM and then user innerHTML

        var encoded= base64
            ? btoa(content)
            : encodeURIComponent(content);
        return 'data:' +mime+
            (base64
                ? ';base64'
                : ''
            ) + ',' + encoded;
    };
}) ();