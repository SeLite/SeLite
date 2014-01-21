"use strict";

var appDB= new SeLiteSettings.Field.SQLite('appDB');
var testDB= new SeLiteSettings.Field.SQLite('testDB',  /*defaultKey*/undefined, /*requireAndPopulate*/undefined, /*customValidate*/undefined, /*saveFile*/true);
var vanillaDB= new SeLiteSettings.Field.SQLite('vanillaDB', /*defaultKey*/undefined, /*requireAndPopulate*/undefined, /*customValidate*/undefined, /*saveFile*/true );
var appDBpermissions= new SeLiteSettings.Field.String( 'appDBpermissions', /*multivalued*/false, /*defaultKey*/'666', /*requireAndPopulate:*/true ); // octal number
var webroot= new SeLiteSettings.Field.String('webRoot', /*multivalued:*/false, 'http://localhost/drupal7/', /*requireAndPopulate:*/true);
//var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', false, 20);

var users= new SeLiteSettings.Field.FixedMap( 'FixedMapTest', [], {} );

new SeLiteSettings.Module( 'extensions.selite-settings.drupal-demo',
    [appDB, testDB, vanillaDB, appDBpermissions, webroot/*, maxNumberOfRuns*/],
    true,
    'default',
    true,
    SELITE_SETTINGS_FILE_URL // This will get set by SeLite
);
