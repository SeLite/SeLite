"use strict";

SeLiteExtensionSequencer.registerPlugin({
    name: 'SeLite Settings',
    id: 'settings@selite.googlecode.com',
    coreURL: 'chrome://selite-settings/content/extensions/core-extension.js',
    // There is no xmlURL field, because this doesn't add any new Selenese
    ideURL: 'chrome://selite-settings/content/extensions/ide-extension.js',
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/',
    requisitePlugins: {
        'misc@selite.googlecode.com': {
            name: 'SeLite Miscellaneous',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-miscellaneous/',
            minVersion: '0.87'
        }
    },
    preActivate: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        SeLiteSettings.commonSettings= SeLiteSettings.loadFromJavascript(
            'extensions.selite-settings.common',
            'chrome://selite-settings/content/common_settings_module.js'
        );
    }
});