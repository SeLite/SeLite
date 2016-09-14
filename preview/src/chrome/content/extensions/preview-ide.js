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

// For initialisation mechanism, see ide-extension.js of SeLiteMisc.
if( window.location.href==='chrome://selenium-ide/content/selenium-ide.xul' ) {
    ( function() {
        // openPreview() and openPreviewEncode() are defined on Editor.prototype, rather than on Selenium.prototype. This way they can access 'editor' object, and through it 'selenium' object, too. Selenese getEval command and custom Selenese commands (defined on Selenium.prototype) can access 'editor' object in order to call editor.openPreview().
        /** Goals:
         *  - Bookmarkable (except for the connection back to Selenium IDE, and except for any secure data)
         *  - Can access files relative to the template (whether via http://, https:// or file://). However, in order to access local file://, the topmost URL must not use 'data:' meta-protocol. We could have a file that would have an iframe that would use data:. However, that adds an unnecessary layer. Hence we use query or hash part of URL - which works with both http://, https:// and file://. The user can still pass a data: URL, if it contains any images and CSS that it needs. Then the user can pass/bookmark the result URL without any files. TODO refer to a separate add-on to generate those.
         *  Following describes the API. For  use cases see https://selite.github.io/Preview.
         *  <br/>
         *  In the template:
         *  1. Extract the encoded data.
         *  - If config.dataInHash is false or not set, the encoded data will be injected will replace any occurrences of its placeholder. The placeholder is any part of the primary HTML file (not any .js files) that literally matches value of config.dataPlaceHolder. The injected value will be JSON-encoded, hence it can contain quotes but not apostrophes. Therefore enclose the placeholder with apostrophes. Store it in a variable. An example for the default placeholder: var injectedDataInJSONandEncoded= 'ENCODED_JSON_DATA_PLACEHOLDER';
         *  The JSON string won't be URL-encoded neither base64-encoded.
         *  - If config.dataInHash is true, then use the hash (anchor/fragment) part of the location (except for leading '#') instead. If you set config.dataInHash, then you can't use anchor links.
         *  2. If there is any such part, apply decodeURIComponent() if config.urlEncodeData is true or atob() (for base64-encoded data, which is the default). Then apply JSON.parse().
         *  Similar to Editor.prototype.openPreviewEncode(), but this doesn't fetch the document (it doesn't encode it as a data: URL). If you want to fetch a document and open it as a bookmarkable 'data:' url, use editor.openPreviewEncode() instead.
         *  @param {string} filePathOrURL File path or URL of the HTML/XML preview file/template. If it's a file path, you can use either / or \ as directory separators (they will get translated for the current system). To make it portable, specify it as a relative path and pass it appended to result of SeLiteSettings.getTestSuiteFolder(). It must not contain a #hash/fragment part.
         *  @param {*} [data] Usually an anonymous object or an array. The template must not rely on any class membership or on any fields that are functions.
         *  @return {Promise} Promise that resolves to Window object.
         * */
        //var console= Components.utils.import("resource://gre/modules/Console.jsm", {}).console;
        Editor.prototype.openPreview= function openPreview( urlOrPromise, dataForHash=undefined, urlEncodeData=false ) {
            var promise= !SeLiteMisc.isInstance( urlOrPromise, Promise)
                ? Promise.resolve( urlOrPromise )
                : urlOrPromise;
            
            return promise.then(
                url => {
                    debugger;
                    if( dataForHash!==undefined ) {
                        url.indexOf('#')<0 || SeLiteMisc.fail( "You set param dataForHash, but param urlOrPromise (once resolved) contained a #hash (anchor fragment): " +url );
                        var json= JSON.stringify( dataForHash );
                        var encoded= urlEncodeData
                            ? encodeURIComponent(json)
                            : btoa(json);
                        url+= '#' +encoded;
                        /** Side research on passing data via #hash part of URL:
                               JSON.stringify( {hi: 'you & i'} ) -> '{"hi":"you & i"}'
                            however:
                               window.open( someURL + '#' +JSON.stringify( {hi: 'you & i'} ) )
                               opens a window with URL ending with #{"hi":"you%20&%20i"}
                               Firefox adds transformation of spaces to %20. When Javascript from that loaded page
                               uses its location.hash, it is '#{"hi":"you%20&%20i"}'. However, that doesn't feel robust.
                            Anyway, let's url-encode or base64-encode the hash as per RFC on URI http://tools.ietf.org/html/rfc3986#section-3.5.
                       */
                    }
                    var win= window.open( url, /*@TODO parameters - remove toolbar...*/'resizable=1');
                    // Using https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.utils.exportFunction
                    // For details see https://developer.mozilla.org/en-US/docs/Mozilla/Gecko/Script_security
                    // Following exported the function, but the preview couldn't access selenium().callBackOutFlow()
                    /*Components.utils.exportFunction(
                        function selenium(){ return editor.selDebugger.runner.selenium;},
                        win,
                        {
                         defineAs: 'selenium',
                         allowCrossOriginArguments:true
                        }
                    );/**/
                    
                    Components.utils.exportFunction(
                        function callBackOutFlow( seleneseFunctionName, parameters ){ editor.selDebugger.runner.selenium.callBackOutFlow( seleneseFunctionName, parameters ) },
                        win,
                        {
                         defineAs: 'callBackOutFlow',
                         allowCrossOriginArguments:true
                        }
                    );
            
                    //var waivedWin= Components.utils.waiveXrays(win);
                    //This didn't work well!: waivedWin.selenium= editor.selDebugger.runner.selenium;
                    
                    /*
                    win.addEventListener( 'load', () => {
                        // Following failed: 'selenium' field was undefined.
                        //win.wrappedJSObject.seLitePreviewConnect( {selenium: editor.selDebugger.runner.selenium} );
                    }, true );
                    /**/
                    return win;
                },
                failure => {
                    throw new Error(failure);
                }
            );
        };
        
        /** Similar to Editor.prototype.openPreview(), but this fetches the document and encodes it as a data: URL.
         * @param {object} [config] Configuration with any of fields: {
         *      dataInHash: Whether passing data through URL hash (fragment, anchor).
         *      dataPlaceholder: string, whose occurrence(s) in the top-level (HTML) file will be replaced with JSON-encoded data. Set it only when not setting dataInHash.
         *      urlEncodeData: boolean, whether to url-encode the data, instead of base64-encode. False by default.
         *      urlEncodeContent: *, It indicates whether to use URL encoding for content, instead of base64 encoding. This doesn't affect the Javascript and how it receives the data. False by default. See Selenium.prototype.encodeFile().
         *  }
         * @return {Promise}
         */
        Editor.prototype.openPreviewEncode= function openPreviewEncode( urlOrPromise, data={}, config={}, fetchFilter=undefined ) {
            'dataInHash' in config || (config.dataInHash=false);
            'urlEncodeData' in config || (config.urlEncodeData=false);
            'dataPlaceholder' in config || config.dataInHash || (config.dataPlaceholder='ENCODED_JSON_DATA_PLACEHOLDER');
            'urlEncodeContent' in config || (config.urlEncodeContent=false);
            
            config.dataInHash==(config.dataPlaceholder==undefined) || SeLiteMisc.fail( "Set exactly one of: config.dataInHash or config.dataPlaceholder." );
            !config.urlEncodeData || config.dataInHash || SeLiteMisc.fail( "Set config.urlEncodeData only if also setting config.dataInHash." );
            
            var promise= !(urlOrPromise instanceof Promise)
                ? Promise.resolve( urlOrPromise )
                : urlOrPromise;
            var selenium= this.selDebugger.runner.selenium;
            var Selenium= selenium.constructor;
            return promise.then(
                url => {
                    return this.openPreview(
                        selenium.encodeFileRecursively(url, config.urlEncodeContent, fetchFilter, data, config.dataPlaceholder),
                        config.dataInHash
                            ? data
                            : undefined,
                        config.urlEncodeData
                    );
                },
                failure => {
                    throw new Error(failure);
                }
            );
        };
        
        // 'editor' is an instance of either StandaloneEditor or SidebarEditor. Those classes don't refer to Editor.prototype, but they have copies of all functions from Editor.prototype (copied via objectExtend()).
        SidebarEditor.prototype.openPreview= StandaloneEditor.prototype.openPreview= Editor.prototype.openPreview;
        SidebarEditor.prototype.openPreviewEncode= StandaloneEditor.prototype.openPreviewEncode= Editor.prototype.openPreviewEncode;
    } ) ();
}
