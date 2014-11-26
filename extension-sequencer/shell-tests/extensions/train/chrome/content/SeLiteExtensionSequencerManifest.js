"use strict";

SeLiteExtensionSequencer.registerPlugin({
    name: 'SeLite Test Train'
    ,id: 'test-train@selite.googlecode.com'
    ,infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/dummy-test-train/'
    ,oldestCompatibleVersion: "0.05"
    ,requisitePlugins: {
        'test-rail@selite.googlecode.com': {
            name: 'SeLite Test Rail',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/dummy-test-rail/'
            //,compatibleVersion: 0.15
            //,minVersion: 0.15
        }
    }
});