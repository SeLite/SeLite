/*  Copyright 2013, 2014 Peter Kehl
    This file is part of SeLite Settings.
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";
var runningAsComponent= (typeof window==='undefined' || window && window.location && window.location.protocol==='chrome:');
// runningAsComponent is false when loaded via <script src="file://..."> or <script src="http://..."> rather than via Components.utils.import().
// Used for debugging; limited (because when it's not loaded via Components.utils.import() it can't access other components).

// Whether this file is being loaded.
var loadingPackageDefinition= true;
if( runningAsComponent ) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService); // -> instance of nsIPrefBranch
    Components.utils.import("resource://gre/modules/Services.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js" );
    var nsIPrefBranch= Components.interfaces.nsIPrefBranch;
    var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    var nsIIOService= Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);    
    Components.utils.import("resource://gre/modules/osfile.jsm");
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
}

// -------
// This component provides optional functionality (SeLiteSettings.TestDbKeeper.Columns), which depends on SeLiteData.
// That makes both JS components circularly dependent. Therefore here I define EXPORTED_SYMBOLS and any functionality required by SeLiteData,
// so that they both can be loaded well.
var SeLiteSettings= {};
var EXPORTED_SYMBOLS= ['SeLiteSettings'];

/** @private Array of functions, that are called whenever the test suite folder changes.
 * */
var unnamedTestSuiteFolderChangeHandlers= [];

/** Add a handler, that will be called whenever the current test suite folder is changed in Se IDE.
 *  It won't be called when Se IDE is closed. When you invoke SeLiteSettings.addTestSuiteFolderChangeHandler(handler)
 *  and Se IDE already has a test suite from a known folder, this won't invoke the handler on that known folder.
 *  The handler will only be called on any subsequent changes. That should be OK, since this is intended for Core extensions,
 *  which are loaded at Se IDE start (before user opens a test suite). Se IDE 2.4.0 starts with the last opened test suite,
 *  which is fine - by that time the handlers are in place.
 *  <br/>The order of calling handlers is not guaranteed.
 *  @param handler Function, with 1 parameter, which will be a string folder (or undefined, if the suite is unsaved and temporary).
 *  @param handlerName String; Required if you call this from a Core extension,
    because those get re-loaded if you re-start Se IDE (without restarting Firefox).
    Optional if you call this from a Javascript component - loaded through Components.utils.import()
    - because those won't get re-loaded if you restart Se IDE. If there already was a handler registered with the same handlerName,
 *  this replaces the previously registered function with the one given now.
 * */
SeLiteSettings.addTestSuiteFolderChangeHandler= function addTestSuiteFolderChangeHandler( handler, handlerName ) {
    SeLiteMisc.ensureType( handler, 'function', 'handler' );
    SeLiteMisc.ensureType( handlerName, ['string', 'undefined'], 'handlerName' );
    if( handlerName===undefined ) {
        unnamedTestSuiteFolderChangeHandlers.push(handler);
    }
    else {
        namedTestSuiteFolderChangeHandlers[handlerName]= handler;
    }
};

var closingIdeHandlers= [];

/** Register a handler, that is invoked when Selenium IDE is being closed down.
 *  This can only be called from Javascript components - loaded through Components.utils.import() -
 *  and directly from Selenium Core extensions, because Core extensions get re-loaded on successive restarts
 *  of Se IDE (during the same run of Firefox).
 * */
SeLiteSettings.addClosingIdeHandler= function addClosingIdeHandler( handler ) {
    SeLiteMisc.ensureType( handler, 'function', 'handler' );
    closingIdeHandlers.push( handler );
};
// -------- end of functionality required by SeLiteData

try {
    Components.utils.import('chrome://selite-db-objects/content/DbObjects.js');
    Components.utils.import('chrome://selite-db-objects/content/Db.js');
}
catch( e ) {
// I can't use alert() here in Firefox 30. So I follow https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Alerts_and_Notifications and I show a non-modal popup. Since the alert may show outside of Firefox, I make the title clarify that it's about a Firefox add-on.
    var title= "Firefox and Selenium IDE add-on SeLite Settings in restricted mode";
    var msg= "SeLiteSettings Javascript component is loaded. However, since you didn't install (or didn't enable) SeLite DB Objects, you can't use SeLiteSettings.TestDbKeeper.Columns. You can use the rest of SeLiteSettings.";
    console.warn( msg );
    try {
        Components.classes['@mozilla.org/alerts-service;1'].
            getService(Components.interfaces.nsIAlertsService).
            showAlertNotification(null, title, msg, false, '', null);
    } catch(e) {
        var win = Components.classes['@mozilla.org/embedcomp/window-watcher;1'].
            getService(Components.interfaces.nsIWindowWatcher).
            openWindow(null, 'chrome://global/content/alerts/alert.xul',
              '_blank', 'chrome,titlebar=no,popup=yes', null);
        win.arguments = [null, title, msg, false, ''];
    }
}

var modules= SeLiteMisc.sortedObject(true); // @private Object serving as an associative array { string module.name => SeLiteSettings.Module instance }

SeLiteSettings.DEFAULT_SET_NAME= "SELITE_DEFAULT_SET_NAME"; // CSS also depends on its value

// SELITE_MODULE_DEFINITION_FILE_OR_URL is hidden preference of the module, which allows SeLiteSettings to load the definition automatically
var MODULE_DEFINITION_FILE_OR_URL= "SELITE_MODULE_DEFINITION_FILE_OR_URL";
// MODULE_DEFINITION_ALLOW_SETS is hidden preference of the module, which reflects 'allowSets' property of SeLiteSettings.Module instance.
var MODULE_DEFINITION_ALLOW_SETS= 'MODULE_DEFINITION_ALLOW_SETS';

// Following are not field names, but they're used in the tree for 'properties' metadata and for buttons that create or delete a set
SeLiteSettings.SET_SELECTION_ROW= "SELITE_SET_SELECTION_ROW";
SeLiteSettings.FIELD_MAIN_ROW= "SELITE_FIELD_MAIN_ROW";
SeLiteSettings.FIELD_TREECHILDREN= "SELITE_FIELD_TREECHILDREN";
SeLiteSettings.NEW_VALUE_ROW= "SELITE_NEW_VALUE_ROW";
var ADD_VALUE= "SELITE_ADD_VALUE";
SeLiteSettings.OPTION_NOT_UNIQUE_CELL= "SELITE_OPTION_NOT_UNIQUE_CELL";
SeLiteSettings.OPTION_UNIQUE_CELL= "SELITE_OPTION_UNIQUE_CELL";

var SET_PRESENT= 'SELITE_SET_PRESENT'; // It indicates that the set is present, even if it doesn't define any values
/** It indicates that a choice (single or multi-valued) or a multi-valued field is present in a set, even if it's unselected or an empty array;
 *  then it's stored as a preference with the key being 'moduleName.setName.fieldName'
 *  without a trailing dot. Used both in preferences and in values manifest files.
 * @type String
 */
SeLiteSettings.VALUE_PRESENT= 'SELITE_VALUE_PRESENT';
/** It indicates that a single-valued field has value of null. Used in both preferences and values manifests.
 * */
SeLiteSettings.NULL= 'SELITE_NULL';
// Used as a part of Field values in 'values' manifest. It gets replaced with the full path to the manifest folder.
SeLiteSettings.SELITE_THIS_MANIFEST_FOLDER= 'SELITE_THIS_MANIFEST_FOLDER';

// Following are used to generate 'properties' in columns 'Set' and 'Manifest', when viewing fields per folder
SeLiteSettings.ASSOCIATED_SET= 'SELITE_ASSOCIATED_SET';
SeLiteSettings.DEFAULT_SET= 'SELITE_DEFAULT_SET';
SeLiteSettings.VALUES_MANIFEST= 'SELITE_VALUES_MANIFEST';
SeLiteSettings.FIELD_DEFAULT= 'SELITE_FIELD_DEFAULT';
SeLiteSettings.FIELD_NULL_OR_UNDEFINED= 'SELITE_FIELD_NULL_OR_UNDEFINED';
SeLiteSettings.SELITE_SET_OR_DEFINITION= 'SELITE_SET_OR_DEFINITION';

/** An array of strings that are reserved names. For internal use only.
 * */
SeLiteSettings.reservedNames= [
    SeLiteSettings.DEFAULT_SET_NAME,
    MODULE_DEFINITION_FILE_OR_URL,
    MODULE_DEFINITION_ALLOW_SETS,
    SeLiteSettings.SET_SELECTION_ROW,
    SeLiteSettings.FIELD_MAIN_ROW,
    SeLiteSettings.FIELD_TREECHILDREN,
    SeLiteSettings.NEW_VALUE_ROW,
    ADD_VALUE,
    SeLiteSettings.OPTION_NOT_UNIQUE_CELL,
    SeLiteSettings.OPTION_UNIQUE_CELL,
    SET_PRESENT, SeLiteSettings.VALUE_PRESENT,
    SeLiteSettings.ASSOCIATED_SET, SeLiteSettings.DEFAULT_SET, SeLiteSettings.VALUES_MANIFEST,
    SeLiteSettings.FIELD_DEFAULT, SeLiteSettings.FIELD_NULL_OR_UNDEFINED
];

var fieldNameRegex= /^[a-zA-Z0-9_/-]+$/;
var moduleNameRegex= /^[a-zA-Z0-9_/-][a-zA-Z0-9_/.-]*[a-zA-Z0-9_/-]$/;
/** Ensure that the name can be a preference module/set/field name. Module names can contain a dot
 *  but they can't start neither end with a dot, and they must be at least 2 characters long.
 *   Set/SeLiteSettings.Field names and multi-value field keys can't contain dots.
 *  @param name
 *  @param description String to describe what is being checked, if the check fails.
 *  @param {bool} [asModuleOrSetName] Whether to check as a module/set name; otherwise it's deemed to be a field or FixedMap key name. False by default.
 * */
function ensureFieldName( name, description, asModuleOrSetName ) {
    var regex= asModuleOrSetName
        ? moduleNameRegex
        : fieldNameRegex;
    if( !regex.test( name ) ) {
        throw new Error( 'SeLiteSettings expect ' +description+ ' to be a valid preference '
            +(asModuleOrSetName ? 'module or set name' : 'field name or FixedMap key')+ ', but "' +name+ '" was passed.');
    }
}

/** @param {string|SeLiteSettings.Field} fullNameOrField String, in form moduleName+fieldName, excluding any set; or a Field instance.
 *  @return SeLiteSettings.Field instance if present and if fullNameOrField is a string; fullNameOrField if it is a Field. It fails otherwise.
 * */
SeLiteSettings.getField= function getField( fullNameOrField ) {
    if( fullNameOrField instanceof SeLiteSettings.Field ) {
        return fullNameOrField;
    }
    SeLiteMisc.ensureType( fullNameOrField, 'string', 'fullNameOrField (if not an instance of SeLiteSettings.Field)' );
    var lastDotIndex= fullNameOrField.lastIndexOf( '.' );
    lastDotIndex>0 && lastDotIndex<fullNameOrField.length-1 || SeLiteMisc.fail('fullNameOrField does not contain a dot: ' +fullNameOrField );
    var moduleName= fullNameOrField.substring( 0, lastDotIndex );
    var fieldName= fullNameOrField.substring( lastDotIndex+1 );
    var module= SeLiteSettings.loadFromJavascript( moduleName );
    fieldName in module.fields || SeLiteMisc.fail( 'SeLiteSettings.Module ' +moduleName+ " doesn't contain field " +fieldName );
    return module.fields[fieldName];
};

/** @param string name Name of the field
 *  @param bool multivalued Whether the field is multivalued; false by default
 *  @param defaultKey mixed Default key. It is the default value(s) for fields other than SeLiteSettings.Field.Choice. For SeLiteSettings.Field.Choice it is the default key(s).
 *  Optional. Leave it undefined if you don't want a default key
 *  (then it won't be set and it will be inherited, if any). It can be null only for single-valued fields, then the default key is null.
 *  Otherwise, if the fiels is single valued, the default key should fit the particular type.
 *  If multivalued is true, it must be an array (potentially empty) or undefined; it can't be null.
 *  For multivalued fields, this can be an empty array, or an array of keys (i.e. stored values, rather than labels to display, which may not be the same for SeLiteSettings.Field.Choice).
 *  If a non-null and not undefined, then the value (or values) will be each checked by validateKey(value).
 *  <br/>defaultKey has effect only if no applicable set or 'values' manifest has a value for the field, and only if field's module has associatesWithFolders==true. That is done through getFieldsDownToFolder() and getDownToFolder().
 *  @param {bool} [allowNull=false] Whether this field allows null value; only applicable for fields other than multivalued choice.
 *  @param customValidate Function to perform custom validation. It takes
 *  - 1 parameter: 'key' (same as the value) for fields other than SeLiteSettings.Field.Choice
 *  - 2 parameters: 'key' and 'value' for SeLiteSettings.Field.Choice and its subclasses
 *  It returns boolean - true on success, false on failure. Optional.
 * */
