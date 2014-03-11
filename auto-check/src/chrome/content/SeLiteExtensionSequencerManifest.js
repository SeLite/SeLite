SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'auto-check@selite.googlecode.com',
    coreUrl: 'chrome://selite-auto-check/content/extensions/auto-check.js',
    requisitePlugins: {
        'bootstrap@selite.googlecode.com': 'SeLite Bootstrap',
        'settings@selite.googlecode.com': 'SeLite Settings'
    },
    callBack: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        /** Max. time difference between the web app and the test. */
        //var maxTimeDifference= new SeLiteSettings.Field.Int( 'maxTimeDifference', false, 5000, true );
        //settingsModule.addField( maxTimeDifference );
    }
} );
