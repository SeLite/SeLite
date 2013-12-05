/*  Copyright 2013 Peter Kehl
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";
var runningAsComponent= (typeof window==='undefined' || window && window.location && window.location.protocol==='chrome:');
// runningAsComponent is false when loaded via <script src="file://..."> or <script src="http://..."> rather than via Components.utils.import().
// Used for debugging; limited (because when it's not loaded via Components.utils.import() it can't access other components).

// Whether this file is being loaded.
var loadingPackageDefinition= true;
if( runningAsComponent ) {
    // prefs is an instance of nsIPrefBranch
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    Components.utils.import("resource://gre/modules/Services.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import( "chrome://selite-misc/content/selite-misc.js" );
    var nsIPrefBranch= Components.interfaces.nsIPrefBranch;
    var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    var nsIIOService= Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);    
    Components.utils.import("resource://gre/modules/osfile.jsm");
    var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
}

var modules= sortedObject(true); // Object serving as an associative array { string module.name => Module instance }

var SELECTED_SET_NAME= "SELITE_SELECTED_SET_NAME"; // CSS also depends on its value

// SET_DEFINITION_JAVASCRIPT is an optional hidden field, which allows SeLiteSettings to load the definition automatically
var MODULE_DEFINITION_FILE_OR_URL= "SELITE_MODULE_DEFINITION_FILE_OR_URL";

// Following are not field names, but they're used in the tree for 'properties' metadata and for buttons that create or delete a set
var SET_SELECTION_ROW= "SELITE_SET_SELECTION_ROW";
var FIELD_MAIN_ROW= "SELITE_FIELD_MAIN_ROW";
var FIELD_TREECHILDREN= "SELITE_FIELD_TREECHILDREN";
var NEW_VALUE_ROW= "SELITE_NEW_VALUE_ROW";
var ADD_VALUE= "SELITE_ADD_VALUE";
var OPTION_NOT_UNIQUE_CELL= "SELITE_OPTION_NOT_UNIQUE_CELL";
var OPTION_UNIQUE_CELL= "SELITE_OPTION_UNIQUE_CELL";

var SET_PRESENT= 'SELITE_SET_PRESENT'; // It indicates that the set is present, even if it doesn't define any values
/** It indicates that a choice (single or multi-valued) or a multi-valued field is present in a set, even if it's unselected or an empty array;
 *  then it's stored as a preference with the key being 'moduleName.setName.fieldName'
 *  without a trailing dot. Used both in preferences and in values manifest files.
 * @type String
 */
var VALUE_PRESENT= 'SELITE_VALUE_PRESENT';
/** It indicates that a single-valued field has value of null. Used in both preferences and values manifests.
 * */
var NULL= 'SELITE_NULL';

// Following are used to generate 'properties' in columns 'Set' and 'Manifest', when viewing fields per folder
var ASSOCIATED_SET= 'SELITE_ASSOCIATED_SET';
var SELECTED_SET= 'SELITE_SELECTED_SET';
var VALUES_MANIFEST= 'SELITE_VALUES_MANIFEST';
var FIELD_DEFAULT= 'SELITE_FIELD_DEFAULT';
var FIELD_NULL_OR_UNDEFINED= 'SELITE_FIELD_NULL_OR_UNDEFINED';

/** An array of strings that are reserved names. For internal use only.
 * */
var reservedNames= [
    SELECTED_SET_NAME,
    MODULE_DEFINITION_FILE_OR_URL,
    SET_SELECTION_ROW,
    FIELD_MAIN_ROW,
    FIELD_TREECHILDREN,
    NEW_VALUE_ROW,
    ADD_VALUE,
    OPTION_NOT_UNIQUE_CELL,
    OPTION_UNIQUE_CELL,
    SET_PRESENT, VALUE_PRESENT,
    ASSOCIATED_SET, SELECTED_SET, VALUES_MANIFEST,
    FIELD_DEFAULT, FIELD_NULL_OR_UNDEFINED
];

var fieldNameRegex= /^[a-zA-Z0-9_/-]+$/;
var moduleNameRegex= /^[a-zA-Z0-9_/-][a-zA-Z0-9_/.-]*[a-zA-Z0-9_/-]$/;
/** Ensure that the name can be a preference module/set/field name. Module names can contain a dot
 *  but they can't start neither end with a dot, and they must be at least 2 characters long.
 *   Set/Field names and multi-value field keys can't contain dots.
 *  @param name
 *  @param description String to describe what is being checked, if the check fails.
 *  @param bool asFieldName Whether to check as a field name; otherwise it's deemed to be a field/set name. False by default.
 * */
function ensureFieldName( name, description, asModuleOrSetName ) {
    var regex= asModuleOrSetName
        ? moduleNameRegex
        : fieldNameRegex;
    if( !regex.test( name ) ) {
        throw new Error( 'SeLiteSettings expect ' +description+ ' to be a valid preference '
            +(asModuleOrSetName ? 'module or set' : 'field')+ ' name, but "' +name+ '" was passed.');
    }
}

/** @param string name Name of the field
 *  @param bool multivalued Whether the field is multivalued; false by default
 *  @param defaultKey mixed Default key. It is the default value(s) for fields other than Field.Choice. For Field.Choice it is the default key(s).
 *  Optional. It can be undefined if you don't want a default key
 *  (then it won't be set and it will be inherited, if any). It can be null only for single-valued fields, then the default key is null.
 *  Otherwise, if the fiels is single valued, the default key should fit the particular type.
 *  If multivalued is true, it must be an array (potentially empty) or undefined; it can't be null.
 *  For multivalued fields, this can be an empty array, or an array of keys (i.e. stored values, rather than labels to display, which may not be the same for Field.Choice).
 *  If a non-null and not undefined, then the value (or values) will be each checked by validateKey(value).
 *  <br/>defaultKey is only applied (copied into) to set(s) if requireAndPopulate==true and if Module.associatesWithFolders==false.
 *  It is applied when creating or updating a configuration set
 *  (loading an existing configuration set which doesn't have a value for this field).
 *  But if Module.associatesWithFolders==true, defaultKey is applied by getFieldsDownToFolder() no matter what requireAndPopulate.
 *  @param bool requireAndPopulate Whether to require a value (or VALUE_PRESENT) to be stored for this field at all times.
 *  If false, the field may not to be stored in the set at all (Javascript: undefined). False by default.
 *  If false, and the field has no value stored in a a set,
 *  the behaviour is different to empty/blank or null,  as 'not present' means the field inherits the value from
 *  - values manifests or more general sets (if accessing per folder), or
 *  - from the field default (from schema definition)
 *  @param customValidate Function to perform custom validation. It takes
 *  - 1 parameter: 'key' (same as the value) for fields other than Field.Choice
 *  - 2 parameters: 'key' and 'value' for Field.Choice and its subclasses
 *  It returns boolean - true on success, false on failure. Optional.
 * */