SeLiteSettings.Field= function Field( name, multivalued, defaultKey, allowNull, customValidate ) {
    if( typeof name!=='string' ) {
        throw new Error( 'SeLiteSettings.Field() expects a string name ("primitive" string, not new String(..)).');
    }
    if( SeLiteSettings.reservedNames.indexOf(name)>=0 ) {
        throw new Error( 'SeLiteSettings.Field() reserves name "' +name+ '". Do not use that as a field name.');
    }
    loadingPackageDefinition || ensureFieldName( name, 'field name' );
    this.name= name;
    
    multivalued= multivalued || false;
    if( typeof multivalued!=='boolean') {
        throw new Error( 'SeLiteSettings.Field("' +name+ ') expects multivalued to be a boolean, if provided.');
    }
    this.multivalued= multivalued;
    !this.multivalued || defaultKey===undefined || Array.isArray(defaultKey)
        || typeof defaultKey==='object' && this instanceof SeLiteSettings.Field.FixedMap
        || SeLiteMisc.fail( "Multi valued field " +name+ " must have a default key: an array (possibly empty []), or an object for FixedMap, or undefined." );
    this.multivalued || defaultKey===undefined || defaultKey===null || typeof defaultKey!=='object' || SeLiteMisc.fail( 'Single valued field ' +name+ " must have default key a primitive or null.");
    this.defaultKey= defaultKey;
    this.allowNull= allowNull || false;
    SeLiteMisc.ensureType( this.allowNull, 'boolean', 'allowNull (if present)' );
    this.customValidate= customValidate || undefined;
    SeLiteMisc.ensureType( this.customValidate, ['function', 'undefined'], 'customValidate (if present)' );
    
    !(this.defaultKey===null && multivalued) || SeLiteMisc.fail( 'SeLiteSettings.Field ' +name+ " must have a non-null defaultKey (possibly undefined), because it's multivalued." );
    if( this.defaultKey!==undefined && this.defaultKey!==null ) {
        var defaultKeys= this.multivalued
            ? (this instanceof SeLiteSettings.Field.FixedMap
                ? SeLiteMisc.objectValues(this.defaultKey)
                : this.defaultKey
              )
            : [this.defaultKey];
        for( var i=0; i<defaultKeys.length; i++ ) {//@TODO use loop for(.. of..) once NetBeans supports it
            var key= defaultKeys[i];
            this.validateKey(key) // This is redundant for SeLiteSettings.Field.Choice, but that's OK
            && this.customValidateDefault(key)
            || SeLiteMisc.fail( 'Default key for '
                +(this.module ? 'module ' +this.module.name+ ', ' : '')
                +'field ' +this.name+ ' is ' +key+ " and that doesn't pass validation." );
        }
    }    
    
    if( !this.name.endsWith('.prototype') ) {
        if( this.constructor===SeLiteSettings.Field ) {
            throw new Error( "Can't instantiate SeLiteSettings.Field directly, except for prototype instances. name: " +this.name );
        }
        SeLiteMisc.ensureInstance(this, 
            [SeLiteSettings.Field.Bool, SeLiteSettings.Field.Int, SeLiteSettings.Field.Decimal, SeLiteSettings.Field.String, SeLiteSettings.Field.File, SeLiteSettings.Field.Folder, SeLiteSettings.Field.SQLite, SeLiteSettings.Field.Choice.Int, SeLiteSettings.Field.Choice.Decimal, SeLiteSettings.Field.Choice.String, SeLiteSettings.Field.FixedMap.String],
            "Instance being created, of non-standard direct subclass of SeLiteSettings.Field, with name '" +this.name );
    }
    loadingPackageDefinition || this.name.indexOf('.')<0 || SeLiteMisc.fail( 'SeLiteSettings.Field() expects name not to contain a dot, but it received: ' +this.name);
    this.module= null; // instance of Module that this belongs to (once registered)
};

/** Perform the custom validation on a default key.
 * */
SeLiteSettings.Field.prototype.customValidateDefault= function customValidateDefault( key ) {
    return true;
};
/** 'Abstract' class. It serves to separate behaviour between freetype/boolean and Choice fields.
 * */
SeLiteSettings.Field.NonChoice= function NonChoice( name, multivalued, defaultKey, allowNull, customValidate ) {
    SeLiteSettings.Field.call( this, name, multivalued, defaultKey, allowNull, customValidate );
};

SeLiteSettings.Field.NonChoice.prototype= new SeLiteSettings.Field('NonChoice.prototype');
SeLiteSettings.Field.NonChoice.prototype.constructor= SeLiteSettings.Field.NonChoice;

SeLiteSettings.Field.NonChoice.prototype.customValidateDefault= function customValidateDefault( key ) {
    return !this.customValidate || this.customValidate(key);
};

/** Return the default key, or a protective copy if it's an array.
 *  @return mixed
 * */
SeLiteSettings.Field.prototype.getDefaultKey= function getDefaultKey() {
    if( Array.isArray(this.defaultKey) ) {
        return this.defaultKey.slice();
    }
    return this.defaultKey;
};

/** Set (or override) a default key (or keys) for this field. Used e.g. by test frameworks to set the default key appropriate to the tested web app.
 *  @param {string|number|array} Key (or keys) to make default for this field.
 *  @param {boolean} dontReRegister If true, then this doesn't re-register the module.
 *  @returns {void}
 * */
SeLiteSettings.Field.prototype.setDefaultKey= function setDefaultKey( key, dontReRegister ) {
    this.module.defaultKeys[this.name]= key;
    this.defaultKey= key;
    if( !dontReRegister ) {
        this.module.register();
    }
};

SeLiteSettings.Field.prototype.toString= function toString() {
    return this.constructor.name+ '[module: ' +(this.module ? this.module.name : 'unknown')+ ', name: ' +this.name+ ']';
};

/** Trim a free-typed value. This is called before parse().
 *  Do not check for 'null' or 'undefined' - these are handled by ovOptions.js.
 *  @param key User-typed value
 *  @return trimmed value (or unchanged value of key)
 * */
SeLiteSettings.Field.prototype.trim= function trim( key ) { return key; };

/** Parse a free-typed value. Cast it as needed. This is called after the value went through trim().
 *  Do not check for 'null' or 'undefined' - these are handled by ovOptions.js.
 *  @param key User-typed value
 *  @return parsed/processed value
 * */
SeLiteSettings.Field.prototype.parse= function parse( key ) { return key; };

/** This validates a single value (i.e. other than undefined or null).
 *  If the field is an instance of SeLiteSettings.Field.Choice, this validates the value/label (not the key).
 *  Used for validation of values entered by the user for freetype/FileOrFolder fields (i.e. not SeLiteSettings.Field.Choice), and
 *  also for validation of default key(s) of any field (including SeLiteSettings.Field.Choice). Overriden as needed.
 *  @param key mixed string or number
 * */
SeLiteSettings.Field.prototype.validateKey= function validateKey( key ) {
    return typeof key==='string';
};

/** Used when sorting multivalued non-choice fields. By default we use
 *  case insensitive comparison for SeLiteSettings.Field.String numeric comparison for SeLiteSettings.Field.Number.
 *  @param string/number firstValue
 *  @param string/number secondValue
 *  @return int -1, 0, or 1, see SeLiteMisc.compareCaseInsensitively()
 * */
SeLiteSettings.Field.prototype.compareValues= function compareValues( firstValue, secondValue ) {
    return SeLiteMisc.compareCaseInsensitively( firstValue, secondValue );
};

SeLiteSettings.Field.prototype.registerFor= function registerFor( module ) {
    if( !(module instanceof SeLiteSettings.Module) ) {
        throw new Error( "SeLiteSettings.Field.registerFor(module) expects module to be an instance of SeLiteSettings.Module.");
    };
    if( this.module!==null ) {
        // Following checks whether the field was added via SeLiteSettings.Module.prototype.addField(field).
        // If so, then this is probably called from SeLiteSettings.loadFromJavascript( moduleName, moduleFileOrUrl, forceReload ) with forceLoad=true, so I allow it.
        if( !(this.module.name==module.name && this.name in this.module.addedFields) ) {
            throw new Error( "SeLiteSettings.Field.registerFor(module) expects 'this' SeLiteSettings.Field not to be registered yet, but field '" +this.name+ "' was registered already.");
        }
    }
    this.module= module;
};

/** Only used when creating new sets that populate default keys. See docs of parameter defaultKey of constructor SeLiteSettings.Field().
 * */
SeLiteSettings.Field.prototype.setDefault= function setDefault( setName ) {
    this.setValue( setName, this.defaultKey );
};
/** This returns the preference type used for storing legitimate non-null value(s) of this field.
 *  @return string one of: nsIPrefBranch.PREF_STRING, nsIPrefBranch.PREF_BOOL, nsIPrefBranch.PREF_INT
 * */
SeLiteSettings.Field.prototype.prefType= function prefType() {
    return nsIPrefBranch.PREF_STRING;
};
/** Set/update a value of a singlevalued non-choice field.
 * @public
 * @param setName string
 * @param value mixed; currently it must not be null or undefined - @TODO
 * */
SeLiteSettings.Field.prototype.setValue= function setValue( setName, value ) {
    !this.multivalued && !(this instanceof SeLiteSettings.Field.Choice) || SeLiteMisc.fail( "Can't call setValue() on field " +this.name+ " because it's multivalued or a SeLiteSettings.Field.Choice." );
    var setNameWithDot= setName!==''
        ? setName+'.'
        : '';
    var setFieldName= setNameWithDot+this.name;
    if( this.prefType()!==nsIPrefBranch.PREF_STRING && this.module.prefsBranch.prefHasUserValue(setFieldName)
        && this.module.prefsBranch.getPrefType(setFieldName)===nsIPrefBranch.PREF_STRING
    ) {
        var existingValue= this.module.prefsBranch.getCharPref(setFieldName);
        existingValue===SeLiteSettings.NULL || SeLiteMisc.fail("Non-string field " +this.name+ " has a string value other than 'SELITE_NULL': " +existingValue );
        this.module.prefsBranch.clearUserPref(setFieldName);
    }
    this.setPref( setFieldName, value );
};
/** Set a field (with the given field and key name) to the given value. It doesn't call nsIPrefService.savePrefFile()
 *  but they get saved somehow anyway.
 * */
SeLiteSettings.Field.prototype.setPref= function setPref( setFieldKeyName, value ) {
    var prefType= this.prefType();
    if( prefType===nsIPrefBranch.PREF_STRING ) {
        this.module.prefsBranch.setCharPref( setFieldKeyName, value );
    }
    else
    if( prefType===nsIPrefBranch.PREF_INT ) {
        this.module.prefsBranch.setIntPref( setFieldKeyName, value );
    }
    else {
        prefType===nsIPrefBranch.PREF_BOOL || SeLiteMisc.fail( "SeLiteSettings.Field " +setFieldKeyName+ " hasn't got acceptable prefType()." );
        this.module.prefsBranch.setBoolPref( setFieldKeyName, value );
    }
};

/** Only to be used with multivalued or choice fields.
 * @public
 * @param string setName May be empty.
 * @param mixed key as used to generate the preference name (key), appened after fieldName and a dot. String or number.
 * For non-choice multivalued fields it's also used as the value stored in preferences; and for Int
 * it transforms it into a number.
 * @param {boolean|number|string} value Only used by SeLiteSettings.Field.FixedMap. Otherwise it must be undefined.
 * @TODO Low priority: API function to set a multivalued/choice field to undefined
 * */
SeLiteSettings.Field.prototype.addValue= function addValue( setName, key, value ) {
    this.multivalued || this instanceof SeLiteSettings.Field.Choice || SeLiteMisc.fail("Use SeLiteSettings.Field.addValue() only for multivalued or choice fields.");
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( this instanceof SeLiteSettings.Field.FixedMap ) {//@TODO Why this check? I should allow undefined.
        value!==undefined || SeLiteMisc.fail( ''+this+ '.addValue() was called with key=' +key+ ' and value===undefined.' );
    }
    else {
        value= this instanceof SeLiteSettings.Field.Choice
            ? this.choicePairs[key]
            : key;
    }
    this.setPref( setNameDot+ this.name+ '.' +key, value );
};
/** Only to be used with multivalued or choice fields. If the key was not set, then this returns without failing.
 * It doesn't call nsIPrefService.savePrefFile().
 * @param string setName May be empty.
 * @param mixed key as used to generate the preference name (key), appened after fieldName and a dot. String or number.
 * */
SeLiteSettings.Field.prototype.removeValue= function removeValue( setName, key ) {
    this.multivalued || this instanceof SeLiteSettings.Field.Choice || SeLiteMisc.fail();
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( !this.multivalued && !(this instanceof SeLiteSettings.Field.Choice) ) {
        throw new Error( "Use SeLiteSettings.Field.removeValue() only for multivalued or choice fields." );
    }
    if( this.module.prefsBranch.prefHasUserValue(setNameDot+this.name+ '.' +key) ) {
        this.module.prefsBranch.clearUserPref( setNameDot+this.name+ '.' +key);
    }
};

/** @return bool Whether field definition equals to the other field. This doesn't compare their module names.
 * */
SeLiteSettings.Field.prototype.equals= function equals( other ) {
    return this.name===other.name
        && this.constructor===other.constructor
        && (!this.multivalued
            ? this.defaultKey===other.defaultKey // Strict comparison is OK for primitive string/bool/int
            : SeLiteMisc.compareArrays(this.defaultKey, other.defaultKey, true)
           );
};

/** Just a shortcut function. It returns a slice of what module.getFieldsDownToFolder() returns. It has same parameters, too.
 *  @param folderPath string, optional
 *  @param boolean dontCache, optional
 *  @param {bool} [includeUndeclaredEntries] See same parameter of SeLiteSettings.Module.prototype.getFieldsOfSet().
 *  @return object {
            entry: mixed,
            fromPreferences: boolean,
            folderPath: string or undefined,
            setName: string or undefined
    }
    @see SeLiteSettings.Module.getFieldsDownToFolder()
 * */
SeLiteSettings.Field.prototype.getDownToFolder= function getDownToFolder( folderPath, dontCache, includeUndeclaredEntries ) {
    return this.module.getFieldsDownToFolder( folderPath, dontCache, includeUndeclaredEntries )[ this.name ];
};

// @TODO Move this line to Javascript.wiki?: See also https://developer.mozilla.org/en/Introduction_to_Object-Oriented_JavaScript#Inheritance
/** There's no parameter 'customValidate' for Bool.
 * */
SeLiteSettings.Field.Bool= function Bool( name, defaultKey, allowNull ) {
    SeLiteSettings.Field.NonChoice.call( this, name, false, defaultKey, allowNull );
};
SeLiteSettings.Field.Bool.prototype= new SeLiteSettings.Field.NonChoice('Bool.prototype');
SeLiteSettings.Field.Bool.prototype.constructor= SeLiteSettings.Field.Bool;
SeLiteSettings.Field.Bool.prototype.parse= function parse( key ) {
    return key==='true'; // Do not use Boolean(key), because Boolean('false')===true!
}
SeLiteSettings.Field.Bool.prototype.validateKey= function validateKey( key ) {
    return typeof key==='boolean';
};
SeLiteSettings.Field.Bool.prototype.prefType= function prefType() {
    return nsIPrefBranch.PREF_BOOL;
};

SeLiteSettings.Field.Int= function Int( name, multivalued, defaultKey, allowNull, customValidate ) {
    SeLiteSettings.Field.NonChoice.call( this, name, multivalued, defaultKey, allowNull, customValidate );
};
SeLiteSettings.Field.Int.prototype= new SeLiteSettings.Field.NonChoice('Int.prototype');
SeLiteSettings.Field.Int.prototype.constructor= SeLiteSettings.Field.Int;
SeLiteSettings.Field.Int.prototype.trim= function trim( key ) { return key.trim(); };
SeLiteSettings.Field.Int.prototype.parse= function parse( key ) {
    return key!==''
        ? Number(key)
        : Number.NaN; // Number('') or Number(' ') etc. returns 0 - not good for validation!
};
SeLiteSettings.Field.Int.prototype.validateKey= function validateKey( key ) {
    return typeof key==='number' && Math.round(key)===key; // This also handles (fails for) NaN, since Number.NaN!==Number.NaN
};
SeLiteSettings.Field.Int.prototype.prefType= function prefType() {
    return nsIPrefBranch.PREF_INT;
};
/** This works even if one or both parameters are strings - it transforms them into numbers.
 *  We need this for XUL GUI setCellText handler.
 * */
