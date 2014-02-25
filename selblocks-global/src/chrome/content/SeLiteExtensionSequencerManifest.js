SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'selblocks-global@selite.googlecode.com',
    coreUrl: 'chrome://selite-selblocks-global/content/extensions/sel-blocks.js',
    xmlUrl: 'chrome://selite-selblocks-global/content/reference.xml',
    requisitePlugins: {
        'testcase-debug-context@selite.googlecode.com': 'SeLite TestCase Debug Context',
        'misc@selite.googlecode.com': 'SeLite Miscellaneous'
    }
} );
