"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite Bootstrap',
    id: 'bootstrap@selite.googlecode.com',
    coreURl: 'chrome://selite-bootstrap/content/extensions/se_bootstrap.js',
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-bootstrap/',
    requisitePlugins: {
        'selblocks-global@selite.googlecode.com': {
            name: 'SeLite SelBlocksGlobal',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-selblocks-global/'
        },
        'misc@selite.googlecode.com': {
            name: 'SeLite Miscellaneous',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-miscellaneous/'
        },
        'settings@selite.googlecode.com': {
            name: 'SeLite Settings',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/'
        },
        'testcase-debug-context@selite.googlecode.com': {
            name: 'SeLite TestCase Debug Context',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-testcase-debug-conte/'
        }
    },
    preActivate: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
       var bootstrappedCoreExtensions= new SeLiteSettings.Field.File( 'bootstrappedCoreExtensions', { 'Javascript': '*.js*', 'Any': null}, /*multivalued*/true, /*defaultKey*/[], /*allowNull*/false,
            function customValidate( key ) {
                bootstrappedListChanged= true;
                return true;
            }
        );
        settingsModule.addField( bootstrappedCoreExtensions );
    }
} );
