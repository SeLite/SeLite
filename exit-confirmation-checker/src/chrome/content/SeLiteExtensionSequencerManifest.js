"use strict";
SeLiteExtensionSequencer.registerPlugin( {
    name: 'SeLite Exit Confirmation Checker',
    id: 'exit-confirmation-checker@selite.googlecode.com',
    coreURL: 'chrome://selite-exit-confirmation-checker/content/extensions/core.js',
    infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-exit-confirmation-check/',
    requisitePlugins: {
        'testcase-debug-context@selite.googlecode.com': {
            name: 'SeLite TestCase Debug Context',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-testcase-debug-conte/',
            minVersion: '0.76'
        },
        'settings@selite.googlecode.com': {
            name: 'SeLite Settings',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-settings/',
            minVersion: '0.49'
        }
    },
    optionalRequisitePlugins: {
        'commands@selite.googlecode.com': {
            name: 'SeLite Commands',
            infoURL: 'https://addons.mozilla.org/en-US/firefox/addon/selite-commands/'
        }
    },
    preActivate: function(api) {
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        var exitConfirmationCheckerMode= new SeLiteSettings.Field.Choice.String(
                'exitConfirmationCheckerMode', false, "inactive",
                {   inactive:"Inactive (no validation, show any confirmation popups)",
                    ignored:"Ignore (no validation, don't show any confirmation popups)",
                    includeRevertedChanges:"Include reverted changes (validate confirmation, expect confirmation for reverted changes, don't show any confirmation popups)",
                    skipRevertedChanges:"Exclude reverted changes (validate confirmation, expect no confirmation for reverted changes, don't show any confirmation popups)"
                },
                false,
                "How to handle exit confirmation popups."
        );
        var exitConfirmationCheckerAssert= new SeLiteSettings.Field.Boolean( 'exitConfirmationCheckerAssert', false, false, "Whether exit confirmation popups should be checked as assert. Otherwise they're checked as validation only." );
        settingsModule.addFields( [exitConfirmationCheckerMode, exitConfirmationCheckerAssert] );
    }
    
} );