var Field= function( name, multivalued, defaultKey, requireAndPopulate, customValidate ) {
    if( typeof name!=='string' ) {
        throw new Error( 'Field() expects a string name ("primitive" string, not new String(..)).');
    }
    if( reservedNames.indexOf(name)>=0 ) {
        throw new Error( 'Field() reserves name "' +name+ '". Do not use that as a field name.');
    }
    loadingPackageDefinition || ensureFieldName( name, 'field name' );
    this.name= name;
    
    multivalued= multivalued || false;
    if( typeof multivalued!=='boolean') {
        throw new Error( 'Field("' +name+ ') expects multivalued to be a boolean, if provided.');
    }
    this.multivalued= multivalued;
    !this.multivalued || defaultKey===undefined || defaultKey instanceof Array || fail( "Multi valued field " +name+ " must have default a default key - an array (possibly []) or undefined." );
    this.multivalued || defaultKey===undefined || defaultKey===null || typeof defaultKey!=='object' || fail( 'Single valued field ' +name+ " must have default key a primitive or null.");
    this.defaultKey= defaultKey;
    this.requireAndPopulate= requireAndPopulate || false;
    ensureType( this.requireAndPopulate, "boolean", "Field() expects requireAndPopulate to be a boolean, if present.");
    this.customValidate= customValidate || undefined;
    ensureType( this.customValidate, ['function', 'undefined'], 'Field() expects customValidate to be a function, if present.' );
    
    !(this.defaultKey===null && multivalued) || fail( 'Field ' +name+ " must have a non-null defaultKey (possibly undefined), because it's multivalued." );
    if( this.defaultKey!==undefined && this.defaultKey!==null ) {
        !this.multivalued || ensureInstance( this.defaultKey, Array, "defaultKey of a multivalued field must be an array" );
        var defaultKeys= this.multivalued
            ? this.defaultKey
            : [this.defaultKey];
        for( var i=0; i<defaultKeys.length; i++ ) {//@TODO use loop for(.. of..) once NetBeans supports it
            var key= defaultKeys[i];
            this.validateKey(key) // This is redundant for Field.Choice, but that's OK
            && this.customValidateDefault(key)
            || fail( 'Default key for '
                +(this.module ? 'module ' +this.module.name+ ', ' : '')
                +'field ' +this.name+ ' is ' +key+ " and that doesn't pass validation." );
        }
    }    
    
    if( !this.name.endsWith('.prototype') ) {
        if( this.constructor===Field ) {
            throw new Error( "Can't instantiate Field directly, except for prototype instances. name: " +this.name );
        }
        ensureInstance(this, 
            [Field.Bool, Field.Int, Field.Decimal, Field.String, Field.File, Field.Folder, Field.SQLite, Field.Choice.Int, Field.Choice.Decimal, Field.Choice.String],
            "Field.Bool, Field.Int, Field.String, Field.Decimal, Field.File, Field.Folder, Field.SQLite, Field.Choice.Int, Field.Choice.Decimal, Field.Choice.String", "Field " +this.name+ " is not of an acceptable class." );
    }
    loadingPackageDefinition || this.name.indexOf('.')<0 || fail( 'Field() expects name not to contain a dot, but it received: ' +this.name);
    this.module= null; // instance of Module that this belongs to (once registered)
};

/** Perform the custom validation on a default key.
 * */
Field.prototype.customValidateDefault= function( key ) {
    return true;
};
/** 'Abstract' class. It serves to separate behaviour between freetype/boolean and Choice fields.
 * */
Field.NonChoice= function( name, multivalued, defaultKey, requireAndPopulate, customValidate ) {
    Field.call( this, name, multivalued, defaultKey, requireAndPopulate, customValidate );
};

Field.NonChoice.prototype= new Field('NonChoice.prototype');
Field.NonChoice.prototype.constructor= Field.NonChoice;

Field.NonChoice.prototype.customValidateDefault= function( key ) {
    return !this.customValidate || this.customValidate(key);
};

/** Return the default key, or a protective copy if it's an array.
 *  @return mixed
 * */
Field.prototype.getDefaultKey= function() {
    if( Array.isArray(this.defaultKey) ) {
        return this.defaultKey.slice();
    }
    return this.defaultKey;
};

Field.prototype.toString= function() {
    return this.constructor.name+ '[module: ' +(this.module ? this.module.name : 'unknown')+ ', name: ' +this.name+ ']';
};

/** Trim a free-typed value. This is called before parse().
 *  Do not check for 'null' or 'undefined' - these are handled by ovOptions.js.
 *  @param key User-typed value
 *  @return trimmed value (or unchanged value of key)
 * */
Field.prototype.trim= function( key ) { return key; };

/** Parse a free-typed value. Cast it as needed. This is called after the value went through trim().
 *  Do not check for 'null' or 'undefined' - these are handled by ovOptions.js.
 *  @param key User-typed value
 *  @return parsed/processed value
 * */
Field.prototype.parse= function( key ) { return key; };

/** This validates a single value (i.e. other than undefined or null).
 *  If the field is an instance of Field.Choice, this validates the value/label (not the key).
 *  Used for validation of values entered by the user for freetype/FileOrFolder fields (i.e. not Field.Choice), and
 *  also for validation of default key(s) of any field (including Field.Choice). Overriden as needed.
 *  @param key mixed string or number
 * */
Field.prototype.validateKey= function( key ) {
    return typeof key==='string';
};

/** Used when sorting multivalued non-choice fields. By default we use
 *  case insensitive comparison for Field.String numeric comparison for Field.Number.
 *  @param string/number firstValue
 *  @param string/number secondValue
 *  @return int -1, 0, or 1, see compareCaseInsensitively()
 * */
Field.prototype.compareValues= function( firstValue, secondValue ) {
    return compareCaseInsensitively( firstValue, secondValue );
};

Field.prototype.registerFor= function( module ) {
    if( !(module instanceof Module) ) {
        throw new Error( "Field.registerFor(module) expects module to be an instance of Module.");
    };
    if( this.module!==null ) {
        throw new Error( "Field.registerFor(module) expects 'this' Field not to be registered yet, but field '" +this.name+ "' was registered already.");
    }
    this.module= module;
};

/** Only used when creating new sets that populate default keys. See docs of parameter defaultKey of constructor Field().
 * */
Field.prototype.setDefault= function( setName ) {
    this.setValue( setName, this.defaultKey );
};
/** This returns the preference type used for storing legitimate non-null value(s) of this field.
 *  @return string one of: nsIPrefBranch.PREF_STRING, nsIPrefBranch.PREF_BOOL, nsIPrefBranch.PREF_INT
 * */
Field.prototype.prefType= function() {
    return nsIPrefBranch.PREF_STRING;
};
/** Set/update a value of a singlevalued non-choice field.
 * @public
 * @param setName string
 * @param value mixed; currently it must not be null or undefined - @TODO
 * */
Field.prototype.setValue= function( setName, value ) {
    !this.multivalued && !(this instanceof Field.Choice) || fail( "Can't call setValue() on field " +this.name+ " because it's multivalued or a Field.Choice." );
    var setNameWithDot= setName!==''
        ? setName+'.'
        : '';
    var setFieldName= setNameWithDot+this.name;
    if( this.prefType()!==nsIPrefBranch.PREF_STRING && this.module.prefsBranch.prefHasUserValue(setFieldName)
        && this.module.prefsBranch.getPrefType(setFieldName)===nsIPrefBranch.PREF_STRING
    ) {
        var existingValue= this.module.prefsBranch.getCharPref(setFieldName);
        existingValue===NULL || fail("Non-string field " +this.name+ " has a string value other than 'SELITE_NULL': " +existingValue );
        this.module.prefsBranch.clearUserPref(setFieldName);
    }
    this.setPref( setFieldName, value );
};
/** Set a field (with the given field and key name) to the given value. It doesn't call nsIPrefService.savePrefFile()
 *  but they get saved somehow anyway.
 * */
