"use strict";

var appDB= new SeLiteSettings.Field.SQLite('appDB');
var testDB= new SeLiteSettings.Field.SQLite('testDB',  /*defaultKey*/undefined, /*requireAndPopulate*/undefined, /*customValidate*/undefined, /*saveFile*/true);
var vanillaDB= new SeLiteSettings.Field.SQLite('vanillaDB', /*defaultKey*/undefined, /*requireAndPopulate*/undefined, /*customValidate*/undefined, /*saveFile*/true );
var appDBpermissions= new SeLiteSettings.Field.String( 'appDBpermissions', /*defaultKey*/false, /*defaultKey*/'666' ); //@TODO potentially validate that it's an octal
var appWebroot= new SeLiteSettings.Field.String('appWebroot', false, 'http://localhost/app');
var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', false, 20);

var module= new SeLiteSettings.Module( 'extensions.selite-settings.basic',
    [appDB, testDB, vanillaDB, appDBpermissions, appWebroot, maxNumberOfRuns],
    true/*allowSets*/,
    'default',
    true,
    SELITE_SETTINGS_FILE_URL // This will be set by SeLite
);

module= SeLiteSettings.register( module );

var mainDb= new SeLiteSettings.Field.SQLite('mainDb');
var oneFolder= new SeLiteSettings.Field.Folder( 'oneFolder' );
var files= new SeLiteSettings.Field.File( 'files', false, false, true, [] );
var folders= new SeLiteSettings.Field.Folder( 'folders', false, false, true, [] );
var bool= new SeLiteSettings.Field.Bool('aBooleanField', false);
var appWebroot= new SeLiteSettings.Field.String('appWebroot', false, 'http://localhost/app');
var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', false, 20);
var multiNumbers= new SeLiteSettings.Field.Int('multiNumbers', true, [8,9], true );
var decimal= new SeLiteSettings.Field.Decimal('decimal', false, 3.141 );