SeLiteSettings.Field.Int.prototype.compareValues= function compareValues( firstValue, secondValue ) {
    return SeLiteMisc.compareAsNumbers(firstValue, secondValue );
};

SeLiteSettings.Field.Decimal= function Decimal( name, multivalued, defaultKey, allowNull, customValidate ) {
    SeLiteSettings.Field.NonChoice.call( this, name, multivalued, defaultKey, allowNull, customValidate );
};
SeLiteSettings.Field.Decimal.prototype= new SeLiteSettings.Field.NonChoice('Decimal.prototype');
SeLiteSettings.Field.Decimal.prototype.constructor= SeLiteSettings.Field.Decimal;
SeLiteSettings.Field.Decimal.prototype.trim= SeLiteSettings.Field.Int.prototype.trim;
SeLiteSettings.Field.Decimal.prototype.parse= SeLiteSettings.Field.Int.prototype.parse;
SeLiteSettings.Field.Decimal.prototype.validateKey= function validateKey( key ) {
    return typeof key==='number' && !isNaN(key);
};
SeLiteSettings.Field.Decimal.prototype.prefType= function prefType() {
    return nsIPrefBranch.PREF_STRING;
};
/** This works even if one or both parameters are strings - it transforms them into numbers.
 *  We need this for XUL GUI setCellText handler.
 * */
SeLiteSettings.Field.Decimal.prototype.compareValues= function compareValues( firstValue, secondValue ) {
    return SeLiteMisc.compareAsNumbers(firstValue, secondValue );
};

SeLiteSettings.Field.String= function String( name, multivalued, defaultKey, allowNull, customValidate ) {
    SeLiteSettings.Field.NonChoice.call( this, name, multivalued, defaultKey, allowNull, customValidate );
};
SeLiteSettings.Field.String.prototype= new SeLiteSettings.Field.NonChoice('String.prototype');
SeLiteSettings.Field.String.prototype.constructor= SeLiteSettings.Field.String;

/** @param string name
 *  @param filters Optional, an object serving as an associative array of file filters { 'visible filter name': '*.extension; *.anotherExtension...', ... }
 *  A false/null/0 key or value mean 'All files'.
 *  See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFilePicker#appendFilter%28%29
 *  @param defaultKey
 *  @param bool multivalued
 *  @param bool isFolder Whether this is for folder(s); otherwise it's for file(s)
 *  @param customValidate
 *  @param saveFile Whether we're saving/creating a file, otherwise we're opening/reading. Optional, false by default.
    Only needed when isFolder is false, because the file/folder picker dialog always lets you create new folder (if you have access).
 * */
SeLiteSettings.Field.FileOrFolder= function FileOrFolder( name, filters, multivalued, defaultKey, isFolder, allowNull, customValidate, saveFile ) {
    SeLiteSettings.Field.NonChoice.call( this, name, multivalued, defaultKey, allowNull, customValidate );
    this.filters= filters || {};
    typeof(this.filters)==='object' && !Array.isArray(this.filters) || SeLiteMisc.fail( 'SeLiteSettings.Field.FileOrFolder() expects filters to be an object (not an array) serving as an associative array, if provided.');
    this.isFolder= isFolder || false;
    SeLiteMisc.ensureType( this.isFolder, 'boolean', "isFolder (if provided)" );
    this.saveFile= saveFile || false;
    SeLiteMisc.ensureType( this.saveFile, 'boolean', "saveFile (if provided)" );
}
SeLiteSettings.Field.FileOrFolder.prototype= new SeLiteSettings.Field.NonChoice('FileOrFolder.prototype');
SeLiteSettings.Field.FileOrFolder.prototype.constructor= SeLiteSettings.Field.FileOrFolder;

SeLiteSettings.Field.FileOrFolder.prototype.parentEquals= SeLiteSettings.Field.prototype.equals;
SeLiteSettings.Field.FileOrFolder.prototype.equals= function equals( other ) {
    if( !this.parentEquals(other)
    || this.isFolder!==other.isFolder ) {
        return false;
    }
    if( !SeLiteMisc.compareAllFields(this.filters, other.filters, true) ) {
        return false;
    }
    return true;
};

/** @param string name
 *  @param filters See SeLiteSettings.Field.FileOrFolder()
 * */
SeLiteSettings.Field.File= function File( name, filters, multivalued, defaultKey, allowNull, customValidate, saveFile ) {
    SeLiteSettings.Field.FileOrFolder.call( this, name, filters, multivalued, defaultKey, false, allowNull, customValidate, saveFile );
};
SeLiteSettings.Field.File.prototype= new SeLiteSettings.Field.FileOrFolder('File.prototype');
SeLiteSettings.Field.File.prototype.constructor= SeLiteSettings.Field.File;

/** @param string name
 *  @param filters See SeLiteSettings.Field.FileOrFolder()
 * */
SeLiteSettings.Field.Folder= function Folder( name, filters, multivalued, defaultKey, allowNull, customValidate ) {
    SeLiteSettings.Field.FileOrFolder.call( this, name, filters, multivalued, defaultKey, true, allowNull, customValidate, false );
};
SeLiteSettings.Field.Folder.prototype= new SeLiteSettings.Field.FileOrFolder('Folder.prototype');
SeLiteSettings.Field.Folder.prototype.constructor= SeLiteSettings.Field.Folder;

/** It can only be single-valued. An SQLite DB cannot span across multiple files (or if it can, I'm not supporting that).
 * */
SeLiteSettings.Field.SQLite= function SQLite( name, defaultKey, allowNull, customValidate, saveFile ) {
    // I match '*.sqlite*' rather than just '*.sqlite', because Drupal 7 adds DB prefix name to the end of the file name
    SeLiteSettings.Field.File.call( this, name, { 'SQLite': '*.sqlite*', 'Any': null}, false, defaultKey, allowNull, customValidate, saveFile );
};
SeLiteSettings.Field.SQLite.prototype= new SeLiteSettings.Field.File('SQLite.prototype', {}, false, '' );
SeLiteSettings.Field.SQLite.prototype.constructor= SeLiteSettings.Field.SQLite;

/** @param defaultKey It's actually a key, not the visible integer/string value.
 *  If multivalued, then it's an array of key(s).
 *  @param choicePairs Anonymous object serving as an associative array {
 *      string key => string/number value ('label')
 *  } It's not clear what is more intuitive here. However, with this format, the type and positioning of
 *  label reflects how it is shown when using Firefox url about:config.
 *  Also, Javascript transforms object field/key names to strings, even if they were set to number/boolean.
 * */
SeLiteSettings.Field.Choice= function Choice( name, multivalued, defaultKey, choicePairs, allowNull, customValidate ) {
    this.choicePairs= choicePairs || {}; // This is set before I call the parent constructor, so that it can validate defaultKey against this.choicePairs
    !multivalued || !allowNull || SeLiteMisc.fail( "SeLiteSettings.Field.Choice can't be multivalued and allow null." );
    SeLiteSettings.Field.call( this, name, multivalued, defaultKey, allowNull, customValidate );
    loadingPackageDefinition || this.constructor!==SeLiteSettings.Field.Choice
        || SeLiteMisc.fail( "Can't define instances of SeLiteSettings.Field.Choice class itself outside the package. Use SeLiteSettings.Field.Choice.Int, SeLiteSettings.Field.Choice.Decimal or SeLiteSettings.Field.Choice.String." );
    loadingPackageDefinition || typeof(choicePairs)==='object' && !Array.isArray(choicePairs)
        || SeLiteMisc.fail( "Instances of subclasses of SeLiteSettings.Field.Choice require choicePairs to be an anonymous object serving as an associative array." );
    for( var key in this.choicePairs ) {
        var value= this.choicePairs[key];
        if( !this.validateValue(value) || this.customValidate && !this.customValidate(key, value) ) {
            SeLiteMisc.fail( 'SeLiteSettings.Field.Choice.XXXX ' +name+ ' has a choice {' +key+ ': ' +value
                + ' (' +(typeof value)+ ') } which fails validation' );
        }
    }
    if( defaultKey!==undefined ) {
        !(multivalued && defaultKey===null) || SeLiteMisc.fail( "SeLiteSettings.Field.Choice.XX with name " +name+ " can't have defaultKey null, because it's multivalued." );
        multivalued===Array.isArray(defaultKey) || SeLiteMisc.fail( "SeLiteSettings.Field.Choice.XX with name " +name+ " must have defaultKey an array if and only if it's multivalued." );
        var defaultKeys= multivalued
            ? defaultKey
            : [defaultKey];
        for( var i=0; i<defaultKeys.length; i++ ) { //@TODO for..of.. loop once NetBeans support it
            defaultKeys[i] in choicePairs || SeLiteMisc.fail( "SeLiteSettings.Field.Choice " +name+ " has defaultKey " +defaultKeys[i]+ ", which is not among keys of its choicePairs." );
        }
    }
};
SeLiteSettings.Field.Choice.prototype= new SeLiteSettings.Field('Choice.prototype');
SeLiteSettings.Field.Choice.prototype.constructor= SeLiteSettings.Field.Choice;
SeLiteSettings.Field.Choice.prototype.compareValues= function compareValues() {
    throw new Error( 'Do not use SeLiteSettings.Field.Choice.compareValues(). Sort choicePairs yourself.');
};
SeLiteSettings.Field.Choice.prototype.setDefault= function setDefault() {
    throw new Error("Do not call setDefault() on SeLiteSettings.Field.Choice family.");
};
SeLiteSettings.Field.Choice.prototype.setValue= function setValue() {
    throw new Error("Do not call setValue() on SeLiteSettings.Field.Choice family.");
};
/** It requires the key to be
 *  - among keys in this.choicePairs
 *  - a string or a number
 *  */
SeLiteSettings.Field.Choice.prototype.validateKey= function validateKey( key ) {
    return SeLiteMisc.oneOf( typeof key, ['string', 'number']) && key in this.choicePairs;
};

/** Validate a value. Only present for SeLiteSettings.Field.Choice (and subclasses).
 * */
SeLiteSettings.Field.Choice.prototype.validateValue= function validateValue( value ) {
    return SeLiteMisc.oneOf( typeof value, ['string', 'number']);
};

SeLiteSettings.Field.Choice.Int= function Int( name, multivalued, defaultKey, choicePairs, allowNull, customValidate ) {
    SeLiteSettings.Field.Choice.call( this, name, multivalued, defaultKey, choicePairs, allowNull, customValidate );
};
SeLiteSettings.Field.Choice.Int.prototype= new SeLiteSettings.Field.Choice('ChoiceInt.prototype');
SeLiteSettings.Field.Choice.Int.prototype.constructor= SeLiteSettings.Field.Choice.Int;
SeLiteSettings.Field.Choice.Int.prototype.trim= SeLiteSettings.Field.Int.prototype.trim;
SeLiteSettings.Field.Choice.Int.prototype.parse= SeLiteSettings.Field.Int.prototype.parse;
SeLiteSettings.Field.Choice.Int.prototype.prefType= SeLiteSettings.Field.Int.prototype.prefType;
SeLiteSettings.Field.Choice.Int.prototype.validateValue= function validateValue( value ) {
    return typeof value==='number' && Math.round(value)===value;
};

SeLiteSettings.Field.Choice.Decimal= function Decimal( name, multivalued, defaultKey, choicePairs, allowNull, customValidate ) {
    SeLiteSettings.Field.Choice.call( this, name, multivalued, defaultKey, choicePairs, allowNull, customValidate );
};
SeLiteSettings.Field.Choice.Decimal.prototype= new SeLiteSettings.Field.Choice('ChoiceDecimal.prototype');
SeLiteSettings.Field.Choice.Decimal.prototype.constructor= SeLiteSettings.Field.Choice.Decimal;
SeLiteSettings.Field.Choice.Decimal.prototype.trim= SeLiteSettings.Field.Decimal.prototype.trim;
SeLiteSettings.Field.Choice.Decimal.prototype.parse= SeLiteSettings.Field.Decimal.prototype.parse;
SeLiteSettings.Field.Choice.Decimal.prototype.prefType= SeLiteSettings.Field.Decimal.prototype.prefType;
SeLiteSettings.Field.Choice.Decimal.prototype.validateValue= function validateValue( value ) {
    return typeof value==='number' && !isNaN(value);
};

SeLiteSettings.Field.Choice.String= function String( name, multivalued, defaultKey, choicePairs, allowNull, customValidate ) {
    SeLiteSettings.Field.Choice.call( this, name, multivalued, defaultKey, choicePairs, allowNull, customValidate );
    for( var key in this.choicePairs ) {
        var value= this.choicePairs[key];
        if( !SeLiteMisc.oneOf( typeof value, ['string', 'number']) ) {
            throw new Error( 'SeLiteSettings.Field.Choice.String() for '
                +(this.module ? 'module ' +this.module.name+', ' : '')+ 'field ' +this.name
                +' expects values in choicePairs to be strings (or integers), but for key ' +key
                +' it has ' +(typeof value)+ ': ' +value );
        }
    }
};
SeLiteSettings.Field.Choice.String.prototype= new SeLiteSettings.Field.Choice('ChoiceString.prototype');
SeLiteSettings.Field.Choice.String.prototype.constructor= SeLiteSettings.Field.Choice.String;

/** This represents a freetype map with a fixed keyset. This is an abstract class, serving as a parent.
 *  @param {string} name
 *  @param {(string|number)[]} [keySet] We only allow strings, or numbers, because they're stored as strings (as a part of preference names). keySet specifically can't contain Javascript expression undefined, since updateSpecial() depends on that. Numbers get transformed to strings. It's optional, because test frameworks can add keys later via addKeys().
 *  @param {object} [defaultMappings]
 *  @param {function} customValidate
 * */
