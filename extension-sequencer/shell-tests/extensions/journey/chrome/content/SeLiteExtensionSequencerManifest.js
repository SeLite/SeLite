"use strict";

SeLiteExtensionSequencer.registerPlugin({
    name: 'SeLite Test Journey'
    ,id: 'test-journey@selite.googlecode.com'
    ,infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/dummy-test-journey/'
    //,oldestCompatibleVersion: "0.22"
    ,requisitePlugins: {
        'test-train@selite.googlecode.com': {
            name: 'SeLite Test Train',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/dummy-test-train/'
            //,compatibleVersion: "0.10"
            //,minVersion: "0.10"
        }
    }
});