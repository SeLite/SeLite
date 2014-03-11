SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'commands@selite.googlecode.com',
    coreUrl: 'chrome://selite-commands/content/extensions/commands.js',
    xmlUrl: 'chrome://selite-commands/content/reference.xml',
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous',
        'settings@selite.googlecode.com': 'SeLite Settings'
    },
    callBack: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        /** Max. time difference between the web app and the test. */
        var maxTimeDifference= new SeLiteSettings.Field.Int( 'maxTimeDifference', false, 5000, true );
        settingsModule.addField( maxTimeDifference );
    }
} );