SeLiteSettings.Field.FixedMap= function FixedMap( name, keySet, defaultMappings, customValidate ) {
    loadingPackageDefinition || this.constructor!==SeLiteSettings.Field.FixedMap
        || SeLiteMisc.fail( "Can't define instances of SeLiteSettings.Field.FixedMap class itself outside the package. Use SeLiteSettings.Field.FixedMap.Bool, SeLiteSettings.Field.FixedMap.Int, SeLiteSettings.Field.FixedMap.Decimal or SeLiteSettings.Field.FixedMap.String." );
    defaultMappings= defaultMappings || {};
    SeLiteSettings.Field.NonChoice.call( this, name, /*multivalued*/true, defaultMappings, /*allowNull*/false, customValidate );
    keySet= keySet || [];
    this.keySet= keySet.slice(); // protective copy
    for( var i=0; i<this.keySet.length; i++ ) {
        var key= this.keySet[i];
        SeLiteMisc.ensureType( key, ['string', 'number'], 'keySet[' +i+ ']' );
        ensureFieldName(key);
        this.keySet[i]= ''+key;
    }
    for( var key in defaultMappings ) {
        var value= defaultMappings[key];
        this.keySet.indexOf( key )>=0 || SeLiteMisc.fail( ''+this+ ' has key ' +key+ ' in defaultMappings, which is not from its keySet.' );
        // @TODO more custom validation - decimal vs int
        if( !SeLiteMisc.oneOf( typeof value, ['string', 'number', 'boolean']) ) {
            throw new Error( 'SeLiteSettings.Field.FixedMap.String() for '
                +(this.module ? 'module ' +this.module.name+', ' : '')+ 'field ' +this.name
                +' expects values in keySet to be strings (or integers), but for key ' +key
                +' it has ' +(typeof value)+ ': ' +value );
        }
    }
};
SeLiteSettings.Field.FixedMap.prototype= new SeLiteSettings.Field.NonChoice('FixedMap.prototype');
SeLiteSettings.Field.FixedMap.prototype.constructor= SeLiteSettings.Field.FixedMap;
/** Add a key to an existing field 'on the fly'. All such added keys will be re-added when you call SeLiteSettings.loadFromJavascript( moduleName, moduleFileOrUrl, forceReload ) with forceReload=true (but the source code/definition of those added keys won't be re-read automatically). Do not call this from the file that defines this configuration module, otherwise this addKey() fails if the file is re-loaded.
 *  @param {(string|number)} key
 *  @param {(string|number|boolean)} [defaultValue]
 *  @param {boolean} dontReRegister If true, then this doesn't re-register the module.
 *  @returns {void}
 * */
SeLiteSettings.Field.FixedMap.prototype.addKey= function addKey( key, defaultValue, dontReRegister ) {
    if( !this.module.addedKeys[this.name] ) {
        this.module.addedKeys[this.name]= {};
    }
    SeLiteMisc.ensureType( key, ['string', 'number'], 'key' );
    ensureFieldName(key);
    this.keySet.push( key );
    if( defaultValue!==undefined ) {
        this.defaultKey[ key ]= defaultValue;
    }
    this.module.addedKeys[this.name][key]= defaultValue;
    if( !dontReRegister ) {
        this.module.register();
    }
};
/** Add keys to an existing field. See addKey().
 *  @param {object|Array} keys Either object { string|number key => string|number|boolean|undefined defaultValue... }
 *  or array [string key...]. If passing an array, there won't be any default values for those keys.
 *  @param {boolean} dontReRegister If true, then this doesn't re-register the module.
 * */
SeLiteSettings.Field.FixedMap.prototype.addKeys= function addKeys( keys, dontReRegister ) {
    if( Array.isArray(keys) ) {
        for( var i=0; i<keys.length; i++ ) { //@TODO for(..of..)
            this.addKey( keys[i], undefined, true );
        }
    }
    else {
        for( var key in keys ) {
            this.addKey( key, keys[key], true );
        }
    }
    if( !dontReRegister ) {
        this.module.register();
    }
};

SeLiteSettings.Field.FixedMap.String= function String( name, keySet, defaultMappings, customValidate ) {
    SeLiteSettings.Field.FixedMap.call( this, name, keySet, defaultMappings, customValidate );
};
SeLiteSettings.Field.FixedMap.String.prototype= new SeLiteSettings.Field.FixedMap('FixedMapString.prototype', [], {});
SeLiteSettings.Field.FixedMap.String.prototype.constructor= SeLiteSettings.Field.FixedMap.String;

/** @constructor It loads to memory and then inserts/updates what should be preserved in the test DB when it gets reloaded.
 * It keeps the data in memory in any way (e.g. in an instance field) - there should be just one instance of it at any time.
 * However, load() should clear that memory, to remove any data from previous calls.
 *  */
SeLiteSettings.TestDbKeeper= function TestDbKeeper() {};

/** Insert/update any relevant test data from memory to testStorage
 *  @param {SeLiteData.Storage} testStorage
 * */
SeLiteSettings.TestDbKeeper.prototype.initialise= function initialise( testStorage ) {
    /** @var {SeLiteData.Storage} */
    this.testStorage= testStorage;
    this.db= new SeLiteData.Db( this.testStorage );
};
/** Load any relevant test data from testStorage to memory. It must be robust - there may not be any test DB yet, or with an out of date schema.
 * */
SeLiteSettings.TestDbKeeper.prototype.load= function load() {};
/** Update any relevant test data from memory to testStorage. For records that don't exist there, this may re-create them (up to the implementation).
 * */
SeLiteSettings.TestDbKeeper.prototype.store= function store() {};

/** @constructor
 *  @augments  SeLiteSettings.TestDbKeeper
 * Simple implementation of SeLiteSettings.TestDbKeeper. It loads all data (the given columns)
 *  from test DB. Then after test DB is reloaded from vanilla or app DB, it updates all given columns
 *  on matching records. It doesn't re-create any missing records - if a record existing in test DB before the reload but it doesn't exist in the reloaded data, it won't get re-created.
 *  @param {object} description Object serving as an associative array {
 *  string table name (excluding the prefix): object {
       key: string column name that serves as a matching key; values of this key must be unique across all records
       columns: array of string column(s) to preserve; columns[] must include the matching key
       defaults: optional, object containing default values used when copying records that exist in the source (app/vanilla) DB but didn't exist in the test DB. {
           columnNameX: defaultValueX...
       }
       Any column name present in 'defaults' must be also present in 'columns'.
 *  }
 * */
SeLiteSettings.TestDbKeeper.Columns= function Columns( description ) {
    SeLiteSettings.TestDbKeeper.call( this );
    typeof description==='object' || SeLiteMisc.fail();
    this.description= description;
    for( var tableName in description ) {
        var tableDetails= description[tableName];
        SeLiteMisc.ensureType( tableDetails.key, 'string', 'description[' +tableName+ '].key' );
        SeLiteMisc.ensureInstance( tableDetails.columnsToPreserve, Array, 'description[' +tableName+ '].columnsToPreserve' );
        tableDetails.columnsToPreserve.indexOf(tableDetails.key)<0 || SeLiteMisc.fail( 'SeLiteSettings.TestDbKeeper.Columns() needs sub-parameter columnsToPreserve for table ' +tableName+ ' not to contain the key ' +tableDetails.key );
    }
    this.data= {};
};

SeLiteSettings.TestDbKeeper.Columns.prototype= new SeLiteSettings.TestDbKeeper();
SeLiteSettings.TestDbKeeper.Columns.prototype.constructor= SeLiteSettings.TestDbKeeper.Columns;

/**  @param {SeLiteData.Storage} testStorage
 */
SeLiteSettings.TestDbKeeper.Columns.prototype.initialise= function initialise( testStorage ) {
    SeLiteSettings.TestDbKeeper.prototype.initialise.call( this, testStorage );
    this.formulas= {}; // string tableName => SeLiteData.RecordSetFormula
    for( var tableName in this.description ) {
        var tableDetails= this.description[tableName];
        var columns= tableDetails.columnsToPreserve.slice(); // protective copy
        columns.push( tableDetails.key );
        var table= new SeLiteData.Table( {
            db: this.db,
            name: tableName,
            columns: columns,
        });
        this.formulas[ tableName ]= new SeLiteData.RecordSetFormula( {
            table: table,
            columns: new SeLiteData.Settable().set( tableName, columns ),
            indexBy: tableDetails.key,
            indexUnique: true
        });
    }
};
SeLiteSettings.TestDbKeeper.Columns.prototype.load= function load() {
    if( !this.testStorage.connection() ) {
        console.log( 'Test DB not present or not connected ' );
        return;
    }
    for( var tableName in this.formulas ) {
        var formula= this.formulas[tableName];
        this.data[tableName]= {}; // indexByValue => object record
        try { 
            // I must pass 2nd parameter (fields), otherwise it tries to collect them from the query and
            // it fails since the query uses star *. @TODO use Mozilla tableExists()
            this.testStorage.select( 'SELECT count(*) AS num FROM ' +formula.table.nameWithPrefix(), {}, ['num'] );
        }
        catch( e ) {// The table may not exist in this.testStorage (yet). If it doesn't, then we just skip it.
            console.log( 'SeLiteSettings.TestDbKeeper.Columns failed to select from test table ' +tableName+ ':\n' +e+ '\n' +e.stack );
            continue;
        }
        try { 
            this.data[ tableName ]= formula.select();
        }
        catch( e ) {// The table may be out of date - then log it and skip it
            console.log( e ); //@TODO better logging
        }
    }
};
SeLiteSettings.TestDbKeeper.Columns.prototype.store= function store() {
    for( var tableName in this.formulas ) {
        var formula= this.formulas[tableName];
        var tableNameWithPrefix= formula.table.nameWithPrefix();
        try { // The table may not exist in this.testStorage (anymore). If it doesn't, then we just skip it.
            this.testStorage.select( 'SELECT count(*) AS num FROM ' +tableNameWithPrefix, {}, ['num'] ); //@TODO Use Mozilla's tableExists()
        }
        catch( e ) {
            console.log( 'SeLiteSettings.TestDbKeeper.Columns failed to select from test table ' +tableNameWithPrefix+ ':\n' +e+ '\n' +e.stack );
            continue;
        }
        try {
            var reloadedData= this.formulas[ tableName ].select();
            var tableDetails= this.description[tableName];
            for( var keyValue in reloadedData ) {
                if( this.data[tableName] && keyValue in this.data[tableName] || tableDetails.defaults && Object.keys(tableDetails.defaults).length>0 ) {
                    var updateParts= [];
                    var bindings= {};
                    var originals= {}; // Original values that I'm replacing. For logging only.
                    // @TODO I could have two queries, one for each of the following if/else branch, and re-use them
                    if( this.data[tableName] && keyValue in this.data[tableName] ) { // Restore the original values as they were in test DB
                        for( var i=0; i<tableDetails.columnsToPreserve.length; i++ ) {// @TODO for(..of..)
                            var column= tableDetails.columnsToPreserve[i];
                            var oldValue= this.data[ tableName ][ keyValue ][ column ];
                            updateParts.push( column+ '=:' +column );
                            bindings[ column ]= oldValue;
                            originals[ column ]= reloadedData[ keyValue ][ column ];
                        }
                        console.debug( 'Updating ' +tableName+ ', record with ' +tableDetails.key+ '=' +keyValue+'. Replacing ' +SeLiteMisc.objectToString(originals, 2)+ ' with preserved test values ' +SeLiteMisc.objectToString(bindings, 2) );
                    }
                    else { // Initiate values of fields listed in columnsToPreserve to their defaults (if any specified)
                        for( var column in tableDetails.defaults ) {
                            tableDetails.columnsToPreserve.indexOf(column)>=0 || SeLiteMisc.fail( 'Column "' +column+ '" is in "defaults", but it is not in "columnsToPreserve".' );
                            updateParts.push( column+ '=:' +column );
                            bindings[ column ]= tableDetails.defaults[column];
                            originals[ column ]= reloadedData[ keyValue ][ column ];
                        }
                        console.debug( 'Updating ' +tableName+ ', record with ' +tableDetails.key+ '=' +keyValue+'. Replacing ' +SeLiteMisc.objectToString(originals, 2)+ ' with default test values ' +SeLiteMisc.objectToString(bindings, 2) );
                    }
                    var query= "UPDATE " +tableNameWithPrefix+ " SET " +updateParts.join(', ')+ ' WHERE ' +tableDetails.key+ '=:' +tableDetails.key;
                    console.debug( query );
                    bindings[ tableDetails.key ]= keyValue;
                    this.testStorage.execute( query, bindings );
                }
            }
        }
        catch( e ) {// The (old test) table may be out of date (incompatible with the new test table) - then log it and skip it
            console.log( ''+e+'\n'+e.stack ); //@TODO better logging
            throw e; //@TODO
        }
    }
};

/** @constructor Create a Settings module.
 *  In addition to the given parameters, a module can have field testDbKeeper. If present, it's not set from here, but through SeLiteSettings.setTestDbKeeper().
 *  @param name string Name prefix for preferences/fields for this module.
 *  As per Mozilla standard, it should be dot-separated and start with 'extensions.' See Firefox url about:config.
 *  @param fields Array of SeLiteSettings.Field objects, in the order how they will be displayed.
 *  Beware: this.fields will not be an array, but an object serving as an associative array { string field name => SeLiteSettings.Field object}
 *  @param allowSets bool Whether to allow multiple sets of settings for this module
 *  @param defaultSetNameValue string Name of the default set. Optional, null by default; only allowed (but not required) if allowSets==true
 *  @param associatesWithFolders bool Whether the sets are to be used with folder paths (and manifest files in them)
 *  @param {string} [definitionJavascriptFile] URL or filepath to the filename (including the extension) of a javascript file which contains a 
 *  definition of this module. Optional; if present, it lets SeLiteSettings to load a definition automatically
 *  by clients that only know the module name but not location of the file.
 *  If not set and the module has been already registered, then it stays unchanged (in the preference).
 *  Required if you want to register a brand new module; not needed if re-registering (upgrading) an already registered module.
 *  @param {boolean} [dontRegister] Whether not to (re)register this module; by default it's false (i.e. do register).
 * */
