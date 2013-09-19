Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");
SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'db-objects@selite.googlecode.com',
    coreUrl: 'chrome://selite-db-objects/content/extensions/db-objects.js',
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous',
        'commands@selite.googlecode.com': 'SeLite Commands',
        'db-storage@selite.googlecode.com': 'SeLite DB Storage'
    }
} );
var EXPORTED_SYMBOLS= [];