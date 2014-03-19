"use strict";

/* appDB, testDB and vanillaDB must have those names, since SeLiteSettings.setModuleForReloadButtons() depends on them.
 * Also, SeLiteData.getStorageFromSettings() depends on name testDB.
 */
var appDB= new SeLiteSettings.Field.SQLite('appDB');
var testDB= new SeLiteSettings.Field.SQLite('testDB',  /*defaultKey*/undefined, /*requireAndPopulate*/undefined, /*customValidate*/undefined, /*saveFile*/true);
var vanillaDB= new SeLiteSettings.Field.SQLite('vanillaDB', /*defaultKey*/undefined, /*requireAndPopulate*/undefined, /*customValidate*/undefined, /*saveFile*/true );

var roles= new SeLiteSettings.Field.FixedMap.String( 'roles', [], {}, /*requireAndPopulate*/true );

var settingsModule= new SeLiteSettings.Module( 'extensions.selite-settings.common',
    [appDB, testDB, vanillaDB, roles],
    /*allowSets:*/true,
    /*defaultSetName:*/null,
    /*associatesWithFolders:*/true,
    /*Location of this file - it will be set by SeLite:*/SELITE_SETTINGS_FILE_URL
);

SeLiteSettings.setModuleForReloadButtons( settingsModule );