Field.prototype.setPref= function( setFieldKeyName, value ) {
    var prefType= this.prefType();
    if( prefType===nsIPrefBranch.PREF_STRING ) {
        this.module.prefsBranch.setCharPref( setFieldKeyName, value );
    }
    else
    if( prefType===nsIPrefBranch.PREF_INT ) {
        this.module.prefsBranch.setIntPref( setFieldKeyName, value );
    }
    else {
        prefType===nsIPrefBranch.PREF_BOOL || fail( "Field " +setFieldKeyName+ " hasn't got acceptable prefType()." );
        this.module.prefsBranch.setBoolPref( setFieldKeyName, value );
    }
};

/** Only to be used with multivalued or choice fields.
 * @public
 * @param string setName May be empty.
 * @param mixed key as used to generate the preference name (key), appened after fieldName and a dot. String or number.
 * For non-choice multivalued fields it's also used as the value stored in preferences; and for Int
 * it transforms it into a number.
 * @TODO function to set a multivalued/choice field to undefined (if this.requireAndPopulate===false)
 * */
Field.prototype.addValue= function( setName, key ) {
    this.multivalued || this instanceof Field.Choice || fail();
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( !(this.multivalued || this instanceof Field.Choice) ) {
        throw new Error( "Use Field.addValue() only for multivalued or choice fields." );
    }
    var value= this instanceof Field.Choice
        ? this.choicePairs[key]
        : key;
    this.setPref( setNameDot+ this.name+ '.' +key, value );
};
/** Only to be used with multivalued or choice fields. If the key was not set, then this returns without failing.
 * It doesn't call nsIPrefService.savePrefFile().
 * @param string setName May be empty.
 * @param mixed key as used to generate the preference name (key), appened after fieldName and a dot. String or number.
 * */
Field.prototype.removeValue= function( setName, key ) {
    this.multivalued || this instanceof Field.Choice || fail();
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( !this.multivalued && !(this instanceof Field.Choice) ) {
        throw new Error( "Use Field.removeValue() only for multivalued or choice fields." );
    }
    if( this.module.prefsBranch.prefHasUserValue(setNameDot+this.name+ '.' +key) ) {
        this.module.prefsBranch.clearUserPref( setNameDot+this.name+ '.' +key);
    }
};

/** @return bool
 * */
Field.prototype.equals= function( other ) {
    return this.name===other.name
        && this.constructor===other.constructor
        && (!this.multivalued
            ? this.defaultKey===other.defaultKey // Strict comparison is OK for primitive string/bool/int
            : compareArrays(this.defaultKey, other.defaultKey, true)
           );
};

// @TODO Move this line to Javascript.wiki?: See also https://developer.mozilla.org/en/Introduction_to_Object-Oriented_JavaScript#Inheritance
/** There's no parameter 'customValidate' for Bool.
 * */
Field.Bool= function( name, defaultKey, requireAndPopulate ) {
    Field.NonChoice.call( this, name, false, defaultKey, requireAndPopulate );
};
Field.Bool.prototype= new Field.NonChoice('Bool.prototype');
Field.Bool.prototype.constructor= Field.Bool;
Field.Bool.prototype.validateKey= function( key ) {
    return typeof key==='boolean';
};
Field.Bool.prototype.prefType= function() {
    return nsIPrefBranch.PREF_BOOL;
};

Field.Int= function( name, multivalued, defaultKey, requireAndPopulate, customValidate ) {
    Field.NonChoice.call( this, name, multivalued, defaultKey, requireAndPopulate, customValidate );
};
Field.Int.prototype= new Field.NonChoice('Int.prototype');
Field.Int.prototype.constructor= Field.Int;
Field.Int.prototype.trim= function( key ) { return key.trim(); };
Field.Int.prototype.parse= function( key ) {
    return key!==''
        ? Number(key)
        : Number.NaN; // Number('') or Number(' ') etc. returns 0 - not good for validation!
};
Field.Int.prototype.validateKey= function( key ) {
    return typeof key==='number' && Math.round(key)===key; // This also handles (fails for) NaN, since Number.NaN!==Number.NaN
};
Field.Int.prototype.prefType= function() {
    return nsIPrefBranch.PREF_INT;
};
/** This works even if one or both parameters are strings - it transforms them into numbers.
 *  We need this for XUL GUI setCellText handler.
 * */
Field.Int.prototype.compareValues= function( firstValue, secondValue ) {
    return compareAsNumbers(firstValue, secondValue );
};

Field.Decimal= function( name, multivalued, defaultKey, requireAndPopulate, customValidate ) {
    Field.NonChoice.call( this, name, multivalued, defaultKey, requireAndPopulate, customValidate );
};
Field.Decimal.prototype= new Field.NonChoice('Decimal.prototype');
Field.Decimal.prototype.constructor= Field.Decimal;
Field.Decimal.prototype.trim= Field.Int.prototype.trim;
Field.Decimal.prototype.parse= Field.Int.prototype.parse;
Field.Decimal.prototype.validateKey= function( key ) {
    return typeof key==='number' && !isNaN(key);
};
Field.Decimal.prototype.prefType= function() {
    return nsIPrefBranch.PREF_STRING;
};
/** This works even if one or both parameters are strings - it transforms them into numbers.
 *  We need this for XUL GUI setCellText handler.
 * */
Field.Decimal.prototype.compareValues= function( firstValue, secondValue ) {
    return compareAsNumbers(firstValue, secondValue );
};

Field.String= function( name, multivalued, defaultKey, requireAndPopulate, customValidate ) {
    Field.NonChoice.call( this, name, multivalued, defaultKey, requireAndPopulate, customValidate );
};
Field.String.prototype= new Field.NonChoice('String.prototype');
Field.String.prototype.constructor= Field.String;

/** @param string name
 *  @param bool startInProfileFolder Whether the file/folder picker dialog opens in user's Firefox profile folder (if the file/folder was not set yet)
 *  @param filters Optional, an object serving as an associative array of file filters { 'visible filter name': '*.extension; *.anotherExtension...', ... }
 *  A false/null/0 key or value mean 'All files'.
 *  See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFilePicker#appendFilter%28%29
 *  @param defaultKey
 *  @param bool multivalued
 *  @param bool isFolder Whether this is for folder(s); otherwise it's for file(s)
 * */
Field.FileOrFolder= function( name, startInProfileFolder, filters, multivalued, defaultKey, isFolder, requireAndPopulate, customValidate ) {
    Field.NonChoice.call( this, name, multivalued, defaultKey, requireAndPopulate, customValidate );
    this.startInProfileFolder= startInProfileFolder || false;
    if( typeof this.startInProfileFolder!='boolean' ) {
        throw new Error( 'Field.FileOrFolder() expects startInProfileFolder to be a boolean, if provided.');
    }
    this.filters= filters || {};
    typeof(this.filters)==='object' && !Array.isArray(this.filters) || fail( 'Field.FileOrFolder() expects filters to be an object (not an array) serving as an associative array, if provided.');
    this.isFolder= isFolder || false;
    ensureType( this.isFolder, 'boolean', "Field.FileOrFolder(..) expects isFolder to be a boolean, if provided." );
}
Field.FileOrFolder.prototype= new Field.NonChoice('FileOrFolder.prototype');
Field.FileOrFolder.prototype.constructor= Field.FileOrFolder;

