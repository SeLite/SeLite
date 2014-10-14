"use strict";

/* appDB, testDB and vanillaDB must have those names, since SeLiteSettings.setModuleForReloadButtons() depends on them.
 * Also, SeLiteData.getStorageFromSettings() depends on name testDB.
 */
var appDB= new SeLiteSettings.Field.SQLite('appDB');
var testDB= new SeLiteSettings.Field.SQLite('testDB');
var vanillaDB= new SeLiteSettings.Field.SQLite('vanillaDB');
// This is needed because Selenium IDE desn't allow base URL to contain path (http://code.google.com/p/selenium/issues/detail?id=3116).
var webRoot= new SeLiteSettings.Field.String('webRoot', /*multivalued:*/false, undefined, /*allowNull*/true);

// Following two fields logically belong to SeLite Miscellaneous. However, they couldn't be defined in SeLiteExtensionSequencerManifest.js there, since SeLite Miscellaneous gets initialised before SeLite Settings (due to dependency), and therefore 'extensions.selite-settings.common' module wouldn' be defined yet.
// 'name' attribute of login (username) field. It serves when storing/updating passwords via Firefox login manager.
var usernameField= new SeLiteSettings.Field.String('usernameField', /*multivalued:*/false, /*defaultKey*/undefined, /*allowNull*/true);
// 'name' attribute of password field. It serves when storing/updating passwords via Firefox login manager.
var passwordField= new SeLiteSettings.Field.String('passwordField', /*multivalued:*/false, /*defaultKey*/undefined, /*allowNull*/true);

/** A map: role symbolic name => user name. Add the keys in your custom framework. Use SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' ).getField( 'roles' ).addKeys( [...] ); 
 * Use SeLiteSettings.roleToUser() in your scripts to get the user for a given role.
 * */
var roles= new SeLiteSettings.Field.FixedMap.String( 'roles' );

var settingsModule= new SeLiteSettings.Module( 'extensions.selite-settings.common',
    [appDB, testDB, vanillaDB, roles, webRoot, usernameField, passwordField],
    /*allowSets:*/true,
    /*defaultSetName:*/null,
    /*associatesWithFolders:*/true,
    /*Location of this file - it will be set by SeLite:*/SELITE_SETTINGS_FILE_URL
);

SeLiteSettings.setModuleForReloadButtons( settingsModule );