SeLiteSettings.Module= function Module( name, fields, allowSets, defaultSetNameValue, associatesWithFolders, definitionJavascriptFile, dontRegister ) {
    this.name= name;
    if( typeof this.name!='string' ) {
        throw new Error( 'SeLiteSettings.Module() expects a string name.');
    }
    ensureFieldName( name, 'module name', true );
    Array.isArray(fields) || SeLiteMisc.fail( 'SeLiteSettings.Module() expects an array fields, but it received ' +(typeof fields)+ ' - ' +fields);
    this.fields= SeLiteMisc.sortedObject(true); // Object serving as an associative array { string field name => SeLiteSettings.Field instance }
    for( var i=0; i<fields.length; i++ ) {
        var field= fields[i];
        if( !(field instanceof SeLiteSettings.Field) ) {
            throw new Error( 'SeLiteSettings.Module() expects fields to be an array of SeLiteSettings.Field instances, but item [' +i+ '] is not.');
        }
        if( field.name in this.fields ) {
            throw new Error( 'SeLiteSettings.Module() for module name "' +name+ '" has two (or more) fields with same name "' +field.name+ '".');
        }
        field.registerFor( this );
        this.fields[ field.name ]= field;
    }
    
    this.allowSets= allowSets || false;
    if( typeof this.allowSets!='boolean' ) {
        throw new Error( 'SeLiteSettings.Module() expects allowSets to be a boolean, if provided.');
    }
    this.defaultSetNameValue= defaultSetNameValue || null;
    if( this.defaultSetNameValue!=null && typeof this.defaultSetNameValue!='string' ) {
        throw new Error( 'SeLiteSettings.Module() expects defaultSetNameValue to be a string, if provided.');
    }
    if( this.defaultSetName!=null && !this.allowSets ) {
        throw new Error( 'SeLiteSettings.Module() allows optional parameter defaultSetName only if allowSets is true..');
    }
    defaultSetNameValue===null || ensureFieldName( defaultSetNameValue, 'defaultSetNameValue', true );
    
    this.associatesWithFolders= associatesWithFolders || false;
    SeLiteMisc.ensureType( this.associatesWithFolders, 'boolean', 'associatesWithFolders (if provided)' );
    
    this.definitionJavascriptFile= definitionJavascriptFile;
    if( this.definitionJavascriptFile!==undefined && typeof this.definitionJavascriptFile!=='string') {
        throw new Error( 'SeLiteSettings.Module() expects definitionJavascriptFile to be a string, if provided.');
    }
    
    this.prefsBranch= prefs.getBranch( this.name+'.' );
    /** @type {object} {string field name => Field object } for fields added via addField(field). */
    this.addedFields= {};
    /** @type {object} { string field name => object {key name => default value...}... } for SeLiteSettings.Field.FixedMap instances that have keys added via addKey(key, defaultValue) or addKeys(keys, dontReRegister). */
    this.addedKeys= {};
    /** @type {object} {string field name => Field object } for fields removed via removeField(fieldOrName). */
    this.removedFields= {};
    /** @type {object} { string field name => string default value } for SeLiteSettings.Field instances that have default values set (overriden) via setDefaultKey(key).
     * */
    this.defaultKeys= {};
    if( !dontRegister ) {
        this.register();
    }
};

/** @param {string} name Name of the field (excluding the module name).
 *  @return {SeLiteSettings.Field}
 * */
SeLiteSettings.Module.prototype.getField= function getField( name ) {
    return this.fields[name];
};

SeLiteSettings.savePrefFile= function savePrefFile() {
    prefs.savePrefFile( null );
};

/** Like nsIPrefBranch.getChildList(), but it
 *  - returns direct children only (i.e. not ones that contain dot(s) in the name right of the given namePrefix)
 *  - returns direct virtual child, i.e. a name at direct child level, which is a parent of any grand/great grand... children, even if there
 *    is no preference at direct child level itself. It returns it without the trailing dot.
 *  - without the prefix (namePrefix) - i.e. it removes the prefix
 *  See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIPrefBranch#getChildList()
 * */
function directChildList( prefsBranch, namePrefix ) {
    if( namePrefix===undefined || namePrefix===null) {
        namePrefix= '';
    }
    var children= prefsBranch.getChildList( namePrefix,{} );
    var result= [];
    
    var namePrefixLength= namePrefix.length;
    for( var i=0; i<children.length; i++ ) {
        var child= children[i];
        
        var postfix= child.substring( namePrefixLength );
        var indexOfDot= postfix.indexOf('.');
        if( indexOfDot>0 ) {
            postfix= postfix.substring( 0, indexOfDot);
        }
        if( result.indexOf(postfix)<0 ) {
            result.push( postfix );
        }
    }
    return result;
}

/** Add a field to an existing module 'on the fly'. All such added fields will be re-added when you call SeLiteSettings.loadFromJavascript( moduleName, moduleFileOrUrl, forceReload ) with forceReload=true (but the source code/definition of those added fields won't be re-read automatically). Do not call this from the file that defines this configuration module, otherwise this addField() fails if the file is re-loaded.
 *  @param {SeLiteSettings.Field} field
 *  @param {boolean} dontReRegister If true, then this doesn't re-register the module.
 *  @returns {void}
 * */
SeLiteSettings.Module.prototype.addField= function addField( field, dontReRegister ) {
    field instanceof SeLiteSettings.Field || SeLiteMisc.fail( 'addField() for SeLiteSettings.Module expects field to be an instance of SeLiteSettings.Field instances, but it is not.');
    if( field.name in this.fields ) {
        var fieldHasBeenAddedAlready= field.name in this.addedFields;
        if( fieldHasBeenAddedAlready && field.equals( this.fields[field.name] ) ) { // This happens if you restart Selenium IDE.
            return;
        }
        throw new Error( 'SeLiteSettings.Module instance with name "' +this.name+ '" already has an ' +(fieldHasBeenAddedAlready ? 'added' : 'original')+ ' field with name "' +field.name+ '".');
    }
    field.registerFor( this );
    this.fields[ field.name ]= field;
    this.addedFields[ field.name ]= field;
    if( !dontReRegister ) {
        this.register();
    }
};

/** Remove the given field from an existing module 'on the fly'. All such added fields will be re-added when you call SeLiteSettings.loadFromJavascript( moduleName, moduleFileOrUrl, forceReload ) with forceReload=true (but the source code/definition of those added fields won't be re-read automatically). Do not call this from the file that defines this configuration module, otherwise this removeField() fails if the file is re-loaded.
 * @param {(SeLiteSettings.Field|string)} fieldOrName Field or its (short) name.
 *  @param {boolean} dontReRegister If true, then this doesn't re-register the module.
 * @returns {void} 
 */
SeLiteSettings.Module.prototype.removeField= function removeField( fieldOrName, dontReRegister ) {
    var field, name;
    if( typeof fieldOrName==='string' ) {
        field= this.fields[fieldOrName]; // This may be undefined, if the field was removed already
        name= fieldOrName;
    }
    else {
        field= fieldOrName;
        field instanceof SeLiteSettings.Field || SeLiteMisc.fail( 'removeField() for SeLiteSettings.Module expects field to be an instance of SeLiteSettings.Field instances, but it is not.');
        name= field.name;
    }
    if( !(name in this.fields) ) {
        if( name in this.removedFields ) {
            return;
        }
        SeLiteMisc.fail( 'SeLiteSettings.Module instance with name ' +this.name+ " hasn't got a field with name " +name );
    }
    field.equals( this.fields[name] ) || SeLiteMisc.fail( 'SeLiteSettings.Module instance with name ' +this.name+ " has a field with name " +name+ " but it doesn't equal to the given field." );
    delete this.fields[name];
    this.removedFields[name]= field;
    if( !dontReRegister ) {
        this.register();
    }
};

/** Add fields to an existing module 'on the fly'. See addField().
 *  @param {SeLiteSettings.Field[]} fields
 *  @param {boolean} dontReRegister If true, then this doesn't re-register the module.
 *  @returns {void}
 * */
SeLiteSettings.Module.prototype.addFields= function addFields( fields, dontReRegister ) {
    Array.isArray(fields) || SeLiteMisc.fail( 'addFields() expects fields to be an array.' );
    for( var i=0; i<fields.length; i++ ) { //@TODO change into for(.. of.. ) once NEtBeans supports it
        this.addField( fields[i], true );
    }
    if( !dontReRegister ) {
        this.register();
    }
};

/** Set SeLiteSettings.moduleForReloadButtons.testDbKeeper and initialise it. You can call this only after you've called SeLiteSettings.setModuleForReloadButtons(this) successfully - normally it's done automatically for module 'extensions.selite-settings.common'.
 *  @param {(SeLiteSettings.TestDbKeeper|null)} testDbKeeper. Pass null if your framework doesn't use testDbKeeper.
 * */
SeLiteSettings.setTestDbKeeper= function setTestDbKeeper( testDbKeeper ) {
    try { throw new Error(); } // This is to get the location of the test framework. If testDbKeeper was already set from the same framework, then I skip it. Otherwise I report a problem.
    catch( e ) {
        // e is a string, with the innermost stack information first. This is usually called
        // when Selenium IDE runs a Selenese command from the test suite for the first time.
        // It may be any Selenese - thus some of the stack levels can vary.
        // I also accept this scenario: The user uses a test suite with a framework. Then she uses a test suite with no test framework. Then she uses a test suite with the exact same framework as the first one - however, Bootstrap copies the framework to a new file with timestamp in the name. So I extract the framework file name except for the timestamp. Limitation: if multiple frameworks have the same file leaf name, this can't distinguish between them. QA Note: you can only trigger the second load of the same framework, if you update timestamp of its file (e.g. by unix command 'touch').
        // -> file:///var/tmp/dotclear-framework.js-1401941951280:102
        var invoker= e.stack.match( /^[^>]+-> ([^\n]+)-[0-9]+:[0-9]+/ )[1];
        if( SeLiteSettings.moduleForReloadButtons.testDbKeeperInvoker!==undefined ) {
            if( SeLiteSettings.moduleForReloadButtons.testDbKeeperInvoker===invoker ) {
                return;
            }
            SeLiteMisc.fail( "You've already set testDbKeeper at " +SeLiteSettings.moduleForReloadButtons.testDbKeeperInvoker+ ", or you've already loaded another test framework. Please restart Firefox (not just Selenium IDE)." );
        }
        SeLiteSettings.moduleForReloadButtons.testDbKeeperInvoker= invoker;
        SeLiteSettings.moduleForReloadButtons.testDbKeeper= testDbKeeper;
        if( testDbKeeper ) {
            var testDbField= SeLiteSettings.moduleForReloadButtons.fields['testDB'];
            var tablePrefixField= SeLiteSettings.moduleForReloadButtons.fields['tablePrefix'];
            testDbKeeper.initialise( SeLiteData.getStorageFromSettings(testDbField, tablePrefixField) );
        }
    }
};

/**@return array of strings names of sets as they are in the preferences DB, or [''] if the module
 * doesn't allow sets
 * */
SeLiteSettings.Module.prototype.setNames= function setNames() {
    if( !this.allowSets ) {
        return [''];
    }
    var children= directChildList( this.prefsBranch );
    children.sort( SeLiteMisc.compareCaseInsensitively );
    var result= [];
    for( var i=0; i<children.length; i++ ) {
        var child= children[i];
        if( SeLiteSettings.reservedNames.indexOf(child)<0 ) {
            result.push( child );
        }
    }
    return result;
};

/** @return string name of the default set. Null if no set is default.
 *  @throws If the module doesn't allow sets.
 * */
SeLiteSettings.Module.prototype.defaultSetName= function defaultSetName() {
    if( !this.allowSets ) {
        throw new Error( "SeLiteSettings.Module '" +this.name+ "' doesn't allow sets.");
    }
    if( this.prefsBranch.prefHasUserValue(SeLiteSettings.DEFAULT_SET_NAME) ) {
        return this.prefsBranch.getCharPref( SeLiteSettings.DEFAULT_SET_NAME );
    }
    return null;
};

/** It marks the given set as the default set for the module. It doesn't call nsIPrefService.savePrefFile().
 *  @param string name of the set to become default. If null/undefined/empty, then this deselects the default set.
 *  @throws If the module doesn't allow sets.
 * */
SeLiteSettings.Module.prototype.setDefaultSetName= function setDefaultSetName( setName ) {
    if( !this.allowSets ) {
        throw new Error( "SeLiteSettings.Module '" +this.name+ "' doesn't allow sets.");
    }
    !setName || ensureFieldName( setName, 'setName', true );
    if( setName ) {
        this.prefsBranch.setCharPref( SeLiteSettings.DEFAULT_SET_NAME, setName );
    }
    else {
        this.prefsBranch.clearUserPref( SeLiteSettings.DEFAULT_SET_NAME );
    }
};

/** @param {string} setName Name of the set; optional; undefined or an empty string if the module doesn't allow sets, or if you want the default set.
 * @param {boolean} [includeUndeclaredEntries] Whether to include values of undeclared fields or FixedMap entries. That won't include undeclared options for declared Field.Choice instances.
 *  @return Object with sorted keys, serving as associative array {
 *      string field name: anonymous object {
 *          fromPreferences: boolean, whether the value comes from preferences (otherwise it comes from a values manifest or is undefined)
 *          entry: either
 *          - string/boolean/number (its 'primitive' value), or null or undefined, for non-choice single-value fields; or
 *          - object (potentially empty) serving as an associative array, for choice field (multivalued or single valued) or for non-choice multi-valued field, if the field has a value (or multiple values) or if it's empty but present (as indicated by SeLiteSettings.VALUE_PRESENT), in format {
 *             string key => string/number ('primitive') label or value entered by user
 *          },
 *          - null, if it has no value/choice in the given set and is indicated as 'null' by SeLiteSettings.NULL
 *          - undefined otherwise (if the field has no value/choice in the given set)
 *      }
 *  }
 *  It doesn't inject any field defaults (from the module configuration). If setName is not empty and it differs to name of the default set, this doesn't inject any values from default set. If you'd like the values of the given set to merge with values of default set (if any) or with field defaults, use getFieldsDownToSet() instead. This ignores any manifests.
 *  @private For SeLite internal use only.
 * */
