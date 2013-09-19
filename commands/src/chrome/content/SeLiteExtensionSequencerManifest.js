Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");
SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'commands@selite.googlecode.com',
    coreUrl: 'chrome://selite-commands/content/extensions/commands.js',
    requisitePlugins: { 'misc@selite.googlecode.com': 'SeLite Miscellaneous' }
} );
var EXPORTED_SYMBOLS= [];