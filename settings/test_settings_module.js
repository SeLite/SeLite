"use strict";

var SeLiteSettings= {};
Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js", SeLiteSettings);

var mainDb= new SeLiteSettings.Field.SQLite('mainDb');
var oneFolder= new SeLiteSettings.Field.Folder( 'oneFolder' );
var files= new SeLiteSettings.Field.File( 'files', false, false, null, true );
var folders= new SeLiteSettings.Field.Folder( 'folders', false, false, null, true );
var bool= new SeLiteSettings.Field.Bool('aBooleanField', true);
var appWebroot= new SeLiteSettings.Field.String('appWebroot', 'http://localhost/app');
var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', 20);
var multiNumbers= new SeLiteSettings.Field.Int('multiNumbers', null, true);

var module= new SeLiteSettings.Module( 'extensions.selite-settings.test',
    [mainDb, oneFolder, files, folders, bool, appWebroot, maxNumberOfRuns, multiNumbers],
    true,
    'mainSet',
    false,
    '~/selite/settings/test_settings_module.js'
    //@TODO If the file doesn't exist, make it report an error.
    //'file:///home/pkehl/selite/settings/test_settings_module.js'
);

module= SeLiteSettings.register( module );
module.createSet( 'alternativeSet');

 // Testing that SeLiteSettings.register() checks/compares modules properly:
/*mainDb= new SeLiteSettings.Field.File('mainDb', true, { 'SQLite': '.sqlite'});
module= new SeLiteSettings.Module( 'extensions.selite-settings.test.',
    [mainDb],
    true,
    'mainSet.'
);

module= SeLiteSettings.register( module );
/**/

var mainDb2= new SeLiteSettings.Field.SQLite('mainDb2');
var bool2= new SeLiteSettings.Field.Bool('aBooleanField2', true);
var appWebroot2= new SeLiteSettings.Field.String('appWebroot2', 'http://localhost/app');
var maxNumberOfRuns2= new SeLiteSettings.Field.Int('maxNumberOfRuns2', 20);
var multiNumbers= new SeLiteSettings.Field.Int('multiNumbers', null, true);
var multiStrings= new SeLiteSettings.Field.String('multiStrings', null, true );
var choiceNumbers= new SeLiteSettings.Field.Choice.Int('choiceNumbers', null, true, {1:1, 5:5, 10:10, 20:20} );
var choiceStrings= new SeLiteSettings.Field.Choice.String('choiceStrings', null, true, {1:"one", 2:"two", 4:"four", 8:"eight"} );

var choiceNumbersSingle= new SeLiteSettings.Field.Choice.Int('choiceNumbersSingle', '1', false, {1:1, 5:5, 10:10, 20:20} );
var choiceStringsSingle= new SeLiteSettings.Field.Choice.String('choiceStringsSingle', '4', false, {1:"one", 2:"two", 4:"four", 8:"eight"} );

var module2= new SeLiteSettings.Module( 'extensions.selite-settings.test2',
    [mainDb2, bool2, appWebroot2, maxNumberOfRuns2, multiNumbers, multiStrings,
        choiceNumbers,  choiceStrings/**/,
        choiceNumbersSingle, choiceStringsSingle
    ],
    false,
    null,
    false,
    '~/selite/settings/test_settings_module.js'
);
module2= SeLiteSettings.register( module2 );
//-----------

var mainDb= new SeLiteSettings.Field.SQLite('mainDb');
var oneFolder= new SeLiteSettings.Field.Folder( 'oneFolder' );
var files= new SeLiteSettings.Field.File( 'files', false, false, null, true );
var folders= new SeLiteSettings.Field.Folder( 'folders', false, false, null, true );
var bool= new SeLiteSettings.Field.Bool('bool', true);
var appWebroot= new SeLiteSettings.Field.String('appWebroot', 'http://localhost/app');
var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', 20);
var multiNumbers= new SeLiteSettings.Field.Int('multiNumbers', null, true);
var multiStrings= new SeLiteSettings.Field.String('multiStrings', null, true );
var choiceNumbers= new SeLiteSettings.Field.Choice.Int('choiceNumbers', null, true, {1:1, 5:5, 10:10, 20:20} );
var choiceStrings= new SeLiteSettings.Field.Choice.String('choiceStrings', null, true, {1:"one", 2:"two", 4:"four", 8:"eight"} );
var choiceNumbersSingle= new SeLiteSettings.Field.Choice.Int('choiceNumbersSingle', '1', false, {1:1, 5:5, 10:10, 20:20} );
var choiceStringsSingle= new SeLiteSettings.Field.Choice.String('choiceStringsSingle', '4', false, {1:"one", 2:"two", 4:"four", 8:"eight"} );

var module= new SeLiteSettings.Module( 'extensions.selite-settings.withFolders',
    [mainDb, oneFolder, files, folders, bool, appWebroot, maxNumberOfRuns, multiNumbers,
     multiStrings, choiceNumbers, choiceNumbersSingle, choiceStrings, choiceStringsSingle],
    true,
    'globalSet',
    true, //associatesWithFolders
    '~/selite/settings/test_settings_module.js'
    );
module= SeLiteSettings.register( module );