SeLiteSettings.Module.prototype.getFieldsOfSet= function getFieldsOfSet( setName, includeUndeclaredEntries ) {
    var result= SeLiteMisc.sortedObject(true);
    for( var fieldName in this.fields ) {
        result[ fieldName ]= this.getFieldOfSet( setName, fieldName );
    }
    if( includeUndeclaredEntries ) {
        var setNameWithDot= setName!==''
            ? setName+ '.'
            : '';
        var children= this.prefsBranch.getChildList( setNameWithDot, {} );
        for( var i=0; i<children.length; i++ ) {//@TODO for(..of..)
            var prefName= children[i];
            var fieldKeyValue= prefName.substring( setNameWithDot.length );
            var fieldName= fieldKeyValue.indexOf( '.' )>=0
                ? fieldKeyValue.substring( 0, fieldKeyValue.indexOf('.') )
                : fieldKeyValue;
            var keyValue= fieldName && fieldKeyValue.length>fieldName.length+1
                ? fieldKeyValue.substring( fieldName.length+1 )
                : undefined;
            var key= keyValue && keyValue.indexOf('.')>=0
                ? keyValue.substring( 0, keyValue.indexOf('.') )
                : undefined;
            /*var valueString= key!==undefined && keyValue.length>key.length+1
                ? keyValue.substring( key.length+1 )
                : undefined;*/
            var value= this.preferenceValue( setNameWithDot+fieldName+
                (key!==undefined
                    ? '.' +key
                    : ''
                )
            );
            var field= fieldName
                ? this.fields[fieldName]
                : undefined;
            if( !field ) {
                if( key!==undefined ) {
                    if( !result[fieldName] ) {
                        result[fieldName]= {
                            entry: {},
                            fromPreferences: true
                        };
                    }
                    result[fieldName].entry[ key ]= value;
                }
                else {
                    result[fieldName]= {
                        entry: value,
                        fromPreferences: true
                    };
                }
            }
            // @TODO if we allow customisable set of options for Field.Choice, handle it, too
            else if( field instanceof SeLiteSettings.Field.FixedMap && !(key in field.keySet) ) {
                result[fieldName].entry[ key ]= value;
            }
        }
    }
    return SeLiteMisc.proxyEnsureFieldsExist( result );
};

/** @private
 *  @param {string} prefName
 *  @return {*} Value of the given preference, at its appropriate type (string, boolean or int).
 * */
SeLiteSettings.Module.prototype.preferenceValue= function preferenceValue( prefName ) {
    var type= this.prefsBranch.getPrefType( prefName );
    if( type===nsIPrefBranch.PREF_STRING ) {
        return this.prefsBranch.getCharPref(prefName);
    }
    else if( type===nsIPrefBranch.PREF_BOOL ) {
        return this.prefsBranch.getBoolPref(prefName);
    }
    else if( type===nsIPrefBranch.PREF_INT ) {
        return this.prefsBranch.getIntPref(prefName);
    }
};

/** @private 
 * @param {string} setName
 * @param {string} fieldName
 * @returns {object}
 */
SeLiteSettings.Module.prototype.getFieldOfSet= function getFieldOfSet( setName, fieldName ) {
    if( !setName ) {
        setName= this.allowSets
            ? this.defaultSetName()
            : '';
    }
    var setNameWithDot= setName!==''
        ? setName+ '.'
        : '';
    var field= this.fields[fieldName];
    var isChoice= field instanceof SeLiteSettings.Field.Choice;
    var multivaluedOrChoice= field.multivalued || isChoice;
    var fieldNameWithDot= multivaluedOrChoice
        ? fieldName+ '.'
        : fieldName;
    var fieldHasPreference= this.prefsBranch.prefHasUserValue(setNameWithDot+fieldName); // True if a single-valued field has a value, or if a multivalued/choice (choice or non-choice) has SeLiteSettings.VALUE_PRESENT
    var children; // An array of preference string key(s) present for this field
    if( !multivaluedOrChoice &&  fieldHasPreference ) {
        children= [setNameWithDot+fieldName];
    }
    else
    if( multivaluedOrChoice ) {
        children= this.prefsBranch.getChildList( setNameWithDot+fieldNameWithDot, {} );
    } else {
        children= [];
    }
    var multivaluedOrChoiceFieldPreference= multivaluedOrChoice && fieldHasPreference
        ? this.prefsBranch.getCharPref(setNameWithDot+fieldName)
        : undefined;
    if( multivaluedOrChoice && fieldHasPreference ) {
        children.length===0 || SeLiteMisc.fail('Set "' + setName+ '", field "' +fieldName+ '" has field preference, therefore it should have no children.');
        field.multivalued && multivaluedOrChoiceFieldPreference===SeLiteSettings.VALUE_PRESENT
        || !field.multivalued && multivaluedOrChoiceFieldPreference===SeLiteSettings.NULL
        || SeLiteMisc.fail( 'SeLiteSettings.Module ' +this.name+ ', set ' + setName+
            ', field ' +fieldName+ ' is multivalued and/or a choice, but it has its own preference which is other than ' +SeLiteSettings.VALUE_PRESENT+ ' or ' +SeLiteSettings.NULL );
    }
    var result= {
        fromPreferences: false,
        entry: undefined
    };
    if( multivaluedOrChoice && (fieldHasPreference && multivaluedOrChoiceFieldPreference===SeLiteSettings.VALUE_PRESENT || children.length>0) ) {
        // When presenting SeLiteSettings.Field.Choice, they are not sorted by stored values, but by keys from the field definition.
        // So I only use sortedObject for multivalued fields other than SeLiteSettings.Field.Choice
        result.entry= isChoice
            ? {}
            : SeLiteMisc.sortedObject( field.compareValues );
    }
    for( var i=0; i<children.length; i++ ) {//@TODO for(..of..)
        var prefName= children[i];

        var value= this.preferenceValue( prefName );
        if( multivaluedOrChoice ) {
            if( field instanceof SeLiteSettings.Field.FixedMap ) {
                value= value!==SeLiteSettings.NULL
                    ? value
                    : null;
            }
            result.entry[ prefName.substring(setNameWithDot.length+fieldNameWithDot.length) ]= value;
        }
        else {
            result.entry= value!==SeLiteSettings.NULL
                ? value
                : null;
        }
    }
    if( isChoice && !field.multivalued && fieldHasPreference ) {
        multivaluedOrChoiceFieldPreference===SeLiteSettings.NULL || SeLiteMisc.fail('This should have failed above already. SeLiteSettings.Module ' +field.module.name+ ', set ' +setName+ ', field ' +field.name+ ' has preference ' +fieldPreference );
        result.entry= null;
    }
    !isChoice || result.entry===undefined || typeof(result.entry)==='object' || SeLiteMisc.fail( 'field ' +field.name+ ' has value ' +typeof result.entry ); 
    result.fromPreferences= fieldHasPreference || children.length>0;
    return result;
};

/** @param {string|SeLiteSettings.Module} moduleNameOrModule
 *  @return {SeLiteSettigs.Module} If moduleNameOrModule is a string, return an instance for that module if registered;
 *  if moduleNameOrModule is SeLiteSettings.Module instance, return it; undefined otherwise.
 * */
SeLiteSettings.Module.forName= function forName( moduleNameOrModule ) {
    if( moduleNameOrModule instanceof SeLiteSettings.Module ) {
        return moduleNameOrModule;
    }
    SeLiteMisc.ensureType( moduleNameOrModule, 'string', 'moduleNameOrModule (if not an instance of SeLiteSettings.Module)' );
    return modules[moduleNameOrModule];
};

/** Read whole contents of the file. Assume UTF-8.
 * @param string fileName File name
 * @return string contents; false if no such file (compare the result strictly using ===false)
 * */
function readFile( fileName ) {
    try {
        var file= new FileUtils.File( fileName ); // Object of class nsIFile
        //@TODO speed up: if file doesn't exist, return true, rather than fail and catch
        var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
                  createInstance(Components.interfaces.nsIFileInputStream);
        var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
                      createInstance(Components.interfaces.nsIConverterInputStream);
        fstream.init(file, -1, -1, 0);
        cstream.init(fstream, "UTF-8", 0, 0);
    }
    catch( exception ) {
        return false;
    }

    var contents= "";
    var str= {};
    var read = 0;
    do {
        read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
        contents += str.value;
    } while (read != 0);
    cstream.close(); // this closes fstream, too
    return contents;
}

SeLiteSettings.VALUES_MANIFEST_FILENAME= 'SeLiteSettingsValues.txt'; // @TODO Make this 'const' once NetBeans supports it
SeLiteSettings.ASSOCIATIONS_MANIFEST_FILENAME= 'SeLiteSettingsAssociations.txt'; // @TODO Make this 'const' once NetBeans supports it

var commentLineRegex= /^[ \t]*#.*$/;
/** @param string contents
 *  @return array Line(s) without those that were purely comments, or empty lines.
 * */
function removeCommentsGetLines( contents ) {
    var lines= contents.split("\n");
    var result= [];
    for( var j=0; j<lines.length; j++ ) {
        var line= lines[j];
        if( !commentLineRegex.test(line) && line.trim()!=='' ) {
            result.push( line );
        }
    }
    return result;
}

// 'moduleName.fieldName valueOrNothing' or 'moduleName.fixedMapFieldName:key valueOrNothing'
// valueOrNothing can't start with whitespace
var valuesLineRegex=      /^([^ \t]+)\.([^. \t:]+)(:([^. \t]+))?([ \t]+([^ \t].*))?$/;

// moduleName setName
var associationLineRegex= /^([^ \t]+)[ \t]+([^ \t]+)$/;

/** Object serving as an associative array {
 *    string absoluteFolderPath: respective result of manifestsDownToFolder(absoluteFolderPath)
 * }
 * */
var cachedManifests= {};

/** Collect manifest files (both values and associations fo set),
 *  down from filesystem root to given folderPath. Parse them.
 *  @param string folderPath Full path (absolute) to the folder where your test suite is.
 *  Optional, defaults to current test suite's folder. If not specified and if there is no current
 *  test suite folder, then such a call is valid and this function returns an object with no manifests.
 *  @param bool dontCache If true, then this doesn't cache manifest files (it doesn't use any
 *  previous result stored in the cache and it doesn't store result in the cache). For use by GUI.
 *  @return anonymous object {
 *      values: naturally sorted object (that lists more global folders first) {
 *          string absoluteFolderPath: array of entries from a values manifest at this path
 *               [
 *                 anonymous object {
 *                      moduleName: string,
 *                      fieldName: string,
 *                      value: string
 *                 },
 *                 ...
 *               ],
 *          ...
 *      },
 *      associations: naturally sorted object (that lists more global folders first) {
 *          string absoluteFolderPath: array of entries from an association manifest at this path
 *            [
 *              anonymous object {
 *                  moduleName: string,
 *                  setName: string
 *              },
 *              ...
 *            ],
 *          ...  
 *      }
 *  }
 * */
function manifestsDownToFolder( folderPath, dontCache ) {
    folderPath= folderPath || SeLiteSettings.testSuiteFolder;
    dontCache= dontCache || false;
    var folderNames= [];
    if( folderPath ) {
        if( !dontCache && folderPath in cachedManifests ) {
            return cachedManifests[folderPath];
        }
        var folder= null;
        try {
            folder= new FileUtils.File(folderPath);
        }
        catch(e) {
            throw new Error( "Can't locate folder associated with configuration sets: " +folderPath );
        }
        SeLiteMisc.ensure( folder!=null && folder.exists, 'Given folder does not exist.' );
        SeLiteMisc.ensure( folder.isDirectory(), 'Configuration sets can only be associated with folders, not with files.' );

        // Array of string, each a full path of a folder on the path down to folderPath, including folderPath itself
        var breadCrumb= folder;
        do {
            folderNames.push( breadCrumb.path );
            breadCrumb= breadCrumb.parent;
        }
        while( breadCrumb!==null );
        folderNames= folderNames.reverse(); // Now they start from the root/drive folder
    }    
    var values= SeLiteMisc.sortedObject(true);
    var associations= SeLiteMisc.sortedObject(true);
    
    for( var i=0; i<folderNames.length; i++) {//@TODO use loop for of() once NetBeans supports it
        var folder=  folderNames[i];
        var fileName= OS.Path.join(folder, SeLiteSettings.VALUES_MANIFEST_FILENAME);
        var contents= readFile( fileName );
        if( contents!==false ) {
            var lines= removeCommentsGetLines(contents);
            for( var j=0; j<lines.length; j++ ) {
                var parts= valuesLineRegex.exec( lines[j] );
                parts || SeLiteMisc.fail( "Values manifest " +fileName+ " at line " +(j+1)+ " is badly formatted: " +lines[j]  );
                if( !(folder in values) ) {
                    values[folder]= [];
                }
                values[folder].push( {
                    moduleName: parts[1],
                    fieldName: parts[2],
                    fixedMapKey: parts[4],
                    value: parts[6] // This is always non-null (it can be an empty string)
                } );
            }
        }
        
        fileName= OS.Path.join(folder, SeLiteSettings.ASSOCIATIONS_MANIFEST_FILENAME);
        var contents= readFile( fileName );
        if( contents!==false ) {
            var lines= removeCommentsGetLines(contents);
            for( var j=0; j<lines.length; j++ ) {
                var parts= associationLineRegex.exec( lines[j] );
                parts || SeLiteMisc.fail( "Associations manifest " +fileName+ " at line " +(j+1)+ " is badly formatted: " +lines[j]  );
                if( !(folder in associations) ) {
                    associations[folder]= [];
                }
                associations[folder].push( {
                    moduleName: parts[1],
                    setName: parts[2]
                } );
            }
        }
    }
    var result= {
        values: values,
        associations: associations
    };
    if( !dontCache && folderPath ) {
        cachedManifests[folderPath]= result;
    }
    return result;
};

/* @private String, path to a folder, where the current Selenium IDE test suite is. If Selenium IDE is not running,
 * or the test suite is a temporary one (not saved yet), then it's undefined.
 * @TODO This, namedTestSuiteFolderChangeHandlers, cachedManifests and potentially other 'global' variables allow confusing side effects, if this JS component is used by various apps. Should I pass Selenium object, and define any such variables on that object instead?But: some variables need to be shared. E.g. chrome://selite-settings/content/tree.xul?module=extensions.selite-settings.common needs to know about any keys added to 'roles' field by the current custom framework.
 */
SeLiteSettings.testSuiteFolder= undefined;

/** @private Object serving as an associative array of functions, that are called whenever the test suite folder changes.
 * */
var namedTestSuiteFolderChangeHandlers= {};

/** @return string Full path of the current Se IDE test suite folder. Or undefined - see SeLiteSettings.testSuiteFolder.
 * */
SeLiteSettings.getTestSuiteFolder= function getTestSuiteFolder() { return SeLiteSettings.testSuiteFolder; };

/** @note Internal. Used by extensions/core-extension.js which stores the path of the test suite here.
 *  @param folder string or undefined
 * */
SeLiteSettings.setTestSuiteFolder= function setTestSuiteFolder( folder ) {
    //console.log( 'setTestSuiteFolder ' +folder );
    if( SeLiteSettings.testSuiteFolder!==folder ) {
        SeLiteSettings.testSuiteFolder= folder;
        SeLiteSettings.applyTestSuiteFolderChangeHandlers( folder );
    }
};

/** @note Internal. Used by ui/ovOptions.js
 * */
SeLiteSettings.changedDefaultSet= function changedDefaultSet() {
    SeLiteSettings.applyTestSuiteFolderChangeHandlers( SeLiteSettings.testSuiteFolder );
};

