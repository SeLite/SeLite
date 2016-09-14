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

// Following assignments is purely for JSDoc.
/** @class */
Selenium= Selenium;

// Anonymous function to prevent leaking into Selenium global namespace
( function() {
    //var console= Components.utils.import("resource://gre/modules/Console.jsm", {}).console;
    var nsIMIMEService= Components.classes["@mozilla.org/mime;1"].getService(Components.interfaces.nsIMIMEService);
    var StringView= Components.utils.import("chrome://selite-preview/content/StringView.js", {}).StringView;
    
    /** Load a given file asynchronously.
     *  @param {string} url URL of the file. It must be a full URL (including the scheme/protocol).
     *  @param {boolean} [binary=false] Whether it's a binary file. If unsure, pass true.
     *  @return {Promise} A Promise that will resolve to content of the file: either  to a string (if binary is not set/false), or to an ArrayBuffer (if binary is true). On failure or timeout it will be rejected.
     * */
    Selenium.prototype.loadFile= function loadFile( url, binary=false ) {
        // Refuse data: URL. That's because even though XMLHttpRequest supports 'data:' URLs, then its responseXML is null. See https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
        if( url.indexOf( 'data:' )===0 ) {
            throw new Error( "Parameter url must not be a 'data:' URL: " +url );
        }
        return new Promise( (resolve, reject)=> {
            var request = new XMLHttpRequest();
            !binary || (request.responseType= 'blob');
            request.onload= ()=> {
                if (request.readyState === 4) {
                    if (request.status === 200) {
                        if( !binary ) {
                            resolve( request.responseText );
                        }
                        else {
                            var reader = new FileReader();
                            reader.addEventListener( "loadend",
                                ()=> resolve( reader.result )
                            );
                            reader.readAsArrayBuffer( request.response );                                         }
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
    
    /** Encode a file as a <code>data:</code> URI. See https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs.
     *  It also loads content of files referenced by <code>&lt;img src="..."&gt;, &lt;link href="..." with rel="stylesheet" or with as="script" or with type="..."&gt;,  &lt;script src="..."&gt;</code>. It changes src="..." or href="..." of those elements to use <code>data:</code> containing the loaded content.
     *  @see Editor.prototype.openPreview()
        @param {string} filePathOrURL File path or URL of the HTML/XML preview file/template. It must be a full URL (including the scheme/protocol), or a full path. If it's a file path, you can use either / or \ as directory separators (they will get translated for the current system). To make it portable, specify it as a relative path and pass it appended to result of SeLiteSettings.getTestSuiteFolder(). It must not be a data: URL. It must not contain a #hash/fragment part.
     *  @param {boolean|undefined|string|Array|RegExp|function} [useURLencoding=false] Whether to apply URL encoding (English text stays human-readable) rather than base 64 encoding (human-unreadable). Thri-state boolean or other type:
     *  -If true, then this always uses URL encoding. (However, if the file is binary, the result may not work with decodeURIComponent(). See also https://tools.ietf.org/html/rfc3986#page-12. It seems to work for binry files in main browsers, evne though Firefox generates a warning in Browser Console.)
     *  -If undefined, then it's automatic: URL encoding for text files (whose MIME starts with "text/" and for .xhtml files) and base 64 for the rest.
     *  -If false, then this always uses base 64 encoding.
     *  -If string "automatic" (case-sensitive), then use URL encoding for text files, base64 encoding for
     *  -If a string, an array, a regex: matching MIME prefix for files to URL encode, in addition to the above automatic rule.
     *  -If a function, then useURLencoding(mimeString) determines whether to use URL encoding, in addition to the above automatic rule.
     *  @param {function} [contentHandler=undefined] Function(content) => Promise of a string (the handled content). Used for deep/recursive handling. Parameter url is used only for resolving relative URLs for documents that are handled recursively.
     *  @return {Promise} Promise that resolves to encoded content (and handled, if contentHandler is passed); it rejects on error or on timeout. On success it resolves to string, which is a data: URI for content of given documentURL, including content of images/scripts/stylesheets through data: URIs, too.
     * */
    Selenium.prototype.encodeFile= function encodeFile( url, useURLencoding=false, contentHandler=undefined, data=undefined, dataPlaceholder=undefined ) {
        var uri= Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI( url, null, null);
        var mime= nsIMIMEService.getTypeFromURI( uri );
        var contentIsBinary= !mime.startsWith('text/')/*->This covers text/html, text/xml, text/css and text/javascript.*/ && mime!=='application/xhtml+xml';
        
        return this.loadFile( url,  contentIsBinary ).then(
            contentWithoutData => {
                debugger;
                return dataPlaceholder!==undefined
                    ? contentWithoutData.replace( new RegExp(dataPlaceholder, 'g'), JSON.stringify(data) )
                    : contentWithoutData;
                }
            ).then(
                unprocessedContent => {
                    var contentHandlerPromise= !contentIsBinary && contentHandler
                        ? contentHandler( unprocessedContent )
                        : Promise.resolve( unprocessedContent );

                    return contentHandlerPromise.then(
                        processedContent => {
                            return Selenium.encodeContent( processedContent, mime, contentIsBinary, useURLencoding );
                        }
                    );
                }
            );
    };
    
    /**
     * @param {string} filePathOrURL See Selenium.prototype.encodeFile().
     * @param {boolean|undefined|string|Array|RegExp|function} [useURLencoding=false] See Selenium.prototype.encodeFile().
     * @param {string|array|RegExp|function|undefined} fetchFilter Filter that determines for a given URL whether to fetch it or not.
     * - String application webroot. Any resources under it, even if referenced through full URLs, will be fetched.
     * - Array of webroots. Any resources under them will be fetched.
     * - RegExp matching any URLs to fetch.
     * - Function(url) that returns whether to fetch a URL.
     * - undefined to fetch any URLs on the same server (or under same top folder/Windows volume).
     * @param {function} [handler] Function (fetchFilter, useURLencoding, contentURL, content) => Promise. It will be bound to undefined (i.e. keyword 'this' will be undefined).
     * @return {Promise} Promise of a string content.
     * */
    Selenium.prototype.encodeFileWithHandler= function encodeFileWithHandler( filePathOrURL, useURLencoding=false, fetchFilter=undefined, handler=undefined, data=undefined, dataPlaceholder=undefined ) {
        var url= Selenium.urlFor( filePathOrURL, true ); // if a filepath, this translates it to a URL
        
        return this.encodeFile( url, useURLencoding,
            handler//@TODO rename to contentHandlerWithParamsForRecursion
                ? handler.bind(undefined, fetchFilter, useURLencoding, url)
                : undefined,
            data, dataPlaceholder
        );
    };
    
    Selenium.prototype.encodeFileRecursively= function encodeFileRecursively( filePathOrURL, useURLencoding=false, fetchFilter=undefined, data=undefined, dataPlaceholder=undefined ) {
        var recursiveHandler= Selenium.prototype.encodeFileRecursiveHandler.bind(this);
        var contentHandlerWithParamsForRecursion=
            data===undefined || dataPlaceholder!==undefined
                ? recursiveHandler
                : (fetchFilter, useURLencoding, contentURL, content) =>
                    {
                        var recursiveHandlerPromise= recursiveHandler( fetchFilter, useURLencoding, contentURL, content );
                        return recursiveHandlerPromise.then(
                            processedContent => {
                                // Report any <a href="#.."> or <a name="...">.
                                // processedContent may contain processed 'data:' URLs. Those are either URL-encoded or base64-encoded. Either won't contain a hash  '#', hence those 'data:' URLs won't upset the following validation.
                                var anchorsOrLocalLinks= /<a[^>]+href=['"]#[^'"]*|<a[^>]+name=['"][^'"]*/g;
                                var match= anchorsOrLocalLinks.exec( processedContent );
                                !match || SeLiteMisc.log().warn( "selenium.encodeFileRecursively(): You set param data and not param dataPlaceholder. That means passing the data via URL # hash (anchor fragment). However, fetched content (with data:-encoded resources, if any) contains a local # hash-based link, or an anchor link: " +match[0] );
                                return processedContent;
                            }
                        );
                    };
        return this.encodeFileWithHandler( filePathOrURL, useURLencoding, fetchFilter, contentHandlerWithParamsForRecursion, data, dataPlaceholder );
    };
    
    // Case sensitive matching. Can't match string 'url()' case insensitively, because URL(...) is a standard class in Javascript files.
    // Don't replace anchor links #anchor-fragment.
    var handledLink= /(src=|href=)['"]([^'"#][^'"]*)['"]|url\( *['"]?([^'"#][^'"]*)['"] *\)/g;
    var urlRoot= /^((?:file:\/\/\/|[a-z]:\/\/)[^/]+)/;
    
    /** @param {string|array|RegExp|function|undefined} fetchFilter See Selenium.prototype.encodeFileRecursively().
     * */
    Selenium.prototype.encodeFileRecursiveHandler= function encodeFileRecursiveHandler( fetchFilter, useURLencoding, contentURL, content ) {
        if( fetchFilter===undefined ) {
            // Match any file under the same domain.
            var contentRootMatch= urlRoot.exec(contentURL);
            if( contentRootMatch ) {
                fetchFilter= contentRootMatch[0];
            }
            else {
                return Promise.reject( "There was no fetchFilter, and given contentURL seems invalid: " +contentURL );
            }
        }
        if( typeof fetchFilter==='string' ) {
            fetchFilter= [fetchFilter];
        }
        if( Array.isArray(fetchFilter) ) {
            fetchFilter= new RegExp( '^(' +fetchFilter.join('|')+ ')' );
        }
        SeLiteMisc.ensureInstance( fetchFilter, [RegExp, Function], 'fetchFilter' );
                
        var result= Promise.resolve('');
        var lastMatchLastIndex= 0;
        var match;
        while( ( match=handledLink.exec(content) )!==null ) {
            // The following anonymous function keeps the match details before we fire up successive handling, because then handledLink and match will be updated.
            ( ()=>{
                var wholeMatch= match[0];
                var sincePreviousMatch= content.substring( lastMatchLastIndex, match.index );

                var url= match[2] || match[3];

                var matchedSrcOrHref= match[1]!==undefined;
                // Always return quotes, replacing any previous apostrophes, for these URLs. That's because URL-encoded text may contain apostrophes, but no quotes.
                var beforeUrl= matchedSrcOrHref
                    ? match[1]+ '"'
                    : 'url("';
                var afterUrl= matchedSrcOrHref
                    ? '"'
                    : '")';

                result= result.then(
                    previous => {
                        //Convert relative URL to absolute (based on the document being currently processed). If url is absolute, the following leaves it as it was.
                        var convertedURL= new URL( url, contentURL ).href; // Based on https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
                        
                        var shouldFetch= !convertedURL.startsWith('data:') && !convertedURL.startsWith('javascript:')
                            && (SeLiteMisc.isInstance(fetchFilter, RegExp )
                                    ? fetchFilter.test( convertedURL )
                                    : fetchFilter( convertedURL )
                                );// fetchFilter is a function
                        if( !shouldFetch ) {
                            return previous+ sincePreviousMatch+ wholeMatch;
                        }
                        
                        var contentHandler= convertedURL.endsWith('.css')
                            ? Selenium.prototype.encodeFileRecursiveHandler.bind(this) // recursive - to fetch any images referenced from this CSS file
                            : undefined; // this file is a leaf, no deeper recursion
                        
                        return this.encodeFileWithHandler( convertedURL, useURLencoding, fetchFilter, contentHandler ).then(
                            processed => 
                                previous+ sincePreviousMatch+ beforeUrl+ processed+ afterUrl
                        );
                    }
                );
            } )();
            lastMatchLastIndex= handledLink.lastIndex;
        }
        result= result.then(
            (previous)=>
                previous+ content.substring(lastMatchLastIndex)
        );
        return result;
    };
    
    // For Uint8-backed stringview only
    var stringViewToUrlEncode= function stringViewToUrlEncode( stringView ) {
        var result= '';
        for( var i=0; i<stringView.bufferView.length; i++ ) {
            // Do one by one, rather than the whole string? TODO: try the whole string collected from ASCII each char.
            //result+= encodeURIComponent( String.fromCharCode(stringView.bufferView[i]) );
            
            var hexa= ( stringView.bufferView[i] ).toString(16);
            result+= '%'+ (hexa.length<2 ? '0' : '')+ hexa;
            
            //result+= String.fromCharCode(stringView.bufferView[i]);
        }
        return result;
        //return encodeURIComponent(result);
    };
    
    /**
     * @param {(string|ArrayBuffer)} content
    @return {Promise} Promise that resolved to encoded content; it rejects on error or on timeout.
    */
    Selenium.encodeContent= function encodeContent( content, mime, contentIsBinary=false, useURLencoding=false ) {
        (typeof content==="object") === SeLiteMisc.isInstance( content, ArrayBuffer ) || SeLiteMisc.fail( "Parameter content must be a primitive string, or an ArrayBuffer.");
        (typeof content==="object") === contentIsBinary || SeLiteMisc.fail( "Parameter content was " +typeof content+ ", but parameter contentIsBinary was " +contentIsBinary );

            //@TODO var body= doc.getElementsByTagNameNS( "http://www.w3.org/1999/xhtml", 'body')[0]; // this works even if the document's MIME is text/html rather than text/xml
        var doURLencoding;
        if( useURLencoding==="automatic" ) {
            useURLencoding= !contentIsBinary;
        }
        if( typeof useURLencoding==='boolean' ) {
            doURLencoding= useURLencoding;
        }
        else {
            if( typeof useURLencoding==='string' ) {
                useURLencoding= [useURLencoding];
            }
            if( Array.isArray(useURLencoding) ) {
                doURLencoding= false;
                for( var prefix of doURLencoding ) {
                    if( mime.startsWith(prefix) ) {
                        doURLencoding= true;
                        break;
                    }
                }
            }
            else
            if( typeof useURLencoding==='function' ) {
                doURLencoding= useURLencoding( mime );
            }
            else {
                SeLiteMisc.ensureInstance( useURLencoding, RegExp, "useURLencoding" );
                doURLencoding= useURLencoding.test( mime );
            }
        }
        
        var encoded= contentIsBinary
            ? (doURLencoding
                ? stringViewToUrlEncode( new StringView( content, 'ASCII') ) // Not fully standard
                : new StringView( content, 'ASCII').toBase64( true )
              )
            : (doURLencoding
                ? encodeURIComponent(content)
                : btoa(content)
              );
        return 'data:' +mime+
            (doURLencoding
                ? ''
                : ';base64'
            ) + ',' + encoded;
    };
}) ();