Field.FileOrFolder.prototype.parentEquals= Field.prototype.equals;
Field.FileOrFolder.prototype.equals= function( other ) {
    if( !this.parentEquals(other)
    || this.startInProfileFolder!==other.startInProfileFolder
    || this.isFolder!==other.isFolder ) {
        return false;
    }
    if( !compareAllFields(this.filters, other.filters, true) ) {
        return false;
    }
    return true;
};

/** @param string name
 *  @param bool startInProfileFolder See Field.FileOrFolder()
 *  @param filters See Field.FileOrFolder()
 * */
Field.File= function( name, startInProfileFolder, filters, multivalued, defaultKey, requireAndPopulate, customValidate ) {
    Field.FileOrFolder.call( this, name, startInProfileFolder, filters, multivalued, defaultKey, false, requireAndPopulate, customValidate );
};
Field.File.prototype= new Field.FileOrFolder('File.prototype');
Field.File.prototype.constructor= Field.File;

/** @param string name
 *  @param bool startInProfileFolder See Field.FileOrFolder()
 *  @param filters See Field.FileOrFolder()
 * */
Field.Folder= function( name, startInProfileFolder, filters, multivalued, defaultKey, requireAndPopulate, customValidate ) {
    Field.FileOrFolder.call( this, name, startInProfileFolder, filters, multivalued, defaultKey, true, requireAndPopulate, customValidate );
};
Field.Folder.prototype= new Field.FileOrFolder('Folder.prototype');
Field.Folder.prototype.constructor= Field.Folder;

/** It can only be single-valued. An SQLite DB cannot span across multiple files (or if it can, I'm not supporting that).
 * */
Field.SQLite= function( name, defaultKey, requireAndPopulate, customValidate ) {
    Field.File.call( this, name, true, { 'SQLite': '*.sqlite', 'any': null}, false, defaultKey, requireAndPopulate, customValidate );
};
Field.SQLite.prototype= new Field.File('SQLite.prototype', false, {}, false, '' );
Field.SQLite.prototype.constructor= Field.SQLite;

/** @param defaultKey It's actually a key, not the visible integer/string value.
 *  If multivalued, then it's an array of key(s).
 *  @param choicePairs Anonymous object serving as an associative array {
 *      string key => string/number value ('label')
 *  } It's not clear what is more intuitive here. However, with this format, the type and positioning of
 *  label reflects how it is shown when using Firefox url about:config.
 *  Also, Javascript transforms object field/key names to strings, even if they were set to number/boolean.
 * */
Field.Choice= function( name, multivalued, defaultKey, choicePairs, requireAndPopulate, customValidate ) {
    this.choicePairs= choicePairs || {}; // This is set before I call the parent constructor, so that it can validate defaultKey against this.choicePairs
    Field.call( this, name, multivalued, defaultKey, requireAndPopulate, customValidate );
    loadingPackageDefinition || this.constructor!==Field.Choice
        || fail( "Can't define instances of Field.Choice class itself outside the package. Use Field.Choice.Int or Field.Choice.String." );
    loadingPackageDefinition || typeof(choicePairs)==='object' && !Array.isArray(choicePairs)
        || fail( "Instances of subclasses of Field.Choice require choicePairs to be an anonymous object serving as an associative array." );
    for( var key in this.choicePairs ) {
        var value= this.choicePairs[key];
        if( !this.validateValue(value) || this.customValidate && !this.customValidate(key, value) ) {
            fail( 'Field.Choice.XXXX ' +name+ ' has a choice {' +key+ ': ' +value
                + ' (' +(typeof value)+ ') } which fails validation' );
        }
    }
    if( defaultKey!==undefined ) {
        !(multivalued && defaultKey===null) || fail( "Field.Choice.XX with name " +name+ " can't have defaultKey null, because it's multivalued." );
        multivalued===Array.isArray(defaultKey) || fail( "Field.Choice.XX with name " +name+ " must have defaultKey an array if and only if it's multivalued." );
        var defaultKeys= multivalued
            ? defaultKey
            : [defaultKey];
        for( var i=0; i<defaultKeys.length; i++ ) { //@TODO for..of.. loop once NetBeans support it
            defaultKeys[i] in choicePairs || fail( "Field.Choice " +name+ " has defaultKey " +defaultKeys[i]+ ", which is not among keys of its choicePairs." );
        }
    }
};
Field.Choice.prototype= new Field('Choice.prototype');
Field.Choice.prototype.constructor= Field.Choice;
Field.Choice.prototype.compareValues= function() {
    throw new Error( 'Do not use Field.Choice.compareValues(). Sort choicePairs yourself.');
};
Field.Choice.prototype.setDefault= function() {
    throw new Error("Do not call setDefault() on Field.Choice family.");
};
Field.Choice.prototype.setValue= function() {
    throw new Error("Do not call setValue() on Field.Choice family.");
};
/** It requires the key to be
 *  - among keys in this.choicePairs
 *  - a string or a number
 *  */
Field.Choice.prototype.validateKey= function( key ) {
    return oneOf( typeof key, ['string', 'number']) && key in this.choicePairs;
};

/** Validate a value. Only present for Field.Choice (and subclasses).
 * */
Field.Choice.prototype.validateValue= function( value ) {
    return oneOf( typeof value, ['string', 'number']);
};

Field.Choice.Int= function( name, multivalued, defaultKey, choicePairs, requireAndPopulate, customValidate ) {
    Field.Choice.call( this, name, multivalued, defaultKey, choicePairs, requireAndPopulate, customValidate );
};
Field.Choice.Int.prototype= new Field.Choice('ChoiceInt.prototype');
Field.Choice.Int.prototype.constructor= Field.Choice.Int;
Field.Choice.Int.prototype.trim= Field.Int.prototype.trim;
Field.Choice.Int.prototype.parse= Field.Int.prototype.parse;
Field.Choice.Int.prototype.prefType= Field.Int.prototype.prefType;
Field.Choice.Int.prototype.validateValue= function( value ) {
    return typeof value==='number' && Math.round(value)===value;
};

Field.Choice.Decimal= function( name, multivalued, defaultKey, choicePairs, requireAndPopulate, customValidate ) {
    Field.Choice.call( this, name, multivalued, defaultKey, choicePairs, requireAndPopulate, customValidate );
};
Field.Choice.Decimal.prototype= new Field.Choice('ChoiceDecimal.prototype');
Field.Choice.Decimal.prototype.constructor= Field.Choice.Decimal;
Field.Choice.Decimal.prototype.trim= Field.Decimal.prototype.trim;
Field.Choice.Decimal.prototype.parse= Field.Decimal.prototype.parse;
Field.Choice.Decimal.prototype.prefType= Field.Decimal.prototype.prefType;
Field.Choice.Decimal.prototype.validateValue= function( value ) {
    return typeof value==='number' && !isNaN(value);
};

