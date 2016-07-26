"use strict";

/* appDB, testDB and vanillaDB must have those names, since SeLiteSettings.setModuleForReloadButtons() depends on them.
 * Also, SeLiteData.getStorageFromSettings() depends on name testDB.
 */
var appDB= new SeLiteSettings.Field.SQLite('appDB', undefined, false, "Application database (or its export/copy)" );
var testDB= new SeLiteSettings.Field.SQLite('testDB', undefined, false, "Test database" );
var vanillaDB= new SeLiteSettings.Field.SQLite('vanillaDB', undefined, false, "Vanilla database (serving as a snapshot of application database)" );
// This is needed because Selenium IDE desn't allow base URL to contain path (https://github.com/SeleniumHQ/selenium/issues/1550).
var webRoot= new SeLiteSettings.Field.String('webRoot', /*multivalued:*/false, undefined, /*allowNull*/true, "Webroot of the tested application" );

// Following two fields logically belong to SeLite Miscellaneous. However, they couldn't be defined in SeLiteExtensionSequencerManifest.js there, since SeLite Miscellaneous gets initialised before SeLite Settings (due to dependency), and therefore 'extensions.selite-settings.common' module wouldn' be defined yet.
// 'name' attribute of login (username) field. It serves when storing/updating passwords via Firefox login manager.
var usernameField= new SeLiteSettings.Field.String('usernameField', /*multivalued:*/false, /*defaultKey*/undefined, /*allowNull*/true, "Name of HTML attribute used for user name input. Used when storing/updating credentials in Firefox login manager." );
// 'name' attribute of password field. It serves when storing/updating passwords via Firefox login manager.
var passwordField= new SeLiteSettings.Field.String('passwordField', /*multivalued:*/false, /*defaultKey*/undefined, /*allowNull*/true, "Name of HTML attribute used for user password input. Used when storing/updating credentials in Firefox login manager.");

/** A map: role symbolic name => user name. Add the keys in your custom framework. Use SeLiteSettings.loadFromJavascript( 'extensions.selite-settings.common' ).getField( 'roles' ).addKeys( [...] ); 
 * Use SeLiteSettings.roleToUser() in your scripts to get the user for a given role.
 * */
var roles= new SeLiteSettings.Field.FixedMap.String( 'roles', undefined, undefined, "Test roles, as defined by the framework. Enter usernames for those roles." );

var narrowBy= new SeLiteSettings.Field.String( 'narrowBy', /*multivalued*/false, /*default*/undefined, /*allowNull*/false, "String to put into any new records (where applicable) and to filter/narrow records by it when searching/navigating." );
var alwaysTestGeneratingKeys= new SeLiteSettings.Field.Boolean( 'alwaysTestGeneratingKeys', /*default*/undefined, /*allowNull*/false, "Whether Selenese command insertCaptureKey (from DbObjects) should always let SQLite generate a primary key, but also capture it from the application and test thei equivalence." );

var settingsModule= new SeLiteSettings.Module( 'extensions.selite-settings.common',
    [appDB, testDB, vanillaDB, roles, webRoot, usernameField, passwordField, narrowBy, alwaysTestGeneratingKeys],
    /*allowSets:*/true,
    /*defaultSetName:*/undefined,
    /*associatesWithFolders:*/true,
    /*Location of this file - it will be set by SeLite:*/SELITE_SETTINGS_FILE_URL
);

SeLiteSettings.setModuleForReloadButtons( settingsModule );