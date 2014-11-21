"use strict";

SeLiteExtensionSequencer.registerPlugin( {
    id: 'auto-check@selite.googlecode.com',
    name: 'SeLite Auto Check',
    coreUrl: ['chrome://selite-auto-check/content/extensions/auto-check.js'],
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-auto-check/',
    requisitePlugins: {
        'misc@selite.googlecode.com': {
            name: 'SeLite Miscellaneous',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-miscellaneous/'
        },
        'bootstrap@selite.googlecode.com': {
            name: 'SeLite Bootstrap',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-bootstrap/'
        },
        'settings@selite.googlecode.com': {
            name: 'SeLite Settings',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/'
        },
        'testcase-debug-context@selite.googlecode.com': {
            name: 'SeLite TestCase Debug Context',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-testcase-debug-conte/',
            compatibleVersion: '0.76'
        }
    },
    preActivate: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        var autoCheckDetector= new SeLiteSettings.Field.Choice.String('autoCheckDetector', false, undefined, {"SeLiteAutoCheck.DetectorPHP":"SeLiteAutoCheck.DetectorPHP"} );
        var autoCheckDetectorCustom= new SeLiteSettings.Field.String( 'autoCheckDetectorCustom', false, undefined, false );
        var autoCheckDetectorCustomURL= new SeLiteSettings.Field.String( 'autoCheckDetectorCustomURL', false, undefined, false );
        var autoCheckAssert= new SeLiteSettings.Field.Bool( 'autoCheckAssert', false, false );
        var autoCheckRequired= new SeLiteSettings.Field.String( 'autoCheckRequired', true, [], false );
        var autoCheckRefused= new SeLiteSettings.Field.String( 'autoCheckRefused', true, [], false );
        var autoCheckIgnored= new SeLiteSettings.Field.String( 'autoCheckIgnored', true, [], false );
        settingsModule.addFields( [autoCheckDetector, autoCheckDetectorCustom, autoCheckAssert, autoCheckRequired, autoCheckRefused, autoCheckIgnored] );
    }
} );
