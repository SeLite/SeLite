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
        var autoCheckDetectionClass= new SeLiteSettings.Field.Choice.String('autoCheckDetectionClass', false, undefined, {php:"PHP (including Xdebug)"} );
        var autoCheckDetectionClassCustom= new SeLiteSettings.Field.String( 'autoCheckDetectionClassCustom', false, undefined, false );
        var autoCheckAssert= new SeLiteSettings.Field.Bool( 'autoCheckAssert', false, false );
        var autoCheckRequired= new SeLiteSettings.Field.String( 'autoCheckRequired', true, [], false );
        var autoCheckRefused= new SeLiteSettings.Field.String( 'autoCheckRefused', true, [], false );
        settingsModule.addFields( [autoCheckDetectionClass, autoCheckDetectionClassCustom, autoCheckAssert, autoCheckRequired, autoCheckRefused] );
    }
} );
