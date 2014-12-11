"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'Selenium IDE: Implicit wait',
    id: 'implicit-wait@florent.breheret',
    coreURL: "chrome://implicit-wait/content/extensions/implicit-wait-ext.js",
    ideURL: 'chrome://implicit-wait/content/extensions/implicit-wait-ide.js',
    xmlURL: "chrome://implicit-wait/content/extensions/implicit-wait-ide.xml",
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selenium-ide-implicit-wait/',
    requisitePlugins: {
        /*'settings@selite.googlecode.com': {
            name: 'SeLite Settings',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/'
        },*/
        'testcase-debug-context@selite.googlecode.com': {
            name: 'SeLite TestCase Debug Context',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-testcase-debug-conte/',
            compatibleVersion: '0.76'
        }
    }
} );
