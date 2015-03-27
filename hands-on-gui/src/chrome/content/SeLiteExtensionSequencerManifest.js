"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite Hands-on GUI',
    id: 'hands-on-gui@selite.googlecode.com',
    ideURL: [
        'chrome://selite-hands-on-gui/content/extensions/ide-extension.js'
    ],
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-hands-on-gui/',
    requisitePlugins: {
        'misc@selite.googlecode.com': {
            name: 'SeLite Miscellaneous',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-miscellaneous/'
        },
        'clipboard-and-indent@selite.googlecode.com': {
            name: 'SeLite Clipboard And Indent',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-clipboard-and-indent/'
        }
    }
} );