Field.Choice.String= function( name, multivalued, defaultKey, choicePairs, requireAndPopulate, customValidate ) {
    Field.Choice.call( this, name, multivalued, defaultKey, choicePairs, requireAndPopulate, customValidate );
    for( var key in this.choicePairs ) {
        var value= this.choicePairs[key];
        if( !oneOf( typeof value, ['string', 'number']) ) {
            throw new Error( 'Field.Choice.String() for '
                +(this.module ? 'module ' +this.module.name+', ' : '')+ 'field ' +this.name
                +' expects values in choicePairs to be strings (or integers), but for key ' +key
                +' it has ' +(typeof value)+ ': ' +value );
        }
    }
};
Field.Choice.String.prototype= new Field.Choice('ChoiceString.prototype');
Field.Choice.String.prototype.constructor= Field.Choice.String;

/** @param name string Name prefix for preferences/fields for this module.
 *  As per Mozilla standard, it should be dot-separated and start with 'extensions.' See Firefox url about:config.
 *  @param fields Array of Field objects, in the order how they will be displayed.
 *  Beware: this.fields will not be an array, but an object serving as an associative array { string field name => Field object}
 *  @param allowSets bool Whether to allow multiple sets of settings for this module
 *  @param defaultSetName string Name of the default set. Optional, null by default; only allowed (but not required) if allowSets==true
 *  @param associatesWithFolders bool Whether the sets are to be used with folder paths (and manifest files in them)
 *  @param definitionJavascriptFile string Full path & filename (including the extension) of a javascript file which contains a 
 *  definition of this module. Optional; if present, it lets SeLiteSettings to load a definition automatically.
 *  If not set and the module was already registered with a javascript file and it gets re-registered,
 *  then the javascript file will get 'removed' from this module in the preferences - SeLiteSettings won't be able
 *  to load it automatically (unless it gets re-registered with the javascript file again).
 * */
var Module= function( name, fields, allowSets, defaultSetName, associatesWithFolders, definitionJavascriptFile ) {
    this.name= name;
    if( typeof this.name!='string' ) {
        throw new Error( 'Module() expects a string name.');
    }
    ensureFieldName( name, 'module name', true );
    Array.isArray(fields) || fail( 'Module() expects an array fields, but it received ' +(typeof fields)+ ' - ' +fields);
    this.fields= sortedObject(true); // Object serving as an associative array { string field name => Field instance }
    for( var i=0; i<fields.length; i++ ) {
        var field= fields[i];
        if( !(field instanceof Field) ) {
            throw new Error( 'Module() expects fields to be an array of Field instances, but item [' +i+ '] is not.');
        }
        if( field.name in this.fields ) {
            throw new Error( 'Module() for module name "' +name+ '" has two (or more) fields with same name "' +field.name+ '".');
        }
        field.registerFor( this );
        this.fields[ field.name ]= field;
    }
    
    this.allowSets= allowSets || false;
    if( typeof this.allowSets!='boolean' ) {
        throw new Error( 'Module() expects allowSets to be a boolean, if provided.');
    }
    this.defaultSetName= defaultSetName || null;
    if( this.defaultSetName!=null && typeof this.defaultSetName!='string' ) {
        throw new Error( 'Module() expects defaultSetName to be a string, if provided.');
    }
    if( this.defaultSetName!=null && !this.allowSets ) {
        throw new Error( 'Module() allows optional parameter defaultSetName only if allowSets is true..');
    }
    defaultSetName===null || ensureFieldName( defaultSetName, 'defaultSetName', true );
    
    this.associatesWithFolders= associatesWithFolders || false;
    ensureType( this.associatesWithFolders, 'boolean', 'Module() expects associatesWithFolders to be a boolean, if provided.');
    !this.associatesWithFolders || ensure(this.allowSets, 'Module() must be called with allowSets=true, if associatesWithFolders is true.' );
    
    this.definitionJavascriptFile= definitionJavascriptFile || null;
    if( this.definitionJavascriptFile!=null && typeof this.definitionJavascriptFile!=='string') {
        throw new Error( 'Module() expects definitionJavascriptFile to be a string, if provided.');
    }
    this.prefsBranch= prefs.getBranch( this.name+'.' );
};

var savePrefFile= function() {
    prefs.savePrefFile( null );
};

/** Get an existing module with the same name, or the passed one. If there is an existing module, this checks that
 *  fields and other parameters are equal, otherwise it fails.
 *  If createOrUpdate is true (by default), this (re)registers the module, which calls nsIPrefService.savePrefFile().
 * @param module Object instance of Module that you want to register (or an equal one)
 *  @param createOrUpdate Boolean, optional, true by default; whether to create or update any existing sets by calling module.createOrUpdate()
 *  @return An existing equal Module instance, if any; given module otherwise.
 * */
