SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'bootstrap@selite.googlecode.com',
    coreUrl: 'chrome://selite-bootstrap/content/extensions/se_bootstrap.js',
    ideUrl: "chrome://selite-bootstrap/content/logic/SeBootstrap.js",
    requisitePlugins: {
        'testcase-debug-context@selite.googlecode.com': 'SeLite TestCase Debug Context',
        'selblocks-global@selite.googlecode.com': 'SeLite SelBlocksGlobal'
    },
    callBack: function(api) {
        // Based on PluginFramework.prototype.addPluginProvidedStringPreference() from https://addons.mozilla.org/en-US/firefox/addon/file-logging-selenium-ide/
        api.preferences.DEFAULT_OPTIONS["se_bootstrap_scriptFileName"] = api.preferences.getString("se_bootstrap_scriptFileName", '');
        api.preferences.save(api.preferences.DEFAULT_OPTIONS, "se_bootstrap_scriptFileName");
    }
} );
