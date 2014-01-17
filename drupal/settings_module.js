"use strict";

var appDB= new SeLiteSettings.Field.SQLite('appDB');
var testDB= new SeLiteSettings.Field.SQLite('testDB',  /*defaultKey*/undefined, /*requireAndPopulate*/undefined, /*customValidate*/undefined, /*saveFile*/true);
var vanillaDB= new SeLiteSettings.Field.SQLite('vanillaDB', /*defaultKey*/undefined, /*requireAndPopulate*/undefined, /*customValidate*/undefined, /*saveFile*/true );
var appDBpermissions= new SeLiteSettings.Field.String( 'appDBpermissions', /*defaultKey*/false, /*defaultKey*/'666' ); // octal number
//var appWebroot= new SeLiteSettings.Field.String('appWebroot', false, 'http://localhost/app');
//var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', false, 20);

var module= new SeLiteSettings.Module( 'extensions.selite-settings.drupal-demo',
    [appDB, testDB, vanillaDB, appDBpermissions/*, appWebroot, maxNumberOfRuns*/],
    true,
    'default',
    true,
    SELITE_SETTINGS_FILE_URL // This will get set by SeLite
);