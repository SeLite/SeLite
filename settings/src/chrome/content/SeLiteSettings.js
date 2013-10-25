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
//var console = (Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console;
var runningAsComponent= (typeof window==='undefined' || window && window.location && window.location.protocol=='chrome:');
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
}

var modules= sortedObject(true); // Object serving as an associative array { string module.name => Module instance }

var SELECTED_SET_NAME= "SELITE_SETTINGS_SELECTED_SET_NAME"; // CSS also depends on its value

// SET_DEFINITION_JAVASCRIPT is an optional hidden field, which allows SeLiteSettings to load the definition automatically
var MODULE_DEFINITION_FILE_OR_URL= "SELITE_SETTINGS_MODULE_DEFINITION_FILE_OR_URL";

// Following are not field names, but they're used in the tree for metadata and for buttons that create or delete a set
var SET_SELECTION_ROW= "SELITE_SETTINGS_SET_SELECTION_ROW";
var FIELD_MAIN_ROW= "SELITE_SETTINGS_FIELD_MAIN_ROW";
var FIELD_TREECHILDREN= "SELITE_SETTINGS_FIELD_TREECHILDREN";
var NEW_VALUE_ROW= "SELITE_SETTINGS_NEW_VALUE_ROW";
var ADD_VALUE= "SELITE_SETTINGS_ADD_VALUE";
var OPTION_NOT_UNIQUE_CELL= "SELITE_SETTINGS_OPTION_NOT_UNIQUE_CELL";
var OPTION_UNIQUE_CELL= "SELITE_SETTINGS_OPTION_UNIQUE_CELL";

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
    OPTION_UNIQUE_CELL
];

var fieldNameRegex= /^[a-zA-Z0-9_/-]+$/;
var moduleNameRegex= /^[a-zA-Z0-9_/-][a-zA-Z0-9_/.-]*[a-zA-Z0-9_/-]$/;
/** Ensure that the name can be a preference module/set/field name. Module names can contain a dot
 *  but they can't start neither end with a dot, and they must be at least 2 characters long.
 *   Set/Field names and multi-value field keys can't contain dots.
 *  @param name
 *  @param description String to describe what is being checked, if the check fails.
 *  @param bool asFieldName Whether to check as a field name; otherwise it's deemed to be a field/set name. True by default
 * */
function ensureFieldName( name, description, asFieldName ) {
    var regex= asFieldName
        ? fieldNameRegex
        : moduleNameRegex;
    if( !regex.test( name ) ) {
        throw new Error( 'SeLiteSettings expect ' +description+ ' to be a valid preference name, but "' +name+ '" was passed.');
    }
}

/** @param string name Name of the field
 *  @param defaultValue mixed Default value; optional; if not set or null, then the field has a default value as fit for the particular type.
 *  If multivalued is true, TODO.
 *  <br/>defaultValues is only applied when creating a new configuration set.
 *  If loading an existing configuration set which doesn't have a value for this field,
 *  this default value is not applied - the field will stay unset.
 *  @param bool multivalued Whether the field is multivalued; false by default
 * */