var register= function( module, createOrUpdate ) {
    if( !(module instanceof Module) ) {
        throw new Error( 'register() expects module to be an instance of Module.');
    }
    if( module.name in modules ) {
        var existingModule= modules[module.name];
        
        !compareAllFields(existingModule.fields, module.fields, 'equals')
            || fail ( 'There already exists a module with name "' +module.name+ '" but it has different definition.');
        if( module.allowSets!==existingModule.allowSets ) {
            throw new Error();
        }
        if( module.defaultSetName!==existingModule.defaultSetName ) {
            throw new Error();
        }
        if( fileNameToUrl(module.definitionJavascriptFile)!==fileNameToUrl(existingModule.definitionJavascriptFile) ) {
            throw new Error();
        }
        module= existingModule;
    }
    else {
        modules[module.name]= module;
    }
    if( createOrUpdate===undefined) {
        createOrUpdate= true;
    }
    if( createOrUpdate ) {
        module.register();
    }
    return module;
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

/**@return array of strings names of sets as they are in the preferences DB, or [''] if the module
 * doesn't allow sets
 * */
Module.prototype.setNames= function() {
    if( !this.allowSets ) {
        return [''];
    }
    var children= directChildList( this.prefsBranch );
    children.sort( compareCaseInsensitively );
    var result= [];
    for( var i=0; i<children.length; i++ ) {
        var child= children[i];
        if( reservedNames.indexOf(child)<0 ) {
            result.push( child );
        }
    }
    return result;
};

/** @return string name of the selected (active) set, including a trailing dot '.'. Null if no set is selected.
 *  @throws If the module doesn't allow sets.
 * */
Module.prototype.selectedSetName= function() {
    if( !this.allowSets ) {
        throw new Error( "Module '" +this.name+ "' doesn't allow sets.");
    }
    if( this.prefsBranch.prefHasUserValue(SELECTED_SET_NAME) ) {
        return this.prefsBranch.getCharPref( SELECTED_SET_NAME );
    }
    return null;
};

/** It sets a selected set for the module. It doesn't call nsIPrefService.savePrefFile().
 *  @param string name of the set to become selected (active), including a trailing dot '.'
 *  @throws If the module doesn't allow sets.
 * */
Module.prototype.setSelectedSetName= function( setName ) {
    if( !this.allowSets ) {
        throw new Error( "Module '" +this.name+ "' doesn't allow sets.");
    }
    ensureFieldName( setName, 'setName', true );
    this.prefsBranch.setCharPref( SELECTED_SET_NAME, setName );
};

/** @param setName Name of the set; an empty string if the module doesn't allow sets, or if you want a selected set.
 *  @return Object with sorted keys, serving as associative array {
 *      string field name: anonymous object {
 *          fromPreferences: boolean, whether the value comes from preferences; otherwise it comes from a values manifest or is undefined
 *          entry: either
 *          - string/boolean/number ('primitive') value or null or undefined, for non-choice single-value fields; or
 *          - object (potentially empty) serving as an associative array, for choice, or non-choice and multi-value field name,
 *          if the whole field is stored other than undefined, in format {
 *             string key => string/number ('primitive') label or value entered by user
 *          }, or undefined if it has no values/choices in the given set and is indicated as 'undefined'
 *      }
 *  }
 *  It doesn't inject any defaults from the module configuration or values manifests for fields that are not defined in the set.
 * */
Module.prototype.getFieldsOfSet= function( setName ) {
    if( setName===undefined || setName===null ) {
        setName= this.allowSets
            ? this.selectedSetName()
            : '';
    }
    var setNameWithDot= setName!==''
        ? setName+ '.'
        : '';
    var result= sortedObject(true);
    
    for( var fieldName in this.fields ) {
        var field= this.fields[fieldName];
        var isChoice= field instanceof Field.Choice;
        var multivaluedOrChoice= field.multivalued || isChoice;
        var fieldNameWithDot= multivaluedOrChoice
            ? fieldName+ '.'
            : fieldName;
        var children; // An array of preference string key(s) present for this field
        var fieldHasPreference= this.prefsBranch.prefHasUserValue(setNameWithDot+fieldName); // True if a single-valued field has a value, or if a multivalued/choice (choice or non-choice) has VALUE_PRESENT
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
            children.length===0 || fail('Set "' + setName+ '", field "' +fieldName+ '" has field preference, therefore it should have no children.');
            field.multivalued && multivaluedOrChoiceFieldPreference===VALUE_PRESENT
            || !field.multivalued && multivaluedOrChoiceFieldPreference===NULL
            || fail( 'Module ' +this.name+ ', set ' + setName+
                ', field ' +fieldName+ ' is multivalued and/or a choice, but it has its own preference which is other than ' +VALUE_PRESENT+ ' or ' +NULL );
        }
        result[ fieldName ]= {
            fromPreferences: false,
            entry: undefined
        };
        if( multivaluedOrChoice && (fieldHasPreference && multivaluedOrChoiceFieldPreference===VALUE_PRESENT || children.length>0) ) {
            // When presenting Field.Choice, they are not sorted by stored values, but by keys from the field definition.
            // So I only use sortedObject for multivalued fields other than Field.Choice
            result[fieldName].entry= isChoice
                ? {}
                : sortedObject( field.compareValues );
        }
        for( var i=0; i<children.length; i++ ) {
            var prefName= children[i];
            var type= this.prefsBranch.getPrefType( prefName );

            var value= null;
            if( type===nsIPrefBranch.PREF_STRING ) {
                value= this.prefsBranch.getCharPref(prefName);
            }
            else if( type===nsIPrefBranch.PREF_BOOL ) {
                value= this.prefsBranch.getBoolPref(prefName);
            }
            else if( type===nsIPrefBranch.PREF_INT ) {
                value= this.prefsBranch.getIntPref(prefName);
            }
            if( multivaluedOrChoice ) {
                result[fieldName].entry[ prefName.substring(setNameWithDot.length+fieldNameWithDot.length) ]= value;
            }
            else {
                result[ fieldName ].entry= value!==NULL
                    ? value
                    : null;
            }
        }
        if( isChoice && !field.multivalued && fieldHasPreference ) {
            multivaluedOrChoiceFieldPreference===NULL || fail('This should have failed above already. Module ' +field.module.name+ ', set ' +setName+ ', field ' +field.name+ ' has preference ' +fieldPreference );
            result[fieldName].entry= null;
        }
        !isChoice || result[fieldName].entry===undefined || typeof(result[fieldName].entry)==='object' || fail( 'field ' +field.name+ ' has value ' +typeof result[fieldName].entry ); 
        result[ fieldName ].fromPreferences= fieldHasPreference || children.length>0;
    }
    return result;
};

/** Read whole contents of the file. Assume UTF-8.
 * @param string fileName File name
 * @return string contents; false if no such file (compare the result strictly using ===false)
 * */
