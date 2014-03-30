"use strict";

SeLiteExtensionSequencer.registerPlugin({
    pluginId: 'settings@selite.googlecode.com',
    coreUrl: 'chrome://selite-settings/content/extensions/core-extension.js',
    // There is no xmlUrl field, because this doesn't add any new Selenese
    ideUrl: 'chrome://selite-settings/content/extensions/ide-extension.js',
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous'
    },
    callBack: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        SeLiteSettings.commonSettings= SeLiteSettings.loadFromJavascript(
            'extensions.selite-settings.common',
            'chrome://selite-settings/content/common_settings_module.js'
        );
    }
});