var Field= function( name, defaultValue, multivalued ) {
    if( typeof name!='string' ) {
        throw new Error( 'Field() expects a string name ("primitive" string, not new String(..)).');
    }
    if( reservedNames.indexOf(name)>=0 ) {
        throw new Error( 'Field() reserves name "' +name+ '". Do not use that as a field name.');
    }
    loadingPackageDefinition || ensureFieldName( name, 'field name', true );
    this.name= name;
    
    if( typeof multivalued==='undefined') {
        multivalued= false;
    }
    if( typeof multivalued!=='boolean') {
        throw new Error( 'Field() expects multivalued to be a boolean, if provided.');
    }
    this.multivalued= multivalued;
    
    if( typeof defaultValue=='undefined' ) {
        defaultValue= null;
    }
    if( defaultValue===null && !this.multivalued ) {
        defaultValue= this.generateDefaultValue();
        if( defaultValue===null && !loadingPackageDefinition ) {
            throw new Error( "Field() requires generateDefaultValue() to return non-null." );
        }
    }
    this.defaultValue= defaultValue;
    
    if( this.defaultValue!==null && this.multivalued ) {
        throw new Error( "Field(..) expects defaultValue to be null, if multivalued is true.");
    }
    
    if( !this.name.endsWith('.prototype') ) {
        if( this.constructor==Field ) {
            throw new Error( "Can't instantiate Field directly, except for prototype instances. name: " +this.name );
        }
        //@TODO Change the following to: this.constructor within Field.Bool..
        if( !(this instanceof Field.Bool) &&
            !(this instanceof Field.Int) &&
            !(this instanceof Field.String) &&
            !(this instanceof Field.File) &&
            !(this instanceof Field.Folder) &&
            !(this instanceof Field.SQLite) && 
            !(this instanceof Field.Choice.Int) && 
            !(this instanceof Field.Choice.String)
        ) {
            throw new Error( "Can't subclass Field outside the package. name: " +this.name );
        }
        if( !loadingPackageDefinition && this.name.indexOf('.')>=0 ) {
            throw new Error( 'Field() expects name not to contain a dot, but it received: ' +this.name);
        }
    }
    else {
        if( !loadingPackageDefinition ) {
            throw new Error( "Can't define instances of Field whose name ends with '.prototype' outside the package." );
        }
    }
    this.module= null; // instance of Module that this belongs to (once registered)
};

Field.prototype.toString= function() {
    return this.constructor.name+ '[module: ' +(this.module ? this.module.name : 'unknown')+ ', name: ' +this.name+ ']';
};

/** This is used in place of parameter defaultValue to Field(), if that defaultValue is not set (or if it is null).
 *  See docs of Field().
 * */
Field.prototype.generateDefaultValue= function() {
    if( !loadingPackageDefinition ) {
        throw new Error('Override generateDefaultValue() in subclasses of Field.');
    }
    return null;
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
    if( this.module!=null ) {
        throw new Error( "Field.registerFor(module) expects 'this' Field not to be registered yet, but field '" +this.name+ "' was registered already.");
    }
    this.module= module;
};

Field.prototype.setDefault= function( setName ) {
    this.setValue( setName, this.defaultValue );
};
Field.prototype.setValue= function( setName, value ) {
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    this.setPref( setNameDot+ this.name, value );
};
/** Set a field (with the given field and key name) to the given value. It doesn't call nsIPrefService.savePrefFile()
 *  but they get saved somehow anyway.
 * */
Field.prototype.setPref= function( setFieldKeyName, value ) {
    this.module.prefsBranch.setCharPref( setFieldKeyName, value );
};

/** Only to be used with multivalued or choice fields. It doesn't call nsIPrefService.savePrefFile().
 * @param string setName May be empty.
 * @param mixed key as used to generate the preference name (key), appened after fieldName and a dot. String or number.
 * For non-choice multivalued fields it's also used as the value stored in preferences; and for Int
 * it transforms it into a number.
 * */
Field.prototype.addValue= function( setName, key ) {
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( !(this.multivalued || this instanceof Field.Choice) ) {
        throw new Error( "Use Field.addValue() only for multivalued or choice fields." );
    }
    key= ''+key;
    var value= this instanceof Field.Choice
        ? this.choicePairs[key]
        : key;
    if( (this instanceof Field.Int || this instanceof Field.Choice.Int)
    && typeof value==='string' ) {
        value= Number(value);
    }
    this.setPref( setNameDot+ this.name+ '.' +key, value );
};
/** Only to be used with multivalued or choice fields. If the key was not set, then this returns without failing.
 * It doesn't call nsIPrefService.savePrefFile().
 * @param string setName May be empty.
 * @param mixed key as used to generate the preference name (key), appened after fieldName and a dot. String or number.
 * */
Field.prototype.removeValue= function( setName, key ) {
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( !this.multivalued && !(this instanceof Field.Choice) ) {
        throw new Error( "Use Field.removeValue() only for multivalued or choice fields." );
    }
    if( this.module.prefsBranch.prefHasUserValue(setNameDot+this.name+ '.' +key) ) {
        this.module.prefsBranch.clearUserPref( setNameDot+this.name+ '.' +key)
    }
};

/** @return bool
 * */
Field.prototype.equals= function( other ) {
    return this.name===other.name
        && this.constructor==other.constructor
        && this.defaultValue===other.defaultValue; // Strict comparison is OK for primitive string/bool/int
};

