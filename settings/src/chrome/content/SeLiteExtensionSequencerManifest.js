Components.utils.import("chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js");
SeLiteExtensionSequencer.registerPlugin({
    pluginId: 'settings@selite.googlecode.com',
    coreUrl: 'chrome://selite-settings/content/extensions/core-extension.js',
    // There is no xmlUrl field, because this doesn't add any new Selenese
    ideUrl: 'chrome://selite-settings/content/extensions/ide-extension.js'
});

var EXPORTED_SYMBOLS= [];