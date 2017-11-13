"use strict";
// We need this, since in 2017 Mozilla API doesn't indicate whether other extensions are multi-process/eeb-extensions compatible.
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/management/ExtensionInfo lists "offlineEnabled", but Mozilla doesn't provide a way to set it.

// addon ID => string last version before WebExtensions
old_addon_versions= {
    "auto-check@selite.googlecode.com": "0.13",
    "bootstrap@selite.googlecode.com": "0.97",
    
};