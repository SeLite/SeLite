"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite Bootstrap',
    id: 'bootstrap@selite.googlecode.com',
    coreURL: 'chrome://selite-bootstrap/content/extensions/bootstrap-core.js',
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-bootstrap/',
    requisitePlugins: {
        'selblocks-global@selite.googlecode.com': {
            name: 'SeLite SelBlocks Global',
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
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-testcase-debug-conte/',
            minVersion: '0.76'
        }
    },
    preActivate: function(api) {
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
       var bootstrappedCoreExtensions= new SeLiteSettings.Field.File( 'bootstrappedCoreExtensions', { 'Javascript': '*.js*', 'Any': null}, /*multivalued*/true, /*defaultKey*/[], /*allowNull*/false,
            "Javascript file(s) that are loaded initially and on change via SeLite Bootstrap.",
            function customValidate( key ) {
                SeLiteSettings.setBootstrappedListAsChanged();
                return true;
            }
        );
        settingsModule.addField( bootstrappedCoreExtensions );
    }
} );
