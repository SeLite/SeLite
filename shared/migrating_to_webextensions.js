"use strict";
// When debugging locally with 'web-ext run', Firefox doesn't pick up changes to this file if symlinked. Hence after changing the target file, change some other (not symlinked) file, too.

const ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS= "ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS";

function addListenerForUpdate() {
    // When debugging with 'web-ext run', the following was triggered with details.reason==='update'. Triggered twice in Firefox 56.0 (for the same start), but only once in Firefox 57.0b14.
    // I used runtime.onInstalled() instead of management.onInstalled(), because only runtime.onInstalled() indicates whether the change is an install or an update. See https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onInstalled
    browser.runtime.onInstalled.addListener( details => {
        if( details.reason==="update" && upgradedToWebExtensions(browser.runtime.id, details.previousVersion) || details.reason==="install" ) {
            browser.storage.sync.get(ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS).then(
                alreadyStoredValues => {
                    if( !(ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS in alreadyStoredValues) ) {
                        browser.management.getAll( extensionInfos => {
                            for( var extension of extensionInfos ) {
                                if( extension.id!==browser.runtime.id
                                    && upgradedToWebExtensions(extension.id, extension.version)
                                ) {
                                    browser.storage.sync.set(ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS, true);
                                    return;
                                }
                            }
                            openTab( "/shared/migrating_to_webextensions-"
                                    +(details.reason==="update"
                                        ? "update.html"
                                        : "install.html"
                                    )
                            ).then( success=> {
                                var storeKeyToValue= {};
                                storeKeyToValue[ALREADY_NOTIFIED_SELITE_MIGRATING_TO_WEB_EXTENSIONS]= true;
                                browser.storage.sync.set(storeKeyToValue);
                            });
                        });
                    }
                },
                rejection => {
                    openTab( "about:blank#SeLite_storage_get_failed:"+rejection );
                });
        }
    });
}

function upgradedToWebExtensions( seLiteComponentExtensionID, previousInstalledVersion ) {
    var lastObsoleteVersion= lastObsoleteAddOnVersions[seLiteComponentExtensionID];
    return lastObsoleteVersion!==undefined
        && previousInstalledVersion.localeCompare(lastObsoleteVersion, undefined, {numeric:true})<=0;
}

function openTab( url ) {
    return browser.windows.getCurrent().then( window => {
        //@TODO how do I chain the following to the overall result Promise?
        return browser.tabs.create( {
            url: url,
            windowId: window.id
        });
    });
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