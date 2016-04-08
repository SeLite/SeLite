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

var iframe;
window.onresize= ()=> {
    if( iframe ) {
        iframe.width= window.innerWidth-20;
        iframe.height= window.innerHeight-20;
    }
};

function initialise( htmlURL, editor, data, config ) {
    iframe= document.getElementById('iframe');
    
    config.initialContent || config.initialContentType || (config.initialContentType= 'plain');
    config.initialContent= config.initialContent || 'Loading...';
    config.initialContentType= config.initialContentType || 'html';
    'dontAddTimestamp' in config || (config.dontAddTimestamp=false);
    
    iframe.setAttribute(
                "src",
                "data:text/" +config.initialContentType+ "," + encodeURIComponent( config.initialContent )
            );
    
    var request = new XMLHttpRequest();
    request.onload= ()=> {
        
      if (request.readyState === 4) {
        if (request.status === 200) {
            // Based on https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
            var parentAbsoluteURL= new URL( '.', htmlURL ).href;
            var html= request.responseText.replace( /SELITE_PREVIEW_CONTENT_PARENT/gi, parentAbsoluteURL );
            // Based on https://developer.mozilla.org/en-US/docs/Displaying_web_content_in_an_extension_without_security_issues
            iframe.setAttribute(
                "src",
                "data:text/html," + encodeURIComponent(html)
            );
            // I've tried handlers for load, pageshow on contentWindow.wrappedJSObject, contentWindow, contentWindow.wrappedJSObject.document. None worked.
            
            var invokeSeLitePreviewInitialize= function invokeSeLitePreviewInitialize() {
                if (typeof iframe.contentWindow.wrappedJSObject.seLitePreviewInitialize === 'function') {
                    iframe.contentWindow.wrappedJSObject.seLitePreviewInitialize(
                        data,
                        /*environment:*/{
                            selenium: editor.selDebugger.runner.selenium,
                            editor,
                            parentAbsoluteURL
                        }
                    );
                }
                else {
                    // See comments in ../../../dev/content_iframe_test.js.
                    // Don't use iframe.contentWindow.wrappedJSObject.setTimeout(). Instead, use setTimeout().
                    setTimeout( invokeSeLitePreviewInitialize, 100 );
                }
            };
            invokeSeLitePreviewInitialize();
        } else {
          alert( "Couldn't load " +htmlURL+ ". " +request.statusText );
        }
      }
    };
    request.onerror= (event)=> {
        alert( "Couldn't load " +htmlURL );
    };

    // Add a timestamp to make the query unique
    var htmlURLwithTimestamp= htmlURL;
    if( !config.dontAddTimestamp ) {
        htmlURLwithTimestamp+= ( htmlURL.indexOf('?')<0
            ? '?'
            : '&'
        )+ 'seLiteTimestamp=' +Date.now();
    }
    request.open("GET", htmlURLwithTimestamp, true );
    request.timeout= 3000; // @TODO Use Selenium timeout; in milliseconds
    request.send(null);
}
