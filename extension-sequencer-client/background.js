"use strict";

browser.runtime.sendMessage( "extension-sequencer@selite.googlecode.com",
    {} //JSON-ifizied message
).then(
    response => {
        console.error( `sendMessage response${response}`);
    },
    error => {
        console.error( `sendMessage error${error}`);
    }
);

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/connect-src applies to XHR and Fetch
// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch

function loadScript(scriptURL) {
    //var previousNumberOfScripts= window.document.scripts.length;
    var head = document.getElementsByTagName("head")[0];
    var s = document.createElement("script");
    s.type = "text/javascript";
    s.src = scriptURL;
    head.appendChild(s);
    //console.error( `scripts ${window.document.scripts.length}`);
    //console.error( `scripts[0] ${window.document.scripts[0].src}`);
}
if( false ) {
    // Loading from another extension worked, even without moz-extension:// in CSP in manifest.json of the current add-on. 
    //TODO check, as that was via ext-run (for the current add-on), not sure about an installed XPI.
    // From pageAction error demo XPI
    loadScript("moz-extension://001f3a9c-db40-49ff-ac55-c2f537f1f16c/scripts/background.js");
}
