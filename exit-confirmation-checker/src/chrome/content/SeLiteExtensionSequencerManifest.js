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
    callBack: function(api) {
        Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
        var settingsModule= SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' );
        var exitConfirmationCheckerMode= new SeLiteSettings.Field.Choice.String(
                'exitConfirmationCheckerMode', false, "inactive",
                {   inactive:"Inactive (confirmation popups shown if present, no validation)",
                    ignored:"Ignored (confirmation popups not shown, no validation)",
                    basic:"Basic (confirmation popups not shown, confirmation validated, confirmation expected for reverted changes)",
                    skipRevertedChanges:"Advanced (confirmation popups not shown, confirmation validated, confirmation not expected for reverted changes)"
                }
        );        
        settingsModule.addFields( [exitConfirmationCheckerMode] );
    }
    
} );
