"use strict";

SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite Commands',
    id: 'commands@selite.googlecode.com',
    coreURL: 'chrome://selite-commands/content/extensions/commands.js',
    xmlURL: 'chrome://selite-commands/content/reference.xml',
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-commands/',
    requisitePlugins: {
        'misc@selite.googlecode.com': {
            name: 'SeLite Miscellaneous',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-miscellaneous/'
        },
        'settings@selite.googlecode.com': {
            name: 'SeLite Settings',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/'
        }
    },
    preActivate: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        /** Max. time difference between the web app and the test. */
        var maxTimeDifference= new SeLiteSettings.Field.Int('maxTimeDifference', /*multivalued:*/false, 0);
        settingsModule.addField( maxTimeDifference );
    }
} );