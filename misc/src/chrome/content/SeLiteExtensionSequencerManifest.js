Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");
SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'misc@selite.googlecode.com'
    // This plugin doesn't use coreUrl: 'chrome://selite-misc/content/extensions/selite-misc-ide.js'
    // because we don't want to flood Selenium namespace. If a user wants to use this directly,
    // they can use Components.utils.import() in their Core extensions.
} );

var EXPORTED_SYMBOLS= [];