/** @note Internal
 * */
SeLiteSettings.applyTestSuiteFolderChangeHandlers= function applyTestSuiteFolderChangeHandlers( folder ) {
    for( var i=0; i<unnamedTestSuiteFolderChangeHandlers.length; i++ ) { // @TODO change to for( .. of .. ) loop
        unnamedTestSuiteFolderChangeHandlers[i].call( null, folder );
    }
    for( var i in namedTestSuiteFolderChangeHandlers ) { // @TODO for( .. of .. )
        namedTestSuiteFolderChangeHandlers[i].call( null, folder );
    }
};
    
/** @private within SeLite family. Called when Se IDE is being closed down.
 * */
SeLiteSettings.closingIde= function closingIde() {
    for( var i=0; i<closingIdeHandlers.length; i++ ) { //@TODO use loop for( .. of ..)
        closingIdeHandlers[i].call();
    }
};

/** Calculate a composition of field values, based on manifests, preferences and field defaults,
 *  down from filesystem root to given folderPath if set (if not set, then to the current test suite's folder, if any).
 *  @param string folderPath Full path (absolute) to the folder where your test suite is.
 *  If undefined/null, then this uses the folder of test suite currently open in Selenium IDE. If there is none,
 *  it returns fields of the default set (or field default values).
 *  @param bool dontCache If true, then this doesn't cache manifest files (it doesn't use any
 *  previous manifests stored in the cache and it doesn't store current manifests in the cache). The actual preferences won't be cached no matter what dontCache. For use by GUI.
 *  @param {bool} [includeUndeclaredEntries] See same parameter of SeLiteSettings.Module.prototype.getFieldsOfSet().
 *  @return Object with sorted keys, serving as an associative array. A bit similar to result of getFieldsOfset(),
 *  but with more information and more structure: {
 *      string field name => anonymous object (known as 'valueCompound' in ovOptions.js) {
 *          fromPreferences: boolean, whether the value comes from preferences; otherwise it comes from a values manifest;
 *          setName: string set name (only valid if fromPreferences is true);
 *          folderPath: string
 *          - folder path to the manifest file (either values manifest, or associations manifest)
 *          - empty '' if the values comes from the default set
 *          - null if the value comes from field default in module schema;
 *          entry: either
 *          - string/boolean/number ('primitive') value, for non-choice single-value fields, and
 *          - object serving as an associative array, for choice, or non-choice and multi-value field name, in format {
 *             string key => string/number ('primitive') label or value entered by user
 *            }
 *          - undefined or null
 *      }
 *  }
 *  where each 'entry' comes from either
 *  - a set
 *  - a values manifest
 *  - default key (value) of the field.
 *  The structure of the result is mostly similar to result of SeLiteSettings.Module.prototype.getFieldsOfSet().
* */
SeLiteSettings.Module.prototype.getFieldsDownToFolder= function getFieldsDownToFolder( folderPath, dontCache, includeUndeclaredEntries ) {
    folderPath= folderPath || SeLiteSettings.testSuiteFolder;
    this.associatesWithFolders || SeLiteMisc.fail( "SeLiteSettings.Module.getFieldsDownToFolder() requires module.associatesWithFolders to be true, but it was called for module " +this.name );
    dontCache= dontCache || false;
    
    var result= SeLiteMisc.sortedObject(true);
    for( var fieldName in this.fields ) {
        result[ fieldName ]= SeLiteMisc.proxyEnsureFieldsExist( {
            entry: undefined,
            fromPreferences: false,
            folderPath: undefined,
            setName: undefined
        } );
    }
    
    var manifests= manifestsDownToFolder(folderPath, dontCache);
    
    // First, merge values from values manifests.
    for( var manifestFolder in manifests.values ) {
        for( var i=0; i<manifests.values[manifestFolder].length; i++ ) { //@TODO for .. of..
            var manifest= manifests.values[manifestFolder][i];
            
            if( manifest.moduleName==this.name ) {
                if( manifest.fieldName in this.fields || includeUndeclaredEntries ) {
                    
                    var field= this.fields[manifest.fieldName];
                    if( manifest.value.indexOf(SeLiteSettings.SELITE_THIS_MANIFEST_FOLDER)>=0 ) {
                        // 1. replace / and \ in the value from manifest with the system's folder separator. I do that by splitting the value by a regex, and then using OS.Path.join().
                        // 2. replace SeLiteSettings.SELITE_THIS_MANIFEST_FOLDER with the full path to the manifest's folder
                        // Since I split the relative path by / and \, the following doesn't affect us: OS.Path.join('\\\\', 'server', 'folder') returned value of JS expression '\\\\server\folder'. I don't want two backslashes \\ anywhere else than the root of the path, because it's deemed absolute and then OS.Path.join() ignores any previous parameters (as is documented at MDN): OS.Path.join('any', 'path', '\\\\', 'subfolder') and also OS.Path.join('any', 'path', '\\', '\\', 'subfolder') return value of JS expression '\\\\subfolder'.
                        var pathParts= manifest.value.split( /[/\\]/ );
                        manifest.value= OS.Path.join.apply( null, pathParts );
                        manifest.value= manifest.value.replace( SeLiteSettings.SELITE_THIS_MANIFEST_FOLDER, manifestFolder, 'g' );
                        manifest.value= OS.Path.normalize( manifest.value );
                    }
                    // Handle multivalued fields or Field.Choice, or undeclared multivalued fields
                    if( field && (field.multivalued || field instanceof SeLiteSettings.Field.Choice) || !field && result[manifest.fieldName] && result[manifest.fieldName].folderPath===manifestFolder ) {
                        // If the field has any values from higher folders, forget them. The field may already have values from this same folder from the previous iterations - keep those.
                        if( result[manifest.fieldName].folderPath!==manifestFolder ) {
                            // We list options for Field.Choice in the order of their definition. Entries of (other) multi-valued entries fields are sorted as in the field definition:
                            result[ manifest.fieldName ].entry= field && !(field instanceof SeLiteSettings.Field.Choice)
                                ? SeLiteMisc.sortedObject( field.compareValues )
                                : {};
                        }
                        if( manifest.value!==SeLiteSettings.VALUE_PRESENT ) {
                            if( !(field instanceof SeLiteSettings.Field.FixedMap) ) {
                                result[ manifest.fieldName ].entry[ manifest.value ]=
                                    field instanceof SeLiteSettings.Field.Choice && manifest.value in field.choicePairs
                                    ? field.choicePairs[ manifest.value ]
                                    : manifest.value;
                            }
                            else {
                                // @TODO If we load frameworks automatically somehow, then load them before applying the rest of the manifests. Then change the following console.warn() to SeLiteMisc.fail():
                                field.keySet.indexOf(manifest.fixedMapKey)>=0 || includeUndeclaredEntries || console.warn( 'FixedMap ' +field.name+ " uses (yet) undefined key: " +manifest.fixedMapKey+ ' (which has value: ' +manifest.value+ ').' );
                                result[ manifest.fieldName ].entry[ manifest.fixedMapKey ]= manifest.value;
                            }    
                        }
                    }
                    else { // single-valued, non-choice field, or first value of a (potentially multi-valued) undeclared field
                        result[ manifest.fieldName ].entry= manifest.value!==SeLiteSettings.NULL
                            ? ( field
                                    ? field.parse(manifest.value)
                                    : manifest.value
                              )
                            : null;
                    }
                    result[ manifest.fieldName ].folderPath= manifestFolder;
                }
                else {
                    console.warn( "Values manifest for module " +this.name+ " in folder " +manifestFolder+ " sets a value for unknown field " +manifest.fieldName );
                }
            }
        }
    }
    
    // Second, queue up the 'default' set and any associated sets.
    // I'm not modifying manifests.associations itself, because it can be cached & reused.
    // So I merge those into a new object - associations, which will have same structure as manifests.associations.
    var associations= SeLiteMisc.sortedObject(true);
    if( this.allowSets && this.defaultSetName()!==null ) {
        associations['']= [{
            moduleName: this.name,
            setName: this.defaultSetName(),
        }];
    }
    for( var associationFolder in manifests.associations ) {
        associations[associationFolder]= manifests.associations[associationFolder];
    }
    
    // Third, merge with any applicable sets: default set (if any) and sets associated via associations manifests. They override values from any values manifests.  then apply field defaults where needed.
    return this.mergeSetsAndDefaults( associations, result, dontCache, includeUndeclaredEntries );
};

/** This gets values of the given set (if any). It merges them with values of default set (if any), and with field defaults, as per SettingsScope.wiki.
 * @private
 * @param {string} [setName]
 * @param {bool} [dontCache]
 * @param {bool} [includeUndeclaredEntries] Like the same parameter of SeLiteSettings.Module.prototype.getFieldsOfSet().
 * @return {object} like result of getFieldsDownToFolder()
 * */
SeLiteSettings.Module.prototype.getFieldsDownToSet= function getFieldsDownToSet( setName, dontCache, includeUndeclaredEntries ) {
    this.allowsSets || SeLiteMisc.fail( "You can't use getFieldsDownToSet() for module " +this.name+ " since it doesn't allow sets." );
    var setEntries= SeLiteMisc.sortedObject(true);
    if( this.defaultSetName()!==null && this.defaultSetName()!==setName ) {
        setEntries['']= [  SeLiteMisc.proxyEnsureFieldsExist({
            moduleName: this.name,
            setName: this.defaultSetName(),
        }) ];
    }
    if( setName ) {
        setEntries['']= [  SeLiteMisc.proxyEnsureFieldsExist({
            moduleName: this.name,
            setName: setName,
        }) ];
    }
    return this.mergeSetsAndDefaults( setEntries, undefined, dontCache, includeUndeclaredEntries );
};

/** Get values of given set(s) and merge them on top of the given result (if any). Get field defaults and apply them to any fields left without a value.
 * @private
 * @param {object} applicableSets, result of SeLiteMisc.sortedObject(true). When this is called by getFieldsDownToFolder, applicableSets is in form {
 *     '' => default set name (if any),
 *     topmost folder name having an associated set => name of that associated set,
 *     ....
 *     leafmost folder name having an associated set => name of that associated set
 * }
 * When called from getFieldsDownToSet(), applicableSets is in form {
 *     '' => default set name (if any),
 *     string given setName (if any and if other than the default set name) => the same given setName
 * }
 * @param {object} [result] If present, this merges the fields into that object and it returns it. Otherwise it creates a new object by calling SeLiteMisc.sortedObject(true).
 * @param {bool} [dontCache]
 * @param {bool} [includeUndeclaredEntries] Like the same parameter of SeLiteSettings.Module.prototype.getFieldsOfSet().
 * @return {object} like result of getFieldsDownToFolder()
 * */
SeLiteSettings.Module.prototype.mergeSetsAndDefaults= function getFieldsDownToSet( applicableSets, result, dontCache, includeUndeclaredEntries ) {
    result= result || SeLiteMisc.sortedObject(true);
    for( var folderOrSetName in applicableSets ) {
        for( var i=0; i<applicableSets[folderOrSetName].length; i++ ) {
            var setEntry= applicableSets[folderOrSetName][i];
            if( setEntry.moduleName==this.name ) {
                var fields= this.getFieldsOfSet( setEntry.setName, includeUndeclaredEntries );
                for( var fieldName in fields ) {
                    // override any value(s) from values manifests, no matter whether from upper or lower (more local) level
                    // override any less local value(s) from default set or sets associated with upper (less local) folders
                    if( fields[fieldName].fromPreferences ) {
                        result[ fieldName ]= SeLiteMisc.proxyEnsureFieldsExist( {
                            entry: fields[fieldName].entry,
                            fromPreferences: true,
                            folderPath: folderOrSetName,
                            setName: setEntry.setName
                        } );
                    }
                }
            }
        }
    }
    // Fourth, for any fields with the value being undefined (not null or empty string), apply field defaults
    for( var fieldName in this.fields ) {
        if( result[fieldName].entry===undefined ) {
            var field= this.fields[fieldName];
            var isChoice= field instanceof SeLiteSettings.Field.Choice;
            if( !field.multivalued && !isChoice ) {
                result[fieldName].entry= field.getDefaultKey();
            }
            else {
                var entry= isChoice
                    ? {}
                    : SeLiteMisc.sortedObject( field.compareValues );
                var keyOrKeys= field.getDefaultKey();
                if( field.multivalued ) {
                    for( var i=0; i<keyOrKeys.length; i++ ) { //@TODO use for.. of.. loop once NetBeans support it
                        var key= keyOrKeys[i];
                        entry[ key ]= isChoice
                            ? field.choicePairs[key]
                            : key;
                    }
                }
                else {
                    entry= isChoice
                        ? field.choicePairs[keyOrKeys]
                        : keyOrKeys; // This may be null or undefined
                }
                result[fieldName].entry= entry;
            }
            result[fieldName].fromPreferences= false;
            result[fieldName].folderPath= null;
            result[fieldName].setName= undefined;
        }
    }
    return result;
};

/** (Re)register this module.
 * Get an existing module instance with the same name, if it was already loaded (i.e. registered in Firefox preferences and also loaded into memory).
 *  If there was none, register this. Otherwise
 *  - Check that both instances come from the same definition file.
 *  - Check that both the definitions have same value of 'allowSets'. If the field definitions are different,
 *    it means that the definition got updated - therefore replace the old loaded instance with this instance.
 * Either way, then set up or upgrade set(s):
 * Create the main & only set, if module was created with allowSets=false.
 * Create a default set, if module was was created with allowSets==true and defaultSetName!=null.
 * If the module was registered already, update the only set or any existing sets (depending on allowSets and defaultSetName as above).
 * It calls nsIPrefService.savePrefFile().
 * @return void
 * */
