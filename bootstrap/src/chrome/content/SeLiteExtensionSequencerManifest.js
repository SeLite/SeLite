SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'bootstrap@selite.googlecode.com',
    coreUrl: 'chrome://selite-bootstrap/content/extensions/se_bootstrap.js',
    requisitePlugins: {
        'misc@selite.googlecode.com': 'SeLite Miscellaneous',
        'testcase-debug-context@selite.googlecode.com': 'SeLite TestCase Debug Context',
        'selblocks-global@selite.googlecode.com': 'SeLite SelBlocksGlobal',
        'settings@selite.googlecode.com': 'SeLite Settings'
    }
} );
