SeLiteExtensionSequencer.registerPlugin( {
    pluginId: 'exit-confirmation-checker@selite.googlecode.com',
    coreUrl: 'chrome://selite-exit-confirmation-checker/content/extensions/core.js',
    requisitePlugins: {
        'testcase-debug-context@selite.googlecode.com': 'SeLite TestCase Debug Context',
        'settings@selite.googlecode.com': 'SeLite Settings'
    },
    optionalRequisitePlugins: {
        'commands@selite.googlecode.com': 'SeLite Commands'
    },
    preActivate: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        var exitConfirmationCheckerMode= new SeLiteSettings.Field.Choice.String(
                'exitConfirmationCheckerMode', false, "inactive",
                {   inactive:"Inactive (no validation, show any confirmation popups)",
                    ignored:"Ignore (no validation, don't show any confirmation popups)",
                    includeRevertedChanges:"Include reverted changes (validate confirmation, expect confirmation for reverted changes, don't show any confirmation popups)",
                    skipRevertedChanges:"Exclude reverted changes (validate confirmation, expect no confirmation for reverted changes, don't show any confirmation popups)"
                }
        );
        var exitConfirmationCheckerAssert= new SeLiteSettings.Field.Bool( 'exitConfirmationCheckerAssert', false, false );
        settingsModule.addFields( [exitConfirmationCheckerMode, exitConfirmationCheckerAssert] );
    }
    
} );