SeLiteSettings.Module.prototype.register= function register() {
    if( this.definitionJavascriptFile ) {
        this.prefsBranch.setCharPref( MODULE_DEFINITION_FILE_OR_URL, this.definitionJavascriptFile ); // If the definition file got moved, this keeps the track of it. That's good for clients of SeLiteSettings.loadFromJavascript() that don't know the location of the file.
    }
    else {
        this.prefsBranch.prefHasUserValue( MODULE_DEFINITION_FILE_OR_URL ) || SeLiteMisc.fail( "Settings module " +this.name+ " has never been registered before, and it doesn't know location of its definition file. Pass SELITE_SETTINGS_FILE_URL when instantiating SeLiteSettings.Module." );
    }
    
    if( this.prefsBranch.prefHasUserValue(MODULE_DEFINITION_ALLOW_SETS) ) {
        var oldAllowSets= this.prefsBranch.getBoolPref(MODULE_DEFINITION_ALLOW_SETS);
        oldAllowSets===this.allowSets || SeLiteMisc.fail ( 'Settings module ' +this.name+ " used to have allowSets=" +oldAllowSets+ " and now it's " +this.allowSets+ ". It can't be changed without manual intervention!" );
    }
    else {
        this.prefsBranch.setBoolPref( MODULE_DEFINITION_ALLOW_SETS, this.allowSets );
    }
    if( this.name in modules ) {
        var existingModule= modules[this.name];
        // @TODO try to figure out equality of 2 different relative/absolute paths/symlinks to the same file (via nsIFile??)
        SeLiteSettings.fileNameToUrl(this.definitionJavascriptFile)===SeLiteSettings.fileNameToUrl(existingModule.definitionJavascriptFile)
        || SeLiteMisc.fail ( 'There are two Settings modules ' +this.name+ ' with different definition files. Old ' +existingModule.definitionJavascriptFile+ ' and new ' +this.definitionJavascriptFile+ ". If you've moved the file, restart Firefox." );
        
        if( !SeLiteMisc.compareAllFields(existingModule.fields, this.fields, 'equals' ) ) {
            modules[this.name]= this;
        }
    }
    else {
        modules[this.name]= this;
    }
    if( this.allowSets ) {
        var setNames= this.setNames();
        // Update any existing sets
        for( var i=0; i<setNames.length; i++ ) {
            this.createSet( setNames[i] );
        }
        if( this.defaultSetNameValue ) {
            if( !this.prefsBranch.prefHasUserValue(SeLiteSettings.DEFAULT_SET_NAME) ) { // @TODO Maybe better: prefs.getPrefType(..)
                this.createSet( this.defaultSetNameValue );
                this.setDefaultSetName( this.defaultSetNameValue );
            }
        }
    }
    else {
        this.createSet();
    }
    SeLiteSettings.savePrefFile();
};

/** (Re)create a set with the given name.
 *  @param setName string name of the set to create/update; optional. It can & must be empty if and only if the module doesn't associate with folders (then it operates on the main & only set).
 * */
SeLiteSettings.Module.prototype.createSet= function createSet( setName ) {
    if( setName===undefined || setName===null ) {
        setName= '';
    }
    typeof setName==='string' || SeLiteMisc.fail( "SeLiteSettings.Module.createOrUpdateSet(setName) expects optional setName to be a string, if provided." );
    if( setName!=='' ) {
        ensureFieldName( setName, 'set name', true);
    }
    this.allowSets===Boolean(setName) || SeLiteMisc.fail( "Module " +this.name+ (this.allowSets ? " allows" : " doesn't allow")+ " sets, but the given set name is " +setName );
    
    // Following makes the set show up even if
    // it has no stored fields. That is initially, or later (if the user deletes all the values in the set) - therefore I do this now.
    try { // When following failed, the exception has very little information and no .stack. @TODO? Factor out to a function and use it.
        this.prefsBranch.setCharPref( setName, SET_PRESENT);
    }
    catch( e ) {
        console.log( 'SeLiteSettings for module ' +this.name+ ' failed to mark set ' +setName+ ' with constant SET_PRESENT (value ' +SET_PRESENT+ ').' );
        throw e;
    }
};

/** Remove the set of the given name.
    @param setName string name of the set to create/update. If empty, it operates on the main & only set.
 * */
SeLiteSettings.Module.prototype.removeSet= function removeSet( setName ) {
    if( setName===undefined ) {
        setName= '';
    }
    if( typeof setName!='string' ) {
        throw new Error( "SeLiteSettings.Module.createOrUpdateSet(setName) expects optional setName to be a string.");
    }
    if( setName!=='' ) {
        ensureFieldName( setName, 'set name', true );
    }
    var setNameDot= setName!==''
        ? setName+ '.'
        : setName;
    for( var fieldName in this.fields ) {
        var field= this.fields[fieldName];
        if( field.multivalued || field instanceof SeLiteSettings.Field.Choice ) {
            this.prefsBranch.deleteBranch( setNameDot+fieldName+'.' );
        }
        else
        if( this.prefsBranch.prefHasUserValue(setNameDot+fieldName) ) {
            this.prefsBranch.clearUserPref( setNameDot+fieldName );
        }
    }
    this.prefsBranch.clearUserPref( setName );
};

/** Convert given file name to a URL (a string), if it's a valid file path + file name. Otherwise return it unchanged.
 * @private It's only exported for internal usage within SeLite Settings (ovOptions.js).
 * */
SeLiteSettings.fileNameToUrl= function fileNameToUrl( fileNameOrUrl ) {
    try {
        var file= new FileUtils.File(fileNameOrUrl);
        return Services.io.newFileURI( file ).spec;
    }
    catch( exception ) {
        return fileNameOrUrl; //nsIIOService.newURI( fileNameOrUrl, null, null).spec;
    }
};

/** Load & register the module from its Javascript file, if stored in preferences.
 *  The file will be cached - any changes will have affect only once you reload Firefox.
 *  If called subsequently, it returns an already loaded instance (unless forceReload is true).
 *  @param moduleNameFileUrl string Either
 *  - module name, that is name of the preference path/prefix up to the module (including the module name), excluding the trailing dot; or
 *  @param {string} [moduleFileOrUrl] Either
 *  - file path + name of the module definition file; or
 *  - URL (either chrome:, resource: or file:) to the module definition file
 *  Optional; even if it's specified, it's used only if the module has not been registered yet (and then it's required).
 *  Standard client code should only pass it when installing a module. Clients that expect a module to be installed
 *  shouldn't pass moduleFileOrUrl.
 *  @param forceReload bool Whether reload the module and overwrite the already cached object,
 *  rather than return a cached definition, even if it has been loaded already. False by default (i.e. by default it returns
 *  the cached object, if present). It re-adds any fields previously added by addField() - but it doesn't (and it can't) reload source of those added fields.
 *  @return {SeLiteSettings.Module} instance
 *  @throws an error if no such preference branch, or preferences don't contain javascript file, or the javascript file doesn't exist.
 * */
SeLiteSettings.loadFromJavascript= function loadFromJavascript( moduleName, moduleFileOrUrl, forceReload ) {
   ensureFieldName( moduleName, 'SeLiteSettings.Module name', true );
   var previouslyAddedFields= {};
   var previouslyAddedKeys= {};
   var previouslyRemovedFields= {};
   var previousDefaultKeys= {};
   if( modules[moduleName] ) {
        if( forceReload ) {
            previouslyAddedFields= modules[moduleName].addedFields;
            previouslyAddedKeys= modules[moduleName].addedKeys;
            previouslyRemovedFields= modules[moduleName].removedFields;
            previousDefaultKeys= modules[moduleName].defaultKeys;
            delete modules[moduleName];
        }
        else {
            return modules[ moduleName];
        }
    }
    var moduleUrl;
    // If the module has been registered, then there isa preference matching its full name to file path or url of its definition file
    var prefsBranch= prefs.getBranch( moduleName+'.' );
    if( prefsBranch.prefHasUserValue(MODULE_DEFINITION_FILE_OR_URL) ) {
        moduleUrl= SeLiteSettings.fileNameToUrl( prefsBranch.getCharPref(MODULE_DEFINITION_FILE_OR_URL) );
    }
    else {
        if( moduleFileOrUrl ) {
            moduleUrl= SeLiteSettings.fileNameToUrl( moduleFileOrUrl );
        }
        else {
            SeLiteMisc.fail( "Can't find module '" +moduleName+ "' in your preferences, and you didn't pass moduleFileOrUrl. Pass moduleFileOrUrl and/or register the module first.");
        }
    }
    try {
        // I don't use Components.utils.import( fileUrl.spec ) because that requires the javascript file to have EXPORTED_SYMBOLS array.
        // Also, Components.utils.import() caches the file.
        // subScriptLoader.loadSubScript() doesn't cache the javascript and it (re)evaluates it, which makes development easier.
        // Side note: The following requires the second parameter (the scope) of loadSubScript(), even if it were empty {}.
        subScriptLoader.loadSubScript(
            moduleUrl,
            {
                SeLiteSettings: SeLiteSettings,
                SELITE_SETTINGS_FILE_URL: moduleUrl
            },
            'UTF-8'
        );
    }
    catch(e ) {
        console.log( 'Exception when loading SeLiteSettings.Module ' +moduleName+ ': ' +e+ '\nStack trace:\n' +e.stack );
        throw e;
    }
    moduleName in modules || SeLiteMisc.fail( "Loaded definition of module " +moduleName+ " and it was found in preferences, but it didn't register itself properly. Fix its definition at " +moduleUrl+ " so that it registers itself." );
    var module= modules[moduleName];
    if( Object.keys(previouslyAddedFields).length>0 || Object.keys(previouslyAddedKeys).length>0 || Object.keys(previouslyRemovedFields).length>0 || Object.keys(previousDefaultKeys).length>0 ) {
        for( var fieldName in previouslyAddedFields ) {
            module.addField( previouslyAddedFields[fieldName], true );
        }
        for( var fieldName in previouslyAddedKeys ) {
            var field= module.fields[fieldName];
            field instanceof SeLiteSettings.Field.FixedMap || SeLiteMisc.fail( 'There is no SeLiteSettings.Field.FixedMap with name ' +fieldName+ ' in module ' +this.name+ ', though it was previously added!' );
            var keys= previouslyAddedKeys[fieldName];
            for( var key in keys ) {
                field.addKey( key, keys[key], true );
            }
        }
        for( var fieldName in previouslyRemovedFields ) {
            module.removeField( fieldName, true );
        }
        for( var fieldName in previousDefaultKeys ) {
            module.fields[fieldName].setDefaultKey( previousDefaultKeys[fieldName] );
        }
        module.register();
    }
    return module;
};

SeLiteSettings.moduleNamesFromPreferences= function moduleNamesFromPreferences( namePrefix ) {
    if( namePrefix===undefined ) {
        namePrefix= '';
    }
    if( typeof namePrefix!=='string' ) {
        throw new Error();
    }
    var prefsBranch= prefs.getBranch( namePrefix );
    var children= prefsBranch.getChildList( '', {} );
    children.sort( SeLiteMisc.compareCaseInsensitively );
    var result= [];
    
    for( var i=0; i<children.length; i++ ) {
        var child= namePrefix+ children[i];
        if( child.endsWith(MODULE_DEFINITION_FILE_OR_URL) ) {
            var moduleNameLength= child.length-1-MODULE_DEFINITION_FILE_OR_URL.length;
            result.push( child.substring(0, moduleNameLength) );
        }
    }
    return result;
};

/** Associate a settings module to be used by GUI reload/snapshot buttons.
 *  Call this from your framework. Do not call it from your settings module definition, otherwise if you load other such definitions (e.g. through API or by opening chrome://selite-settings/content/tree.xul), then the last call to this function would apply.
 *  @param {SeLiteSettings.Module|string} moduleOrName Module, or its full name. The module definition must have fields
 *  - testDbField SeLiteSettings.Field.SQLite that points to test SQLite DB; required
 *  - appDbField SeLiteSettings.Field.SQLite that points to app SQLite DB; optional
 *  - vanillaDbField SeLiteSettings.Field.SQLite that points to vanilla (snapshot) SQLite DB; optional
 *  At least two of appDbField and vanillaDbField must exist.
 *  @TODO Simplify and use SeLiteSettings.commonSettings?
 * */
SeLiteSettings.setModuleForReloadButtons= function setModuleForReloadButtons( moduleOrName ) {
    SeLiteSettings.moduleForReloadButtons= SeLiteSettings.Module.forName( moduleOrName );
    var testDbField= SeLiteSettings.moduleForReloadButtons.fields['testDB'];
    testDbField instanceof SeLiteSettings.Field.SQLite || SeLiteMisc.fail();
    
    var appDbField= SeLiteSettings.moduleForReloadButtons.fields['appDB'];
    !appDbField || appDbField instanceof SeLiteSettings.Field.SQLite || SeLiteMisc.fail();
    
    var vanillaDbField= SeLiteSettings.moduleForReloadButtons[ 'vanillaDB' ];
    !vanillaDbField || vanillaDbField instanceof SeLiteSettings.Field.SQLite || SeLiteMisc.fail();
    
    testDbField && (appDbField || vanillaDbField) || SeLiteMisc.fail( 'There must be Field.SQLite appDB, and at least one of appDB and vanillaDB in a settings module passed to SeLiteSettings.setModuleForReloadButtons().' );
};

/** This will be the module instance for extensions.selite-settings.common, once its definition is loaded.
 * @var {SeLiteSettings.Module}
 * */
SeLiteSettings.commonSettings= null;

/** Convert a given symbolic role name (prefixed with '&') to username, or return a given username unchanged.
 *  @param {string} userNameOrRoleWithPrefix Either a symbolic role name, starting with '&', or a username.
 *  @return {string} Username mapped to userNameOrRoleWithPrefix (after removing '&' prefix) through extensions.selite.common.roles field. If userNameOrRoleWithPrefix doesn't start with '&', this returns it unchanged.
 * */
SeLiteSettings.roleToUser= function roleToUser( userNameOrRoleWithPrefix ) {
    if( userNameOrRoleWithPrefix.startsWith('&') ) {
        var role= userNameOrRoleWithPrefix.substring(1);
        return SeLiteSettings.commonSettings.getFieldsDownToFolder()[ 'roles' ].entry[ role ];
    }
    else {
        return userNameOrRoleWithPrefix;
    }
};

/** @return {string} Webroot URL of the application, ending with a slash '/'. This is useful because Selenium IDE doesn't allow base URL to contain path (http://code.google.com/p/selenium/issues/detail?id=3116).
 * */
SeLiteSettings.webRoot= function webRoot() {
    var entry= SeLiteSettings.commonSettings.fields['webRoot'].getDownToFolder().entry;
    if( entry ) {
        return entry.endsWith('/')
            ? entry
            : entry+'/';
    }
    return entry;
};

/** @return {string} URL of the application, based on SeLiteSettings.webRoot() and given path.
 * @param {string} [path] Absolute path relative to webroot. It can start with '/' or without it. Optional - if not present, then this just returns webroot.
 * */
SeLiteSettings.webURL= function webURL( path ) {
    path= path || '';
    if( path.startsWith('/') ) {
        path= path.substring(1);
    }
    return SeLiteSettings.webRoot()+path;
};

loadingPackageDefinition= false;