// See also https://developer.mozilla.org/en/Introduction_to_Object-Oriented_JavaScript#Inheritance
Field.Bool= function( name, defaultValue ) {
    Field.call( this, name, defaultValue );
    if( this.defaultValue!==null && typeof this.defaultValue!='boolean' ) {
        throw new Error( "Field.Bool(..) expects defaultValue to be a boolean (primitive), if provided.");
    }
};
Field.Bool.prototype= new Field('Bool.prototype');
Field.Bool.prototype.constructor= Field.Bool;
Field.Bool.prototype.generateDefaultValue= function() { return false; };
Field.Bool.prototype.setPref= function( setFieldKeyName, value ) {
    this.module.prefsBranch.setBoolPref( setFieldKeyName, value );
};

Field.Int= function( name, defaultValue, multivalued ) {
    Field.call( this, name, defaultValue, multivalued );
    if( this.defaultValue!==null && typeof this.defaultValue!='number' ) {
        throw new Error( "Field.Int(..) expects defaultValue to be a number (primitive), if provided.");
    }
};
Field.Int.prototype= new Field('Int.prototype');
Field.Int.prototype.constructor= Field.Int;
Field.Int.prototype.generateDefaultValue= function() { return 0; };
Field.Int.prototype.setPref= function( setFieldKeyName, value ) {
    this.module.prefsBranch.setIntPref( setFieldKeyName, value );
};
/** This works even if one or both parameters are strings - it transforms them into numbers.
 *  We need this for XUL GUI setCellText handler.
 * */
Field.Int.prototype.compareValues= function( firstValue, secondValue ) {
    return compareAsNumbers(firstValue, secondValue );
}

Field.String= function( name, defaultValue, multivalued ) {
    Field.call( this, name, defaultValue, multivalued );
    if( this.defaultValue!==null && typeof this.defaultValue!='string' ) {
        throw new Error( "Field.String(..) expects defaultValue to be a string ('primitive'), if provided.");
    }
};
Field.String.prototype= new Field('String.prototype');
Field.String.prototype.constructor= Field.String;
Field.String.prototype.generateDefaultValue= function() { return ''; };

/** @param string name
 *  @param bool startInProfileFolder Whether the file/folder picker dialog opens in user's Firefox profile folder (if the file/folder was not set yet)
 *  @param filters Optional, an object serving as an associative array of file filters { 'visible filter name': '*.extension; *.anotherExtension...', ... }
 *  A false/null/0 key or value mean 'All files'.
 *  See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFilePicker#appendFilter%28%29
 *  @param defaultValue
 *  @param bool multivalued
 *  @param bool isFolder Whether this is for folder(s); otherwise it's for file(s)
 * */
Field.FileOrFolder= function( name, startInProfileFolder, filters, defaultValue, multivalued, isFolder ) {
    Field.call( this, name, defaultValue, multivalued );
    this.startInProfileFolder= startInProfileFolder || false;
    if( typeof this.startInProfileFolder!='boolean' ) {
        throw new Error( 'Field.FileOrFolder() expects startInProfileFolder to be a boolean, if provided.');
    }
    this.filters= filters || {};
    if( typeof(this.filters)!='object' || this.filters instanceof Array ) {
        throw new Error( 'Field.FileOrFolder() expects filters to be an object serving as an associative array, if provided.');
    }
    if( this.defaultValue!==null && typeof this.defaultValue!='string' ) {
        throw new Error( "Field.FileOrFolder(..) expects defaultValue to be a string ('primitive') - a file path, if provided.");
    }
    this.isFolder= isFolder || false;
    ensureType( this.isFolder, 'boolean', "Field.FileOrFolder(..) expects isFolder to be a boolean, if provided." );
}
Field.FileOrFolder.prototype= new Field('FileOrFolder.prototype');
Field.FileOrFolder.prototype.constructor= Field.FileOrFolder;
Field.FileOrFolder.prototype.generateDefaultValue= function() { return ''; };

