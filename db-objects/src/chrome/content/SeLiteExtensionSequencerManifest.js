"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite DB Objects',
    pluginId: 'db-objects@selite.googlecode.com',
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-db-objects/',
    requisitePlugins: {
        'commands@selite.googlecode.com': {
            name: 'SeLite Commands',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-commands/'
        },
        'sqlite-connection-manager@selite.googlecode.com': {
            name: 'SeLite SQLite Connection Manager',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-sqlite-connection-mg/'
        },
        'misc@selite.googlecode.com': {
            name: 'SeLite Miscellaneous',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-miscellaneous/'
        },
        'settings@selite.googlecode.com': {
            name: 'SeLite Settings',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/'
        },
    },
    coreUrl: 'chrome://selite-db-objects/content/extensions/selite-db-objects-core.js',
    xmlUrl: 'chrome://selite-db-objects/content/reference.xml',
    preActivate: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        /** SeLiteData.getStorageFromSettings() depends on name tablePrefix. */
        var tablePrefix= new SeLiteSettings.Field.String( 'tablePrefix', /*multivalued:*/false, /*defaultKey*/'' );
        settingsModule.addField( tablePrefix );
    }
} );
