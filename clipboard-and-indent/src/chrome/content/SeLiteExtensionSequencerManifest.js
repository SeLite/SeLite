"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite Clipboard And Indent',
    id: 'clipboard-and-indent@selite.googlecode.com',
    ideURL: [
        'chrome://selite-clipboard-and-indent/content/extensions/ide-extension.js'
    ],
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-clipboard-and-indent/',
    optionalRequisitePlugins: {
        'settings@selite.googlecode.com': {
            name: 'SeLite Settings',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/'
        }
    },
    preActivate: function(api) {
        try {
            Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        }
        catch(e) {}
        if( typeof SeLiteSettings!==undefined ) {
            var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
            var indentationStep= new SeLiteSettings.Field.Int(
                    'indentationStep', false, 4, false, "Indentation step in Selenium IDE GUI. Used by SeLite Clipboard And Indent. Restart Selenium IDE after change this in order to have effect." );
            settingsModule.addField( indentationStep );
        }
    }
} );
