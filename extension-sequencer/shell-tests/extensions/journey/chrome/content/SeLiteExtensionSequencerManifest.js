"use strict";

SeLiteExtensionSequencer.registerPlugin({
    name: 'SeLite Test Journey',
    id: 'test-journey@selite.googlecode.com',
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/dummy-test-journey/',
    requisitePlugins: {
        'test-train@selite.googlecode.com': {
            name: 'SeLite Test Train',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/dummay-test-train/'
        }
    }
});