"use strict";

var onIFrameLoad;

function onBodyLoad() {
    var iframe= document.getElementById('iframe');

    onIFrameLoad= () => {
        // Following is based on a note at https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/iframe#Properties > contentWindow.
        // Use contentWindow.wrappedJSObject.scripted only when accessing through chrome:// URL, but not through file://. On the other hand, use contentWindow.scripted when accessing through file:// URL, but not through chrome:// URL.
        iframe.contentWindow.wrappedJSObject.scripted();
    };        
    
    // Following handler gets invoked only if we open content_iframe_test.xul in Firefox browser tab through chrome:// URL or file:// URL
    // (with enabled Firefox preference dom.allow_XUL_XBL_for_file - at URL about:config),
    // or if we use window.open() without "chrome" option:
    // window.open( "chrome://selite-preview/content/content_iframe_test.xul", "SeLite Preview", "resizable=1");
    // However, it doesn't get invoked if use use "chrome" option:
    // window.open( "chrome://selite-preview/content/content_iframe_test.xul", "SeLite Preview", "chrome,resizable=1");
    iframe.setAttribute( "onload", "console.error('onIFrameLoad ' +onIFrameLoad); onIFrameLoad()" );
    
    iframe.setAttribute(
        "src",
        "data:text/html," + encodeURIComponent( '<html><head><script type="text/javascript">function scripted(){ alert("scripted()"); }</script></head><body>Hi <a href="javascript:alert(\'hi\')" onclick="alert(\'onclick\')">link</a>.</body></html>' )
    );
    // When this is run via file:// rather than via chrome://, then it can't access local files.
    // E.g. following fails with NS_ERROR_DOM_BAD_URI: Access to restricted URI denied:
    // var request = new XMLHttpRequest();
    //request.open("GET", 'file:///D:/localdata/pkehl/LinkedIn/shared_connections_preview.html?st=12', true );
}

/** Unused - for documentation only.
 *  @param {string} html HTML or XML content
 *  @param {boolean} isHTML If false, then this assumes XML.
 *  @return {string} HTML or XML with injected <script>...</script>
 * */
function injectScript( html, isHTML=true ) {
                        var script= isHTML
                            ? '\n<script'
                            : '\n<xhtml:script xmlns:xhtml="http://www.w3.org/1999/xhtml"';
                        script+= 'type="text/javascript">';
                        script+= "\n//<![CDATA[\n";
                        // In XML <body onload="..."> handler doesn't work - hence https://developer.mozilla.org/en/docs/web/api/document/readystate
                        // In either XML or HTML: document.addEventListener( "load", ...) doesn't work
                        script+= isHTML
                            ? 'window.addEventListener( "load", '
                            : 'document.onreadystatechange= ';
                        script+= '\n() => {\n';
                        if( !isHTML ) {
                            script+= 'if (document.readyState==="complete") {\n';
                        }
                        script+= 'typeof seLitePreviewPresent!=="function" || seLitePreviewPresent( ' +JSON.stringify( data )+ ' );\n';
                        if( !isHTML ) {
                            script+= '}\n'; // end of: if(document.readyState...) {...}
                        }
                        script+= '}\n'; // end of arrow function body () => {...}
                        if( isHTML ) {
                            script+= ')';
                        }
                        script+= ';\n';
                        //script+= '\n window.addEventListener( "load", () => {typeof seLitePreviewPresent!=="function" || seLitePreviewPresent( ' +JSON.stringify( data )+ ' ); } );';
                        script+= "//]]>";
                        script+= isHTML
                            ? "\n</script>\n"
                            : "\n</xhtml:script>\n";
                        
                        var injectAt= html.lastIndexOf( '</' );
                        if( isHTML ) {
                            injectAt= html.lastIndexOf( '</', injectAt-1 ); // just before </body>
                        }
                        return html.substring( 0, injectAt ) +script+ html.substring( injectAt );
}

// Old code
if( false ) {
                    var parentAbsoluteURL= new URL( '.', htmlFilePathOrURL ).href; // Based on https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
                    if( parentAbsoluteURL[parentAbsoluteURL.length-1]==='/' ) { // Remove trailing '/'
                        parentAbsoluteURL= parentAbsoluteURL.substring( 0, parentAbsoluteURL.length-1 );
                    }
                    var html= request.responseText.replace( /SELITE_PREVIEW_CONTENT_PARENT/gi, parentAbsoluteURL );
                    
                    if( html.indexOf('SELITE_PREVIEW_DATA')>=0 ) {
                        html= html.replace( /SELITE_PREVIEW_DATA/gi, JSON.stringify(data) );
                    }
                    //....
                    // See also https://developer.mozilla.org/en-US/docs/Displaying_web_content_in_an_extension_without_security_issues
                    var win= window.open( "data:text/" +config.contentType+ "," + encodeURIComponent(html), /*TODO: no effect*/config.windowTitle/*, "chrome,resizable=1"/**/);
}