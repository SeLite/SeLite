Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");
SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'db-storage@selite.googlecode.com',
    coreUrl: 'chrome://selite-db-storage/content/extensions/db-storage.js',
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous',
        'commands@selite.googlecode.com': 'SeLite Commands',
        'sqlite-connection-manager@selite.googlecode.com': 'SeLite SQLite Connection Manager'
    },
    optionalRequisitePlugins: { 'settings@selite.googlecode.com': 'SeLite Settings' }
} );

var EXPORTED_SYMBOLS= [];