Field.FileOrFolder.prototype.parentEquals= Field.FileOrFolder.prototype.equals;
Field.FileOrFolder.prototype.equals= function( other ) {
    if( !this.parentEquals(other)
    || this.startInProfileFolder!==other.startInProfileFolder
    || this.defaultValue!==other.defaultValue
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
Field.File= function( name, startInProfileFolder, filters, defaultValue, multivalued ) {
    Field.FileOrFolder.call( this, name, startInProfileFolder, filters, defaultValue, multivalued, false );
};
Field.File.prototype= new Field.FileOrFolder('File.prototype');
Field.File.prototype.constructor= Field.File;
Field.File.prototype.generateDefaultValue= function() { return ''; };

/** @param string name
 *  @param bool startInProfileFolder See Field.FileOrFolder()
 *  @param filters See Field.FileOrFolder()
 * */
Field.Folder= function( name, startInProfileFolder, filters, defaultValue, multivalued ) {
    Field.FileOrFolder.call( this, name, startInProfileFolder, filters, defaultValue, multivalued, true );
};
Field.Folder.prototype= new Field.FileOrFolder('Folder.prototype');
Field.Folder.prototype.constructor= Field.Folder;
Field.Folder.prototype.generateDefaultValue= function() { return ''; };

Field.SQLite= function( name, defaultValue ) {
    Field.File.call( this, name, true, { 'SQLite': '*.sqlite', 'any': null}, defaultValue );
};
Field.SQLite.prototype= new Field.File('SQLite.prototype', false, {}, '' );
Field.SQLite.prototype.constructor= Field.SQLite;

/** @param defaultValue It's actually a key (Preferences subfield name), not the visible integer/string value.
 *  @param choicePairs Anonymous object serving as an associative array {
 *      string key => string/number ('primitive') label
 *  } It's not clear what is intuitive here. However, with this format, the type and positioning of
 *  label reflects how it is shown when using Firefox url about:config.
 *  Also, Javascript transforms object field/key names to strings, even if they were set to integer.
 * */
Field.Choice= function( name, defaultValue, multivalued, choicePairs ) {
    Field.call( this, name, defaultValue, multivalued );
    if( this.defaultValue!==null && typeof this.defaultValue!='string' ) {
        throw new Error( "Field.Choice(..) expects defaultValue to be a string ('primitive'), if provided.");
    }
    if( !loadingPackageDefinition && this.constructor==Field.Choice ) {
        throw new Error( "Can't define instances of Field.Choice class itself outside the package. Use Field.Choice.Int or Field.Choice.String." );
    }
    if( !loadingPackageDefinition && (typeof choicePairs!=='object' || choicePairs.constructor.name==='Array') ) {
        throw new Error( "Instances of subclasses of Field.Choice require choicePairs to be an anonymous object serving as an associative array." );
    }
    this.choicePairs= choicePairs;
};
Field.Choice.prototype= new Field('Choice.prototype');
Field.Choice.prototype.constructor= Field.Choice;
Field.Choice.prototype.generateDefaultValue= function() {
    if( this.multivalued ) {
        throw new Error( 'Do not use Field.Choice.generateDefaultValue() for multivalued fields.');
    }
    for( var key in this.choicePairs ) { // Just return the first one.
        return key;
    }
    return null;
};
Field.Choice.prototype.compareValues= function() {
    throw new Error( 'Do not use Field.Choice.compareValues(). Sort choicePairs yourself.');
};
Field.Choice.prototype.setDefault= function() {
    throw new Error("Do not call setDefault() on Field.Choice family.");
};
Field.Choice.prototype.setValue= function() {
    throw new Error("Do not call setValue() on Field.Choice family.");
};
Field.Choice.prototype.setPref= Field.prototype.setPref;

Field.Choice.Int= function( name, defaultValue, multivalued, choicePairs ) {
    Field.Choice.call( this, name, defaultValue, multivalued, choicePairs );
    for( var key in this.choicePairs ) {
        var value= this.choicePairs[key];
        if( typeof value!=='number' || value!==Math.round(value) ) {
            throw new Error( 'Field.Choice.Int() expects values in choicePairs to be integers, but for key ' +key+
                ' it has ' +(typeof value)+ ' - ' +value );
        }
    }
};
Field.Choice.Int.prototype= new Field.Choice('ChoiceInt.prototype');
Field.Choice.Int.prototype.constructor= Field.Choice.Int;
Field.Choice.Int.prototype.setPref= Field.Int.prototype.setPref;

Field.Choice.String= function( name, defaultValue, multivalued, choicePairs ) {
    Field.Choice.call( this, name, defaultValue, multivalued, choicePairs );
    for( var key in this.choicePairs ) {
        var value= this.choicePairs[key];
        if( typeof value!=='string' ) {
            throw new Error( 'Field.Choice.String() expects values in choicePairs to be strings, but for key ' +key+
                ' it has ' +(typeof value)+ ' - ' +value );
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
    ensureFieldName( name, 'module name');
    if( typeof fields!=='object' || !fields.constructor || fields.constructor.name!=='Array' ) {
        // @TODO my docs I can't check (fields instanceof Array) neither (fields.constructor===Array) when this script a component. It must be caused by JS separation.
        throw new Error( 'Module() expects an array fields, but it received ' +(typeof fields)+ ' - ' +fields);
    }
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
    defaultSetName===null || ensureFieldName( defaultSetName, 'defaultSetName' );
    
    this.associatesWithFolders= associatesWithFolders || false;
    ensureType( this.associatesWithFolders, 'boolean', 'Module() expects associatesWithFolders to be a boolean, if provided.');
    !this.associatesWithFolders || ensure(this.allowSets, 'Module() must be called with allowSets=true, if associatesWithFolders is true.' );
    
    this.definitionJavascriptFile= definitionJavascriptFile || null;
    if( this.definitionJavascriptFile!=null && typeof this.definitionJavascriptFile!='string') {
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
        
        if( !compareAllFields(existingModule.fields, module.fields, 'equals') ) {
            throw new Error( 'There already exists a module with name "' +module.name+ '" but it has different definition.');
        }
        if( module.allowSets!==existingModule.allowSets ) {
            throw new Error();
        }
        if( module.defaultSetName!==existingModule.defaultSetName ) {
            throw new Error();
        }
        if( module.definitionJavascriptFile!==existingModule.definitionJavascriptFile ) {
            throw new Error();
        }
        module= existingModule;
    }
    else {
        modules[module.name]= module;
    }
    if( typeof createOrUpdate=='undefined') {
        createOrUpdate= true;
    }
    if( createOrUpdate ) {
        module.register();
    }
    return module;
};

/** Like nsIPrefBranch.getChildList(), but it
 *  - returns direct children only (i.e. not ones that contain dot(s) in the name right from the given namePrefix)
 *  - returns direct virtual child, i.e. a name at direct child level, which is a parent of any grand/great grand children, even if there
 *    is no field at direct child level itself. It returns it without the trailing dot
 *  - without the prefix (namePrefix) - i.e. it removes the prefix
 *  See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIPrefBranch#getChildList()
 * */
function directChildList( prefsBranch, namePrefix ) {
    if( typeof namePrefix=='undefined' || namePrefix===null) {
        namePrefix= '';
    }
    var children= prefsBranch.getChildList( namePrefix,{} );
    var result= [];
    
    var namePrefixLength= namePrefix.length;
    for( var i=0; i<children.length; i++ ) {
        var child= children[i];
        
        var postfix= child.substring( namePrefixLength );
        var indexOfDot= postfix.indexOf('.');
        if( indexOfDot<0 ) {
            result.push( postfix );
        }
        else {
            postfix= postfix.substring( 0, indexOfDot);
            if( result.indexOf(postfix)<0 ) {
                result.push( postfix );
            }
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
    ensureFieldName( setName, 'setName' );
    this.prefsBranch.setCharPref( SELECTED_SET_NAME, setName );
};

/** @param setName Name of the set; an empty string if the module doesn't allow sets, or if you want a selected set.
 *  @param boolean perFolder Whether this is loaded per folder, as a part of a composite configuration. If true,
 *  then this doesn't generate entries for multivalued and Field.Choice fields that have no value in the given set.
 *  @return Object with sorted keys, serving as associative array {
 *      string field name => string/boolean/number ('primitive') value
 *      -- for non-choice single-value fields, and
 *      -- for fields not defined in this.fields
 *      string choice or (non-choice and multi-value) field name => array{
 *          string key => string/number ('primitive') label or value entered by user
 *      }
 *      -- this is present for all choice and for all non-choice multi-value fields,
 *      including those that don't have any value in Preferences DB,
 *      unless this.associatesWithFolders && perFolder.
 *  }
 *  It also includes any values of fields that are not defined in this.fields, but are present in the preferences.
 *  It excludes any single-value fields defined in this.fields with no value stored in the preferences.
 * */
Module.prototype.getFieldsOfSet= function( setName, perFolder ) {
    perFolder= perFolder || false;
    ensure( !perFolder || this.associatesWithFolders, "getFieldsOfSet() accepts parameter perFolder=true only if module.associatesWithFolders is true." );
    if( typeof setName=='undefined' || setName===null ) {
        setName= this.allowSets
            ? this.selectedSetName()
            : '';
    }
    if( setName!=='' ) {
        setName+= '.';
    }
    var children= this.prefsBranch.getChildList( setName, {} );
    children.sort( compareCaseInsensitively );
    var result= sortedObject(true);
    
    for( var i=0; i<children.length; i++ ) {
        var child= children[i].substring( setName.length );
        if( reservedNames.indexOf(child)<0 ) {
            var prefName= setName+child;
            var type= this.prefsBranch.getPrefType( prefName );

            var value= null;
            if( type==nsIPrefBranch.PREF_STRING ) {
                value= this.prefsBranch.getCharPref(prefName);
            }
            else if( type==nsIPrefBranch.PREF_BOOL ) {
                value= this.prefsBranch.getBoolPref(prefName);
            }
            else if( type==nsIPrefBranch.PREF_INT ) {
                value= this.prefsBranch.getIntPref(prefName);
            }
            if( !this.fields[child] ) {
                // child may be a multivalued entry or a choice.
                var indexOfDot= child.indexOf('.');
                if( indexOfDot>0 ) {
                    var fieldName= child.substring(0, indexOfDot );
                    var field= this.fields[fieldName];
                    if( field && (field.multivalued || field instanceof Field.Choice) ) {
                        if( !result[fieldName]
                            || typeof result[fieldName]!=='object' // In case there is an orphan/sick single value for fieldName itself, e.g. after you change field definition from single-value to multivalued
                        ) {
                            // When presenting Field.Choice, they are not sorted by stored values but by keys from the field definition.
                            // So I only use sortedObject for multivalued fields other than Field.Choice
                            result[fieldName]= field.multivalued && !(field instanceof Field.Choice)
                                ? sortedObject( field.compareValues )
                                : {};
                        }
                        var key= child.substring( indexOfDot+1 );
                        result[fieldName][ key ]= value;
                        continue;
                    }
                }
            }
            result[ child ]= value; // anonymous, undefined field
        }
    }
    if( !(this.associatesWithFolders && perFolder) ) {
        // @TODO for file inheritance/overriding: Fill in any empty multivalued or choice fields.
        for( var fieldName in this.fields ) {
            var field= this.fields[fieldName];
            if( field.multivalued || field instanceof Field.Choice ) {
                if( !result[fieldName] ) {
                    // Like above, I only use sortedObject for multivalued fields other than Field.Choice
                    result[fieldName]= field.multivalued && !(field instanceof Field.Choice)
                        ? sortedObject( field.compareValues )
                        : {};
                }
            }
        }
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
    }
    catch( exception ) {
        return false;
    }
    var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
              createInstance(Components.interfaces.nsIFileInputStream);
    var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
                  createInstance(Components.interfaces.nsIConverterInputStream);
    fstream.init(file, -1, -1, 0);
    cstream.init(fstream, "UTF-8", 0, 0);

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

const VALUES_MANIFEST= 'SeLiteSettingsValues.txt';
const ASSOCIATIONS_MANIFEST= 'SeLiteSettingsAssociations.txt';

var commentLineRegex= /^[ \t]*#.*$/;
/** @param string contents
 *  @return array Line(s) without those that were purely comments, or empty lines.
 * */
function removeCommentsGetLines( contents ) {
    var lines= contents.split("\n");
    var result= [];
    for( var j=0; j<lines.length; j++ ) {
        var line= lines[j];
        if( !line.test(commentLineRegex) && !line.trim()==='' ) {
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
 *      values: array, for values manifests, starting from the root folder, down to given folderPath;
 *          values from same manifest file are consecutive entries
 *          [
 *              anonymous object {
 *                  moduleName: string,
 *                  fieldName: string,
 *                  value: string
 *              },
 *              ...
 *          ],
 *      associations: array, for association manifests, starting from the root folder, down to given folderPath
 *          associations from same manifest file are consecutive entries
 *          [
 *              anonymous object {
 *                  moduleName: string,
 *                  setName: string
 *              },
 *              ...
 *          ]
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
    
    var values= [];
    var associations= [];
    
    for( var i=0; i<folderNames.length; i++) {
        var folder=  folderNames[i];
        var contents= new readFile( OS.File.join(folder, VALUES_MANIFEST) );
        if( contents!==false ) {
            var lines= removeCommentsGetLines(contents);
            for( var j=0; j<lines.length; j++ ) {
                var parts= valuesLineRegex.exec( lines[j] );
                if( parts ) {
                    values.push( {
                        moduleName: parts[1],
                        fieldName: parts[2],
                        value: parts[4] // This is always non-null (it can be an empty string)
                    } );
                }
                else {
                    //@TODO Console.error
                }
            }
        }
        
        var contents= new readFile( OS.File.join(folder, ASSOCIATIONS_MANIFEST) );
        if( contents!==false ) {
            var lines= removeCommentsGetLines(contents);
            for( var j=0; j<lines.length; j++ ) {
                var parts= associationLineRegex.exec( lines[j] );
                if( parts ) {
                    associations.push( {
                        moduleName: parts[1],
                        setName: parts[2]
                    } );
                }
                else {
                    //@TODO Console.error
                }
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

/** Calculate composition of field values, based on manifests and preferences,
 *  down from filesystem root to given folderPath.
 *  @param string folderPath Full path (absolute) to the folder where your test suite is.
 *  @param bool dontCache If true, then this doesn't cache manifest files (it doesn't use any
 *  previous manifests stored in the cache and it doesn't store current manifests in the cache). For use by GUI.
 *  @return Object with sorted keys, serving as an associative array. A bit similar to result of getFieldsOfset(),
 *  but with more information and more structure: {
 *      string field name => string/boolean/number ('primitive') value
 *      -- for non-choice single-value fields, and
 *      -- for fields not defined in this.fields
 *      string choice or (non-choice and multi-value) field name => array{
 *          string key => string/number ('primitive') label or value entered by user
 *      }
 *      -- this excludes choice and non-choice multi-value fields that don't have any value in values manifests neither in any associated preferences
 *  }
 *  It also includes any values of fields that are not defined in this.fields, but are present in values manifests or associated preferences.
 *  It excludes any single-value fields defined in this.fields with no value stored in the preferences.
 *  }
* */
Module.prototype.getFieldsDownToFolder= function( folderPath, dontCache ) {
    dontCache= dontCache || false;
    var manifests= manifestsDownToFolder(dontCache);
    var result= sortedObject(true);
    
    // First, load values from values manifests.
    for( var i=0; i<manifests.values.length; i++ ) {
        var manifest= manifests.values[i];
        if( manifest.moduleName==this.name ) {
            
        }
    }
    // Second, load a 'global' set - one that is marked as active (if any).
    for( var i=0; i<manifests.associations.length; i++ ) {
        var manifest= associations.values[i];
        if( manifest.moduleName==this.name ) {
            
        }
    }
    
    // Third, load sets associated via associations manifests. They override values from any values manifests.
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
    prefs.savePrefFile( null );
};

/** (Re)create a set of the given name - create it, or add any missing fields.
 *  @param setName string name of the set to create/update; optional. If empty or null, it operates on the main & only set.
 * */
Module.prototype.createSet= function( setName ) {
    if( typeof setName=='undefined' || setName===null ) {
        setName= '';
    }
    if( typeof setName!='string' ) {
        throw new Error( "Module.createOrUpdateSet(setName) expects optional setName to be a string, if provided.");
    }
    if( setName!=='' ) {
        ensureFieldName( setName, 'set name');
    }
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( !this.associatesWithFolders ) { // Don't populate default values for modules that associate with folders, because they inherit values
        for( var fieldName in this.fields ) {
            var field= this.fields[fieldName];
            if( !field.multivalued ) {
                if( !(field instanceof Field.Choice) ) {
                    if( !this.prefsBranch.prefHasUserValue(setNameDot+fieldName) ) {
                        field.setDefault( setName ); // That adds a dot, if necessary
                    }
                }
                else {
                    var children= this.prefsBranch.getChildList( setNameDot+fieldName+'.', {} );
                    for( var child in children );
                    if( typeof child==='undefined' ) {
                        field.addValue( setNameDot, field.defaultValue );
                    }
                }
            }
        }
    }
    else {
        ensure( setName!=='', 'Module associates with folders, therefore a set name cannot be empty.' );
        // Since we don't populate default values of sets that associate with folders, I need to store something in preferences
        // to represent the set. So I use an empty string value.
        this.prefsBranch.setCharPref( setName, '');
    }
};

/** Remove the set of the given name.
    @param setName string name of the set to create/update. If empty, it operates on the main & only set.
 * */
Module.prototype.removeSet= function( setName ) {
    if( typeof setName==='undefined' ) {
        setName= '';
    }
    if( typeof setName!='string' ) {
        throw new Error( "Module.createOrUpdateSet(setName) expects optional setName to be a string.");
    }
    if( setName!=='' ) {
        ensureFieldName( setName, 'set name');
        setName+= '.';
    }
    for( var fieldName in this.fields ) {
        var field= this.fields[fieldName];
        if( field.multivalued || field instanceof Field.Choice ) {
            this.prefsBranch.deleteBranch( setName+fieldName+'.' );
        }
        else
        if( this.prefsBranch.prefHasUserValue(setName+fieldName) ) {
            this.prefsBranch.clearUserPref( setName+fieldName );
        }
    }
};

/** Load & register the module from its Javascript file, if stored in preferences.
 *  The file will be cached - any changes will have affect only once you reload Firefox.
 *  If called subsequently, it returns an already loaded instance.
 *  @param moduleName string Name of the preference path/prefix up to the module (including the module name), excluding the trailing dot
 *  @return Module instance
 *  @throws an error if no such preference branch, or preferences don't contain javascript file, or the javascript file doesn't exist.
 * */
var loadFromJavascript= function( moduleName ) {
    if( modules[ moduleName ] ) {
        return modules[ moduleName ];
    }
    var prefsBranch= prefs.getBranch( moduleName+'.' );
    if( prefsBranch.prefHasUserValue(MODULE_DEFINITION_FILE_OR_URL) ) {
        var fileNameOrUrl= prefsBranch.getCharPref(MODULE_DEFINITION_FILE_OR_URL);
        var url;
        try {
            var file= new FileUtils.File(fileNameOrUrl);
            url= Services.io.newFileURI( file );
        }
        catch( exception ) {
            url= nsIIOService.newURI( fileNameOrUrl, null, null);
        }
        try {
            // I don't use Components.utils.import( fileUrl.spec ) because that requires the javascript file to have EXPORTED_SYMBOLS array.
            // Components.utils.import() would cache the javascript.
            // subScriptLoader.loadSubScript() doesn't cache the javascript and it (re)evaluates it, which makes development easier
            // and the cost of reloading is not important.
            subScriptLoader.loadSubScript( url.spec, {} ); // Must specify {} as scope, otherwise there were conflicts
        }
        catch(error ) {
            throw error;
        }
    }
    else {
        throw new Error( "Can't find module '" +moduleName+ "'.");
    }
    if( !(moduleName in modules) ) {
        throw new Error();
    }
    return modules[ moduleName ];
};

var moduleNamesFromPreferences= function( namePrefix ) {
    if( typeof namePrefix==='undefined' ) {
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
    'SET_SELECTION_ROW', 'SELECTED_SET_NAME', 'FIELD_MAIN_ROW', 'OPTION_NOT_UNIQUE_CELL',
    'OPTION_UNIQUE_CELL', 'FIELD_TREECHILDREN', 'NEW_VALUE_ROW',
    'Field', 'Module', 'register', 'savePrefFile', 'moduleNamesFromPreferences', 'loadFromJavascript',
    'VALUES_MANIFEST', 'ASSOCIATIONS_MANIFEST',
    'manifestsDownToFolder'
];