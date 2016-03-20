//"use strict";

//var global= this;
//var cuckoo;
( function() {
    // This file does its job only when it's loaded by Selenium IDE for the first time on any (re)start of Selenium IDE. When Selenium IDE triggers it the second time (within the same run of IDE), the it skips its job. For detecting that: I set a field on a Selenium IDE class that is present on both occasions and that gets reloaded when I restart Selenium IDE. StandaloneEditor is such class.
    StandaloneEditor.extensionSequencerClearedLoadedTimes= StandaloneEditor.extensionSequencerClearedLoadedTimes || 0;
    if( StandaloneEditor.extensionSequencerClearedLoadedTimes===0 ) {
        var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        console.debug( 'SeLite Extension Sequencer (re)setting SeLiteExtensionSequencer.coreExtensionsLoadedTimes to an empty object.' );
        Components.utils.import( "chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js" );
        // Re-set because Selenium IDE was (re)loaded. This is for a workaround for https://github.com/SeleniumHQ/selenium/issues/1549 "Core extensions are loaded 2x".
        SeLiteExtensionSequencer.coreExtensionsLoadedTimes= {};
    }
    StandaloneEditor.extensionSequencerClearedLoadedTimes++;
    if( StandaloneEditor.extensionSequencerClearedLoadedTimes>2 ) {
        throw Error( "SeLite Extension Sequencer's extension-sequencer-core.js was loaded more than twice during the same run of Selenium IDE, or Selenium IDE became incompatible with SeLite Extension Sequencer: " +StandaloneEditor.extensionSequencerClearedLoadedTimes );
    }
} )();