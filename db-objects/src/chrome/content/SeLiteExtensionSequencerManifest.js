SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'db-objects@selite.googlecode.com',
    // This plugin doesn't put 'chrome://selite-db-objects/content/basic-objects.js' etc. to coreUrl,
    // because we don't want to flood Selenese namespace. If a user wants to use the objects/functions,
    // they have to load them via Components.utils.import() in their own Core extensions.
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous',
        'commands@selite.googlecode.com': 'SeLite Commands',
        'sqlite-connection-manager@selite.googlecode.com': 'SQLite Connection Manager',
        'settings@selite.googlecode.com': 'SeLite Settings'
    }
} );
