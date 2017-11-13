"use strict";
// When debugging locally with 'web-ext run', Firefox doesn't pick up changes to this file if symlinked. Hence after changing the target file, change some other (not symlinked) file, too.

const ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS= "ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS";

function addListenerForUpdate() {
    // Using runtime.onInstalled() instead of management.onInstalled(), because only runtime.onInstalled() indicates whether it's an install or an update. See https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onInstalled
    browser.runtime.onInstalled.addListener( details => {
        //// Unsure what would trigger first: management.getSelf() or runtime.onInstalled event. To be safe, handle runtime.onInstalled first.
        // browser.management.getSelf().then( currentExtension => {...} );
        
        // Following is simpler than https://developer.mozilla.org/en-US/docs/Toolkit_version_format#Comparing_versions, since SeLite doesn't use string version parts ("alpha", "beta", "a"...).
        // However, due to possible multi-digit version parts (e.g. 10.xyz), it uses https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare#Using_options > numeric
        if( details.reason==="update" && upgradedToWebExtensions(browser.runtime.id, details.previousVersion) || details.reason==="install" ) {
            browser.storage.sync.get(ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS).catch( rejection => {
                browser.management.getAll( extensionInfos => {
                    for( var extension of extensionInfos ) {
                        if( extension.id!==browser.runtime.id
                            && upgradedToWebExtensions(extension.id, extension.version)
                        ) {
                            browser.storage.sync.set(ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS, true);
                            return;
                        }
                    }
                    browser.tabs.create( {
                        url: "/shared/migrating_to_webextensions-update-"
                        +(details.reason==="update"
                            ? "update.html"
                            : "install.html"
                        )
                    }).then( success=> {//@TODO test with a global variable & alert: If I remove these curly {}, will it store before or after Promise succeeds?!
                         browser.storage.sync.set(ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS, true); } );
                });
            });
        }
        else {browser.tabs.create( {url: "about:blank#no-upgrade"});}
    });
}

function upgradedToWebExtensions( seLiteComponentExtensionID, previousInstalledVersion ) {
    var lastObsoleteVersion= lastObsoleteAddOnVersions[seLiteComponentExtensionID];
    return lastObsoleteVersion!==undefined
        && previousInstalledVersion.localeCompare(lastObsoleteVersion, undefined, {numeric:true})<=0;
}

// We need this, since in 2017 Mozilla API doesn't indicate whether other extensions are compatible with multi-process/WebExtensions.
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/management/ExtensionInfo lists "offlineEnabled", but Mozilla doesn't provide a way to set it.

// addon ID => string last version before WebExtensions
var lastObsoleteAddOnVersions= {
    "auto-check@selite.googlecode.com": "0.13",
    "bootstrap@selite.googlecode.com": "0.97",
    "clipboard-and-indent@selite.googlecode.com": "0.25",
    "commands@selite.googlecode.com": "1.00",
    "db-objects@selite.googlecode.com": "0.93",
    "exit-confirmation-checker@selite.googlecode.com": "0.16",
    "extension-sequencer@selite.googlecode.com": "0.54",
    "hands-on-gui@selite.googlecode.com": "0.08",
    "misc@selite.googlecode.com": "1.10",
    "preview@selite.googlecode.com": "0.13",
    "run-all-favorites@selite.googlecode.com": "0.17",
    "settings@selite.googlecode.com": "0.66",
    "sqlite-connection-manager@selite.googlecode.com": "0.78",
    "testcase-debug-context@selite.googlecode.com": "0.82",
    "selblocks-global@selite.googlecode.com": "2.71"
};