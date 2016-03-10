"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite Preview',
    id: 'preview@selite.googlecode.com',
    coreURL: 'chrome://selite-preview/content/extensions/core-extension.js',
    ideURL: 'chrome://selite-preview/content/extensions/ide-extension.js',
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-preview/',
    requisitePlugins: {
        'selblocks-global@selite.googlecode.com': {
            name: 'SeLite SelBlocks Global',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-selblocks-global/'
        },
        'misc@selite.googlecode.com': {
            name: 'SeLite Miscellaneous',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-miscellaneous/'
        }/*,
        'settings@selite.googlecode.com': {
            name: 'SeLite Settings',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/'
        }*/
    }
} );