var module= new SeLiteSettings.Module( 'extensions.selite-settings.test',
    [mainDb, oneFolder, files, folders, bool, appWebroot, maxNumberOfRuns, multiNumbers, decimal],
    true,
    'mainSet',
    false,
    SELITE_SETTINGS_FILE_URL
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
var bool2= new SeLiteSettings.Field.Bool('aBooleanField2', false);
var appWebroot2= new SeLiteSettings.Field.String('appWebroot2', false, 'http://localhost/app');
var maxNumberOfRuns2= new SeLiteSettings.Field.Int('maxNumberOfRuns2', false, 20);
var multiNumbers= new SeLiteSettings.Field.Int('multiNumbers', true, [13,14]);
var multiStrings= new SeLiteSettings.Field.String('multiStrings', true, ['hamster', 'crayfish']);
var choiceNumbers= new SeLiteSettings.Field.Choice.Int('choiceNumbers', true, [5, 10], {1:1, 5:5, 10:10, 20:20} );
var choiceStrings= new SeLiteSettings.Field.Choice.String('choiceStrings', true, [2, 4], {1:"one", 2:"two", 4:"four", 8:"eight"} );

var choiceNumbersSingle= new SeLiteSettings.Field.Choice.Int('choiceNumbersSingle', false, 1, {1:1, 5:5, 10:10, 20:20} );
var choiceStringsSingle= new SeLiteSettings.Field.Choice.String('choiceStringsSingle', false, '4', {1:"one", 2:"two", 4:"four", 8:"eight"} );

var module2= new SeLiteSettings.Module( 'extensions.selite-settings.test2',
    [mainDb2, bool2, appWebroot2, maxNumberOfRuns2, multiNumbers, multiStrings,
        choiceNumbers,  choiceStrings/**/,
        choiceNumbersSingle, choiceStringsSingle
    ],
    false,
    null,
    false,
    SELITE_SETTINGS_FILE_URL
);
module2= SeLiteSettings.register( module2 );
//-----------

var mainDb= new SeLiteSettings.Field.SQLite('mainDb');
var oneFolder= new SeLiteSettings.Field.Folder( 'oneFolder' );
var files= new SeLiteSettings.Field.File( 'files', false, false, true, [] );
var folders= new SeLiteSettings.Field.Folder( 'folders', false, false, true, [] );
var bool= new SeLiteSettings.Field.Bool('bool', null);
var appWebroot= new SeLiteSettings.Field.String('appWebroot', false, 'http://localhost/app');
var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', false, 20);
var singleNumber= new SeLiteSettings.Field.Int('singleNumber' );
var singleString= new SeLiteSettings.Field.String('singleString' );
var multiNumbers= new SeLiteSettings.Field.Int('multiNumbers', true, []);
var multiStrings= new SeLiteSettings.Field.String('multiStrings', true, [] );
var choiceNumbers= new SeLiteSettings.Field.Choice.Int('choiceNumbers', true, [], {1:1, 5:5, 10:10, 20:20} );
var choiceStrings= new SeLiteSettings.Field.Choice.String('choiceStrings', true, [], {1:"one", 2:"two", 4:"four", 8:"eight"} );
var choiceNumbersSingle= new SeLiteSettings.Field.Choice.Int('choiceNumbersSingle', false, 1, {1:1, 5:5, 10:10, 20:20} );
var choiceStringsSingle= new SeLiteSettings.Field.Choice.String('choiceStringsSingle', false, '4', {1:"one", 2:"two", 4:"four", 8:"eight"} );

var module= new SeLiteSettings.Module( 'extensions.selite-settings.withFolders',
    [mainDb, oneFolder, files, folders, bool, appWebroot, maxNumberOfRuns,
     singleNumber, singleString,
     multiNumbers, multiStrings, choiceNumbers, choiceNumbersSingle, choiceStrings, choiceStringsSingle],
    true,
    'globalSet',
    true, //associatesWithFolders
    SELITE_SETTINGS_FILE_URL
    );
module= SeLiteSettings.register( module );

//-----------

var mainDb= new SeLiteSettings.Field.SQLite('mainDb');
var oneFolder= new SeLiteSettings.Field.Folder( 'oneFolder' );
var files= new SeLiteSettings.Field.File( 'files', false, false, true, []);
var folders= new SeLiteSettings.Field.Folder( 'folders', false, false, true, [] );
var bool= new SeLiteSettings.Field.Bool('bool', false);
var appWebroot= new SeLiteSettings.Field.String('appWebroot', false, 'http://localhost/app');
var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', false, 20);
var multiNumbers= new SeLiteSettings.Field.Int('multiNumbers', true, []);
var multiStrings= new SeLiteSettings.Field.String('multiStrings', true, [] );
var choiceNumbers= new SeLiteSettings.Field.Choice.Int('choiceNumbers', true, [], {1:1, 5:5, 10:10, 20:20} );
var choiceStrings= new SeLiteSettings.Field.Choice.String('choiceStrings', true, [], {1:"one", 2:"two", 4:"four", 8:"eight"} );
var choiceNumbersSingle= new SeLiteSettings.Field.Choice.Int('choiceNumbersSingle', false, 1, {1:1, 5:5, 10:10, 20:20} );
var choiceStringsSingle= new SeLiteSettings.Field.Choice.String('choiceStringsSingle', false, '4', {1:"one", 2:"two", 4:"four", 8:"eight"} );

var module= new SeLiteSettings.Module( 'extensions.selite-settings.withFolders2',
    [mainDb, oneFolder, files, folders, bool, appWebroot, maxNumberOfRuns, multiNumbers,
     multiStrings, choiceNumbers, choiceNumbersSingle, choiceStrings, choiceStringsSingle],
    true,
    'globalSet',
    true, //associatesWithFolders
    SELITE_SETTINGS_FILE_URL
    );
module= SeLiteSettings.register( module );
