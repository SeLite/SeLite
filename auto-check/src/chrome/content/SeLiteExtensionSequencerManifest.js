"use strict";

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
        var autoCheckDetectionClass= new SeLiteSettings.Field.String( 'autoCheckDetectionClass', false, '', true );
        var autoCheckAssert= new SeLiteSettings.Field.Bool( 'autoCheckAssert', false, true );
        var autoCheckRequired= new SeLiteSettings.Field.String( 'autoCheckRequired', true, [], true );
        var autoCheckRefused= new SeLiteSettings.Field.String( 'autoCheckRefused', true, [], true );
        settingsModule.addFields( [autoCheckDetectionClass, autoCheckAssert, autoCheckRequired, autoCheckRefused] );
    }
} );
