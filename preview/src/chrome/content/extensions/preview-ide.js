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
        // This is defined on Editor.prototype, rather than on Selenium.prototype. This way it can access 'editor' object, and through it 'selenium' object, too. Selenese getEval command and custom Selenese commands (defined on Selenium.prototype) can access 'editor' object in order to call editor.openPreview().
        /** Goals:
         *  - Bookmarkable (except for the connection back to Selenium IDE, and except for any secure data)
         *  - Can access files relative to the template (whether via http://, https:// or file://). However, in order to access local file://, the topmost URL must not use 'data:' meta-protocol. We could have a file that would have an iframe that would use data:. However, that adds an unnecessary layer. Hence we use query or hash part of URL - which works with both http://, https:// and file://. The user can still pass a data: URL, if it contains any images and CSS that it needs. Then the user can pass/bookmark the result URL without any files. TODO refer to a separate add-on to generate those.
         *  Following describes the API. For  use cases see https://selite.github.io/Preview.
         *  <br/>
         *  In the template:
         *  1. Extract the encoded data. If config.dataInHash is false or not set, extract from location.query the part (if any) right of value of config.dataParameterName+'=' (defaults to 'dataInJSON') and the next '&' (if any). If config.dataInHash is true, then use the hash (anchor/fragment) part of the location (except for leading '#') instead. If you set config.dataInHash, then you can't use anchor links.
         *  2. If there is any such part, apply decodeURIComponent() if config.urlEncodeData is true or atob() (for base64-encoded data, which is the default). Then apply JSON.parse().
         *  @param {string} filePathOrURL File path or URL of the HTML/XML preview file/template. If it's a file path, you can use either / or \ as directory separators (they will get translated for the current system). To make it portable, specify it as a relative path and pass it appended to result of SeLiteSettings.getTestSuiteFolder(). It must not contain a #hash/fragment part.
         *  @param {*} [data] Usually an anonymous object or an array. The template must not rely on any class membership or on any fields that are functions.
         * @param {object} [config] Configuration with any of fields: {
         *      addTimestamp: boolean. If true, then this makes the URL unique by adding a timestamp in the query part of filePathOrURL. False by default.
         *      dataParameterName: name of HTTP GET parameter ('dataInJSON' by default), added to the query part of filePathOrURL. Only used when passing data through URL query rather than through URL hash (fragment, anchor).
         *      urlEncodeData: boolean, whether to url-encode the data, instead of base64-encode. False by default.
         *  }
         *  @return {Promise} Promise that resolves to Window object.
         * */
        //var console= Components.utils.import("resource://gre/modules/Console.jsm", {}).console;
        Editor.prototype.openPreview= function openPreview( urlOrPromise, data={}, config={} ) {
            var promise= !SeLiteMisc.isInstance( urlOrPromise, Promise)
                ? Promise.resolve( urlOrPromise )
                : urlOrPromise;
            
            'dataInHash' in config || (config.dataInHash=false);
            'urlEncodeData' in config || (config.urlEncodeData=false);
            'dataPlaceholder' in config || config.dataInHash || (config.dataPlaceholder='ENCODED_JSON_DATA_PLACEHOLDER');
            //@TODO validate
            
            /** Side research on passing data via #hash part of URL:
                   JSON.stringify( {hi: 'you & i'} ) -> '{"hi":"you & i"}'
                however:
                   window.open( someURL + '#' +JSON.stringify( {hi: 'you & i'} ) )
                   opens a window with URL ending with #{"hi":"you%20&%20i"}
                   Firefox adds transformation of spaces to %20. When Javascript from that loaded page
                   uses its location.hash, it is '#{"hi":"you%20&%20i"}'. However, that doesn't feel robust.
                Anyway, let's url-encode or base64-encode the hash as per RFC on URI http://tools.ietf.org/html/rfc3986#section-3.5.
           */

            var json= JSON.stringify( data );
            var encoded= config.urlEncodeData
                ? encodeURIComponent(json)
                : btoa(json);
            
            return promise.then(
                url => {
                    debugger;
                    if( config.dataInHash ) {
                        url+= '#' +encoded;
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
        
        /** Similar to Editor.prototype.openPreview(), but this doesn't fetch the document (it doesn't encode it as a data: URL).
         * @param {object} config Similar to Editor.prototype.openPreview(), but here it accepts one more optional field: urlEncodeContent of mixed type. It indicates whether to use URL encoding for content, instead of base64 encoding. This doesn't affect the Javascript and how it receives the data. Undefined by default, which means automatic. See Selenium.prototype.encodeFile().
         * @return {Promise}
         */
        Editor.prototype.openPreviewEncode= function openPreviewEncode( urlOrPromise, data={}, config={}, filter=undefined ) {
            var promise= !(urlOrPromise instanceof Promise)
                ? Promise.resolve( urlOrPromise )
                : urlOrPromise;
            'urlEncodeContent' in config || (config.urlEncodeContent= undefined);
            var selenium= this.selDebugger.runner.selenium;
            var Selenium= selenium.constructor;debugger;
            return promise.then(
                url => {
                    debugger;
                    // TODO remove Add a timestamp to make the query unique
                    if( 'addTimestamp' in config && config.addTimestamp ) {
                        url+= ( url.indexOf('?')<0
                            ? '?'
                            : '&'
                        )+ 'seLiteTimestamp=' +Date.now();
                    }

                    url.indexOf('#')<0 || SeLiteMisc.fail( 'Parameter filePathOrURL must not contain a #hash (fragment): ' +filePathOrURL );
                    return this.openPreview( selenium.encodeFileRecursively(url, config.urlEncodeContent, filter, data, config), data, config );
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
