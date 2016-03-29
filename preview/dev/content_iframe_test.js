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
