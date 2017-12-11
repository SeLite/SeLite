"use strict";

addListenerForUpdate();

if( true) return; // UNTIL new SeIDE is deployed to thw world
const NEW_SELENIUM_IDE_ID= 'a6fd85ed-e919-4a43-a5af-8da18bda539f'; //@TODO change if different; and/or check versions
const OLD_SELENIUM_IDE_ID= 'a6fd85ed-e919-4a43-a5af-8da18bda539f';
const LOAD_ME= "LOAD_PLUGIN_FOR_SELENIUM_IDE";

var globalVarTest= 0;

//openTab( `aboutblank#window.navigator.registerProtocolHandler${window.navigator.registerProtocolHandler}`);
browser.management.getAll().then( extensions => {
    var oldSeleniumIDEinstalled= false;
    for( let ext of extensions ) {
        if( ext.id===NEW_SELENIUM_IDE_ID ) { // Selenium IDE for Firefox 57+
            var message= {
                action: LOAD_ME
                //extension_url: browser.extension.getURL()
            };
            browser.runtime.sendMessage( NEW_SELENIUM_IDE_ID, message, {} ).catch( error => openTab("about:blank#" +error)); // @TODO URL-encode error; have a page to show it
            return;
        }
        // TODO only if new IDE has a different ID:
        if( ext.id===OLD_SELENIUM_IDE_ID ) {
            oldSeleniumIDEinstalled= true;
        }
    }
    if( true) return; //@TODO; quiet while testing
    openTab( oldSeleniumIDEinstalled
        ? "about:blank#Please upgrade/replace Selenium IDE first."
        : "about:blank#Please install Selenium IDE first."
    );
});

// For testing whether a message is guaranteed out even before the recipient add-on registers an (external) message listener. Will the message arrive here - will it be queued?
// Not using https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/alarms/create, since it fires in minute intervals only (at least in Chrome).
browser.idle.setDetectionInterval( 15 ); // minimum
browser.idle.onStateChanged.addListener( newState=>{
    if( newState==='idle' ) {
        console.error( 'detected-idle');
        
        // @param sender See https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/MessageSender -> url (to a page, not just a prefix), id
        browser.runtime.onMessageExternal.addListener( (message, sender, sendResponse)=>{
            console.error( `onMessageExternal handler: ${message}, ${sender}, ${sendResponse}`);
            // load .js from the other extension; that .js should openTab()
            
            
            //synch: sendResponse( JSON-ifiable)
            //asynch: see https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onMessageExternal
        });
    }
});

console.error( `runtime.getURL: ${browser.runtime.getURL('')}`);

// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
console.error( `window.document.currentScript.src ${window.document.currentScript.src}`);

console.error( `globalVarTest ${++globalVarTest}`);

//console.error( `Blob${Blob}`);