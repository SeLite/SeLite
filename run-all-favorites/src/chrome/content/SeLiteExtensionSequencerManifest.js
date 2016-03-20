"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite Run All Favorites',
    id: 'run-all-favorites@selite.googlecode.com',
    ideURL: [
        'chrome://selite-run-all-favorites/content/extensions/run-all-favorites-ide.js'
    ],
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-run-all-favorites/',
    nonSequencedRequisitePlugins: {
        'favorites_selenium-ide@Samit.Badle': {
            name: 'Favorites (Selenium IDE)',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/favorites-selenium-ide/',
            minVersion: '2.0'
        }
    }
} );
