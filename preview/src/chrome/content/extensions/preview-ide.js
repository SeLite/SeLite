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
        /** @param {string} htmlFilePathOrURL File path or URL of the preview file/template. If it's a file path, you can use either / or \ as directory separators (they will get translated for the current system). To make it portable, use specify it as a relative path and pass it appended to result of SeLiteSettings.getTestSuiteFolder().
         <br/>In the content of that file use SELITE_PREVIEW_CONTENT_PARENT as a URL of its folder. That makes it portable.
         *  @param {object} [config] Configuration with any of fields: {
         *      windowTitle: string Window title
         *      contentType: 'html' (default) or 'xml'
         *      dontAddTimestamp: if true, then 
         *  }
         * */
        Editor.prototype.openPreview= function openPreview( htmlFilePathOrURL, data={}, config={} ) {
            htmlFilePathOrURL= this.selDebugger.runner.selenium.constructor.urlFor( htmlFilePathOrURL, true );
            // Add a timestamp to make the query unique
            var htmlURLwithTimestamp= htmlFilePathOrURL;
            if( !config.dontAddTimestamp ) {
                htmlURLwithTimestamp+= ( htmlURLwithTimestamp.indexOf('?')<0
                    ? '?'
                    : '&'
                )+ 'seLiteTimestamp=' +Date.now();
            }
            
            config.contentType= config.contentType || 'html';
            config.windowTitle= config.windowTitle || "SeLite Preview from " +htmlFilePathOrURL;
            'dontAddTimestamp' in config || (config.dontAddTimestamp=false);
            
            var request = new XMLHttpRequest();
            request.onload= ()=> {

              if (request.readyState === 4) {
                if (request.status === 200) {
                    var parentAbsoluteURL= new URL( '.', htmlFilePathOrURL ).href; // Based on https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
                    var html= request.responseText.replace( /SELITE_PREVIEW_CONTENT_PARENT/gi, parentAbsoluteURL );
                    
                    if( html.indexOf('SELITE_PREVIEW_DATA')>=0 ) {
                        html= html.replace( /SELITE_PREVIEW_DATA/gi, JSON.stringify(data) );
                    }
                    // When injecting a call to seLitePreviewPresent(), and when calling seLitePreviewConnect(), I don't check whether these exist in HTML. That's because they may be in a separate .js file loaded from HTML.
                    
                    // @TODO Export generated HTML or XML <-: document.getElementsByTagName('body')[0].innerHTML
                    //@TODO CSV or plain text through 2 stage generation? <- .innerText
                    else {
                        var scriptParameter= config.contentType==='html'
                            ? 'type="javascript"'
                            : 'xmlns="http://www.w3.org/2000/svg"';
                        var script= "\n<script " +scriptParameter+ ">";
                        script+= "\n//<![CDATA[";
                        // XML: this works
                        script+= '\nalert("hi"); typeof seLitePreviewPresent!=="function" || window.addEventListener( "load", () => {seLitePreviewPresent( ' +JSON.stringify( data )+ ' ); } );';
                        script+= "\n//]]>";
                        script+= "\n</script>\n";
                        
                        var injectAt= html.lastIndexOf( '</' );
                        if( config.contentType==='html' ) {
                            injectAt= html.lastIndexOf( '</', injectAt-1 ); // just before </body>
                        }
                        html= html.substring( 0, injectAt ) +script+ html.substring( injectAt );
                    }
                    
                    // See also https://developer.mozilla.org/en-US/docs/Displaying_web_content_in_an_extension_without_security_issues
                    var win= window.open( "data:text/" +config.contentType+ "," + encodeURIComponent(html), /*TODO: no effect*/config.windowTitle/*, "resizable=1"*/);
                    
                    win.addEventListener( 'load', () => {
                        // win!==window; this===editor - thanks to JS ES6 arrow function ()=>{...}
                        if( typeof win.seLitePreviewConnect==='function' ) {
                            win.seLitePreviewConnect( {
                                selenium: editor.selDebugger.runner.selenium,
                                editor: this,
                                parentAbsoluteURL
                            } );
                        }
                    } );
                } else {
                  alert( "Couldn't load " +htmlURLwithTimestamp+ ". " +request.statusText );
                }
              }
            };
            request.onerror= (event)=> {
                alert( "Couldn't load " +htmlURLwithTimestamp );
            };

            request.open("GET", htmlURLwithTimestamp, true );
            request.timeout= 3000; // @TODO Use Selenium timeout; in milliseconds
            request.send(null);
        };
        // 'editor' is an instance of either StandaloneEditor or SidebarEditor. Those classes don't refer to Editor.prototype, but they have copies of all functions from Editor.prototype (copied via objectExtend()).
        SidebarEditor.prototype.openPreview= StandaloneEditor.prototype.openPreview= Editor.prototype.openPreview;
    } ) ();
}
