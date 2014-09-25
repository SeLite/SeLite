SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'bootstrap@selite.googlecode.com',
    coreUrl: 'chrome://selite-bootstrap/content/extensions/se_bootstrap.js',
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous',
        'testcase-debug-context@selite.googlecode.com': 'SeLite TestCase Debug Context',
        'selblocks-global@selite.googlecode.com': 'SeLite SelBlocksGlobal',
        'settings@selite.googlecode.com': 'SeLite Settings'
    },
    preActivate: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
       var bootstrappedCoreExtensions= new SeLiteSettings.Field.File( 'bootstrappedCoreExtensions', /*startInProfileFolder*/false, { 'Javascript': '*.js*', 'Any': null}, /*multivalued*/true, /*defaultKey*/[], /*allowNull*/false,
            function customValidate( key ) {
                bootstrappedListChanged= true;
                return true;
            }
        );
        settingsModule.addField( bootstrappedCoreExtensions );
    }
} );