function readFile( fileName ) {
    try {
        var file= new FileUtils.File( fileName ); // Object of class nsIFile
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

var VALUES_MANIFEST_FILENAME= 'SeLiteSettingsValues.txt'; // @TODO Make this 'const' once NetBeans supports it
var ASSOCIATIONS_MANIFEST_FILENAME= 'SeLiteSettingsAssociations.txt'; // @TODO Make this 'const' once NetBeans supports it

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

// moduleName.fieldName valueOrNothing
// valueOrNothing can't start with whitespace
var valuesLineRegex=      /^([^ \t]+)\.([^. \t]+)([ \t]+([^ \t].*))?$/;

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
    dontCache= dontCache || false;
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
    ensure( folder!=null && folder.exists, 'Given folder does not exist.' );
    ensure( folder.isDirectory(), 'Configuration sets can only be associated with folders, not with files.' );
    
    // Array of string, each a full path of a folder on the path down to folderPath, including folderPath itself
    var folderNames= [];
    var breadCrumb= folder;
    do {
        folderNames.push( breadCrumb.path );
        breadCrumb= breadCrumb.parent;
    }
    while( breadCrumb!==null );
    folderNames= folderNames.reverse(); // Now they start from the root/drive folder
    
    var values= sortedObject(true);
    var associations= sortedObject(true);
    
    for( var i=0; i<folderNames.length; i++) {//@TODO use loop for of() once NetBeans supports it
        var folder=  folderNames[i];
        var fileName= OS.Path.join(folder, VALUES_MANIFEST_FILENAME);
        var contents= readFile( fileName );
        if( contents!==false ) {
            var lines= removeCommentsGetLines(contents);
            for( var j=0; j<lines.length; j++ ) {
                var parts= valuesLineRegex.exec( lines[j] );
                parts || fail( "Values manifest " +fileName+ " at line " +(j+1)+ " is badly formatted: " +lines[j]  );
                if( !(folder in values) ) {
                    values[folder]= [];
                }
                values[folder].push( {
                    moduleName: parts[1],
                    fieldName: parts[2],
                    value: parts[4] // This is always non-null (it can be an empty string)
                } );
            }
        }
        
        fileName= OS.Path.join(folder, ASSOCIATIONS_MANIFEST_FILENAME);
        var contents= readFile( fileName );
        if( contents!==false ) {
            var lines= removeCommentsGetLines(contents);
            for( var j=0; j<lines.length; j++ ) {
                var parts= associationLineRegex.exec( lines[j] );
                parts || fail( "Associations manifest " +fileName+ " at line " +(j+1)+ " is badly formatted: " +lines[j]  );
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
    if( !dontCache ) {
        cachedManifests[folderPath]= result;
    }
    return result;
};

/** @var Internal. Used by extensions/core-extension.js which stores the path of the test suite here.
 * */
var TestSuiteFolderInfo= {
    /* Its field 'path' is path to a folder, where the current Selenium IDE test suite is (if any).
        Not valid if it was set already and then Se IDE was closed. @TODO Tail-intercept SE IDE's Editor.prototype.confirmClose().
       - perhaps in a IDE extension. If it returned true, then set TestSuiteFolderInfo.path to undefined.
     */
     path: undefined
};

/** Calculate a composition of field values, based on manifests, preferences and field defaults,
 *  down from filesystem root to given folderPath.
 *  @param string folderPath Full path (absolute) to the folder where your test suite is.
 *  If undefined/null, then this uses the folder of test suite currently open in Selenium IDE. If there is none,
 *  this fails.
 *  @param bool dontCache If true, then this doesn't cache manifest files (it doesn't use any
 *  previous manifests stored in the cache and it doesn't store current manifests in the cache). For use by GUI.
 *  @return Object with sorted keys, serving as an associative array. A bit similar to result of getFieldsOfset(),
 *  but with more information and more structure: {
 *      string field name => anonymous object {
 *          fromPreferences: boolean, whether the value comes from preferences; otherwise it comes from a values manifest,
 *          setName: string set name (only valid if fromPreferences is true),
 *          folderPath: string folder path to the manifest file (either values manifest, or associations manifest); empty '' if the values comes from a global (active) set;
 *              null if the value comes from field default in module schema.
 *          entry: either
 *          - string/boolean/number ('primitive') value, for non-choice single-value fields, and
 *          - object serving as an associative array, for choice, or non-choice and multi-value field name, in format {
 *             string key => string/number ('primitive') label or value entered by user
 *            }
 *      }
 *  }
 *  where each 'entry' comes from either
 *  - a set
 *  - a values manifest
 *  - default key (value) of the field
* */
Module.prototype.getFieldsDownToFolder= function( folderPath, dontCache ) {
    folderPath= folderPath || TestSuiteFolderInfo.path;
    this.associatesWithFolders || fail( "Module.getFieldsDownToFolder() requires module.associatesWithFolders to be true, but it was called for module " +this.name );
    dontCache= dontCache || false;
    
    var result= sortedObject(true);
    for( var fieldName in this.fields ) {
        result[ fieldName ]= {
            entry: undefined,
            fromPreferences: false,
            folderPath: undefined,
            setName: undefined
        };
    }
    
    var manifests= manifestsDownToFolder(folderPath, dontCache);
    
    // First, load values from values manifests.
    for( var manifestFolder in manifests.values ) {
        for( var i=0; i<manifests.values[manifestFolder].length; i++ ) {
            var manifest= manifests.values[manifestFolder][i];
            if( manifest.moduleName==this.name ) {
                if( manifest.fieldName in this.fields ) {
                    var field= this.fields[manifest.fieldName];
                    if( field.multivalued || field instanceof Field.Choice ) {
                        if( result[manifest.fieldName].folderPath!=manifestFolder ) {
                            // override any less local value(s) from a manifest from upper folders
                            result[ manifest.fieldName ].entry= !(field instanceof Field.Choice)
                                ? sortedObject( field.compareValues )
                                : {};
                        }
                        if( manifest.value!==VALUE_PRESENT ) {
                            result[ manifest.fieldName ].entry[ manifest.value ]=
                                field instanceof Field.Choice && manifest.value in field.choicePairs
                                ? field.choicePairs[ manifest.value ]
                                : manifest.value;
                            }
                    }
                    else {
                        result[ manifest.fieldName ].entry= manifest.value!==NULL
                            ? manifest.value
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
    // Second, merge the 'global' set - one that is marked as active (if any) - with associated sets.
    // I'm not modifying manifests.associations itself, because it can be cached & reused.
    // I merge those into a new object - associations, which will have same structure as manifests.associations.
    var associations= sortedObject(true);
    if( this.allowSets && this.selectedSetName()!==null ) {
        associations['']= [{
            moduleName: this.name,
            setName: this.selectedSetName(),
        }];
    }
    for( var associationFolder in manifests.associations ) {
        associations[associationFolder]= manifests.associations[associationFolder];
    }
    // Third, load global set (if any) and sets associated via associations manifests. They override values from any values manifests.
    for( var associationFolder in associations ) {
        for( var i=0; i<associations[associationFolder].length; i++ ) {
            var manifest= associations[associationFolder][i];
            if( manifest.moduleName==this.name ) {
                var fields= this.getFieldsOfSet( manifest.setName );
                for( var fieldName in fields ) {
                    // override any value(s) from values manifests, no matter whether from upper or lower (more local) level
                    // override any less local value(s) from global set or sets associated with upper (less local) folders
                    if( fields[fieldName].fromPreferences ) {
                        result[ fieldName ]= {
                            entry: fields[fieldName].entry,
                            fromPreferences: true,
                            folderPath: associationFolder,
                            setName: manifest.setName
                        }
                    }
                }
            }
        }
    }
    // Fourth, for any fields with the value being undefined (not null or empty string), apply field defaults
    for( var fieldName in this.fields ) {
        if( result[fieldName].entry===undefined ) {
            var field= this.fields[fieldName];
            var isChoice= field instanceof Field.Choice;
            if( !field.multivalued && !isChoice ) {
                result[fieldName].entry= field.getDefaultKey();
            }
            else {
                var entry= isChoice
                    ? {}
                    : sortedObject( field.compareValues );
                var keys= field.getDefaultKey();
                for( var i=0; i<keys.length; i++ ) { //@TODO use for.. of.. loop once NetBeans support it
                    var key= keys[i];
                    entry[ key ]= isChoice
                        ? field.choicePairs[key]
                        : key;
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

/**(re)register the name of the module against definitionJavascriptFile, if the module was created with one.
 * Create the main & only set, if module was created with allowSets=false.
 * Create a default set, if module was was created with allowSets==true and defaultSetName!=null.
 * If the module was registered already, update the only set or any existing sets (depending on allowSets and defaultSetName as above).
 * It calls nsIPrefService.savePrefFile().
 * */
Module.prototype.register= function() {
    if( this.definitionJavascriptFile ) {
        this.prefsBranch.setCharPref( MODULE_DEFINITION_FILE_OR_URL, this.definitionJavascriptFile );
    }
    else {
        // @TODO verify the following line's comment
        this.prefsBranch.clearUserPref( MODULE_DEFINITION_FILE_OR_URL ); // This works even if the preference doesn't exist
    }
    if( this.allowSets ) {
        var setNames= this.setNames();
        // Update any existing sets
        for( var i=0; i<setNames.length; i++ ) {
            this.createSet( setNames[i] );
        }
        if( this.defaultSetName ) {
            if( !this.prefsBranch.prefHasUserValue(SELECTED_SET_NAME) ) { // @TODO Maybe better: prefs.getPrefType(..)
                this.createSet( this.defaultSetName );
                this.setSelectedSetName( this.defaultSetName );
            }
        }
    }
    else {
        this.createSet();
    }
    savePrefFile();
};

/** (Re)create a set of the given name - create it, or add any missing fields.
 *  @param setName string name of the set to create/update; optional. If empty or null, it operates on the main & only set.
 * */
Module.prototype.createSet= function( setName ) {
    if( setName===undefined || setName===null ) {
        setName= '';
    }
    if( typeof setName!='string' ) {
        throw new Error( "Module.createOrUpdateSet(setName) expects optional setName to be a string, if provided.");
    }
    if( setName!=='' ) {
        ensureFieldName( setName, 'set name', true);
    }
    ensure( !(this.associatesWithFolders && setName===''), 'Module associates with folders, therefore a set name cannot be empty.' );
    
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    for( var fieldName in this.fields ) {
        var field= this.fields[fieldName];
        if( field.defaultKey!==undefined && field.requireAndPopulate && !this.associatesWithFolders ) {
            if( !field.multivalued ) {
                if( !(field instanceof Field.Choice) ) {
                    if( !this.prefsBranch.prefHasUserValue(setNameDot+fieldName) ) {
                        // If we applied the following even for fields that have requireAndPopulate==false, it would
                        // override 'undefined' value for existing sets, too! So, if you clear it in a set, it would get re-set again!
                        field.setDefault( setName ); // That adds a dot, if necessary
                    }
                }
                else {
                    if( this.prefsBranch.getChildList( setNameDot+fieldName+'.', {} ).length===0 ) {
                        if( field.defaultKey!==null ) {
                            field.addValue( setName, field.defaultKey );
                        }
                    }
                }
            }
            else {
                var fieldHasChildren= this.prefsBranch.getChildList( setNameDot+fieldName+'.', {} ).length>0;
                if( !this.prefsBranch.prefHasUserValue(setNameDot+fieldName) ) {
                    if( !fieldHasChildren ) {
                        var defaultKeys= field.getDefaultKey();
                        if( defaultKeys.length>0 ) {
                            for( var i=0; i<defaultKeys.length; i++ ) { // @TODO Replace the loop with for.. of.. loop once NetBeans support it
                                field.addValue( setName, defaultKeys[i] ); // For Field.Choice defaultKeys contains the keys rather than values
                            }
                        }
                        else {
                            this.prefsBranch.setCharPref( setNameDot+ field.name, VALUE_PRESENT );
                        }
                    }
                }
                else {
                    this.prefsBranch.getPrefType( setNameDot+ field.name )===nsIPrefBranch.PREF_STRING || fail();
                    this.prefsBranch.getCharPref( setNameDot+ field.name )===VALUE_PRESENT || fail();
                    !fieldHasChildren || fail('Set ' +setName+ ', field ' +fieldName+ ' has both a field preference and field child(ren)!');
                }
            }
        }
    }
    // I store an empty string to mark the presence of the set. That makes the set show up even if
    // it has no stored fields. That may happen initially (all fields have populateInSets==false), or later
    // (if the user deletes all the values in the set) - therefore I do this now.
    this.prefsBranch.setCharPref( setName, SET_PRESENT);
};

/** Remove the set of the given name.
    @param setName string name of the set to create/update. If empty, it operates on the main & only set.
 * */
Module.prototype.removeSet= function( setName ) {
    if( setName===undefined ) {
        setName= '';
    }
    if( typeof setName!='string' ) {
        throw new Error( "Module.createOrUpdateSet(setName) expects optional setName to be a string.");
    }
    if( setName!=='' ) {
        ensureFieldName( setName, 'set name', true );
    }
    var setNameDot= setName!==''
        ? setName+ '.'
        : setName;
    for( var fieldName in this.fields ) {
        var field= this.fields[fieldName];
        if( field.multivalued || field instanceof Field.Choice ) {
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
var fileNameToUrl= function( fileNameOrUrl ) {
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
 *  If called subsequently, it returns an already loaded instance.
 *  @param moduleNameFileUrl string Either
 *  - module name, that is name of the preference path/prefix up to the module (including the module name), excluding the trailing dot; or
 *  @param moduleFileOrUrl string. Either
 *  - file path + name of the module definition file; or
 *  - URL (either chrome:, resource: or file:) to the module definition file
 *  Optional; used if the module has not been registered yet - then it's required. Make your life easy: If you have it, pass it.
 *  @param forceReload bool Whether reload the module and overwrite the already cached object,
 *  rather than return a cached definition, even if it has been loaded already. False by default (i.e. by default it returns
 *  the cached object, if present).
 *  @return Module instance
 *  @throws an error if no such preference branch, or preferences don't contain javascript file, or the javascript file doesn't exist.
 * */
var loadFromJavascript= function( moduleName, moduleFileOrUrl, forceReload ) {
   ensureFieldName( moduleName, 'Module name', true );
   if( modules[moduleName] ) {
        if( forceReload ) {
            delete modules[moduleName];
        }
        else {
            return modules[ moduleName];
        }
    }
    var moduleUrl;
    var prefsBranch= prefs.getBranch( moduleName+'.' );
    if( prefsBranch.prefHasUserValue(MODULE_DEFINITION_FILE_OR_URL) ) {
        moduleUrl= fileNameToUrl( prefsBranch.getCharPref(MODULE_DEFINITION_FILE_OR_URL) );
    }
    else {
        if( moduleFileOrUrl ) {
            moduleUrl= fileNameToUrl( moduleFileOrUrl );
        }
        else {
            fail( "Can't find module '" +moduleName+ "' in your preferences, and you didn't pass moduleFileOrUrl. Pass moduleFileOrUrl and/or register the module first.");
        }
    }
    try {
        // I don't use Components.utils.import( fileUrl.spec ) because that requires the javascript file to have EXPORTED_SYMBOLS array.
        // Components.utils.import() would cache the javascript.
        // subScriptLoader.loadSubScript() doesn't cache the javascript and it (re)evaluates it, which makes development easier
        // and the cost of reloading is not important.
        subScriptLoader.loadSubScript( moduleUrl,
            {
                SeLiteSettings: thisComponent
            }
        ); // Must specify the second parameter (the scope), otherwise there were conflicts
    }
    catch(e ) {
        e.message= 'Module ' +moduleName+ ': ' +e.message;
        throw e;
    }
    if( !(moduleName in modules) ) {
        fail( "Loaded definition of module " +moduleName+ " and it was found in preferences, but it didn't register itself properly. Make it call SeLiteSettings.register( theNewModule );" );
    }
    return modules[ moduleName ];
};

var moduleNamesFromPreferences= function( namePrefix ) {
    if( namePrefix===undefined ) {
        namePrefix= '';
    }
    if( typeof namePrefix!=='string' ) {
        throw new Error();
    }
    var prefsBranch= prefs.getBranch( namePrefix );
    var children= prefsBranch.getChildList( '', {} );
    children.sort( compareCaseInsensitively );
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

loadingPackageDefinition= false;

var EXPORTED_SYMBOLS= [
    'reservedNames',
    'VALUE_PRESENT', 'NULL',
    'SET_SELECTION_ROW', 'SELECTED_SET_NAME', 'FIELD_MAIN_ROW', 'OPTION_NOT_UNIQUE_CELL',
    'OPTION_UNIQUE_CELL', 'FIELD_TREECHILDREN', 'NEW_VALUE_ROW',
    'Field', 'Module', 'register', 'savePrefFile', 'moduleNamesFromPreferences', 'fileNameToUrl', 'loadFromJavascript',
    'VALUES_MANIFEST_FILENAME', 'ASSOCIATIONS_MANIFEST_FILENAME',
    'ASSOCIATED_SET', 'SELECTED_SET', 'VALUES_MANIFEST', 'FIELD_DEFAULT', 'FIELD_NULL_OR_UNDEFINED',
    'TestSuiteFolderInfo'
];
if( runningAsComponent ) {
    // I can load this module itself only after I set EXPORTED_SYMBOLS
    var thisComponent= {};
    Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js", thisComponent);
}