SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'db-objects@selite.googlecode.com',
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous',
        'commands@selite.googlecode.com': 'SeLite Commands',
        'sqlite-connection-manager@selite.googlecode.com': 'SQLite Connection Manager',
        'settings@selite.googlecode.com': 'SeLite Settings'
    },
    coreUrl: 'chrome://selite-db-objects/content/extensions/selite-db-objects-core.js',
    xmlUrl: 'chrome://selite-db-objects/content/reference.xml',
    callBack: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        /** SeLiteData.getStorageFromSettings() depends on name tablePrefix. */
        var tablePrefix= new SeLiteSettings.Field.String('tablePrefix', /*multivalued:*/false, '', /*requireAndPopulate:*/true);
        settingsModule.addField( tablePrefix );
    }
} );
