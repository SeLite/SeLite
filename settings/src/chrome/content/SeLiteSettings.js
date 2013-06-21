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

var runningAsComponent= (typeof window==='undefined' || window && window.location && window.location.protocol=='chrome:'); // When set to false, this can be loaded via <script src="file://..."> rather than via Components.utils.import(). Used for limited debugging only. Can't use <script src="chrome://...">

// Whether this file is being loaded.
var loadingPackageDefinition= true;

if( runningAsComponent ) {
    // prefs is an instance of nsIPrefBranch
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    Components.utils.import("resource://gre/modules/Services.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import( "chrome://selite-misc/content/extensions/selite-misc.js" );
    var nsIPrefBranch= Components.interfaces.nsIPrefBranch;
    var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    var nsIIOService= Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);    
}

function SeLiteSettings() {
    throw new Error( "Do not instantiate SeLiteSettings");
}

SeLiteSettings.modules= {}; // Object serving as an associative array { string module.name => SeLiteSettings.Module instance }

SeLiteSettings.SELECTED_SET_NAME= "SELITE_SETTINGS_SELECTED_SET_NAME", // CSS also depends on its value

// SET_DEFINITION_JAVASCRIPT is an optional hidden field, which allows SeLiteSettings to load the definition automatically
SeLiteSettings.MODULE_DEFINITION_FILE_OR_URL= "SELITE_SETTINGS_MODULE_DEFINITION_FILE_OR_URL";

// Following are not field names, but they're used in the tree for metadata and for buttons that create or delete a set
SeLiteSettings.SET_SELECTION_ROW= "SELITE_SETTINGS_SET_SELECTION_ROW";
SeLiteSettings.FIELD_MAIN_ROW= "SELITE_SETTINGS_FIELD_MAIN_ROW";
SeLiteSettings.FIELD_TREECHILDREN= "SELITE_SETTINGS_FIELD_TREECHILDREN";
SeLiteSettings.NEW_VALUE_ROW= "SELITE_SETTINGS_NEW_VALUE_ROW";
SeLiteSettings.ADD_VALUE= "SELITE_SETTINGS_ADD_VALUE";
SeLiteSettings.OPTION_NOT_UNIQUE_CELL= "SELITE_SETTINGS_OPTION_NOT_UNIQUE_CELL";
SeLiteSettings.OPTION_UNIQUE_CELL= "SELITE_SETTINGS_OPTION_UNIQUE_CELL";

/** @return a new array of strings that are reserved names. Don't share an existing array - just in case a client code modifies it by mistake.
 * */
SeLiteSettings.reservedNames= function() {
    return [
        SeLiteSettings.SELECTED_SET_NAME,
        SeLiteSettings.MODULE_DEFINITION_FILE_OR_URL,
        SeLiteSettings.SET_SELECTION_ROW,
        SeLiteSettings.FIELD_MAIN_ROW,
        SeLiteSettings.FIELD_TREECHILDREN,
        SeLiteSettings.NEW_VALUE_ROW,
        SeLiteSettings.ADD_VALUE,
        SeLiteSettings.OPTION_NOT_UNIQUE_CELL,
        SeLiteSettings.OPTION_UNIQUE_CELL
    ];
};

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
 *  If multivalued is true, then defaultValue must be null. Otherwise what would we do when
 *  - a user removes/deselects all values for the field
 *  - the module definition gets loaded
 *  That would re-activate the default values for this field, because the field has none. That is the behaviour we want for
 *  single valued fields, so that if we add a new field to the module definition Javascript, the field will get auto created
 *  with its default value in all sets of that module.
 *  @param bool multivalued Whether the field is multivalued; false by default
 * */
SeLiteSettings.Field= function( name, defaultValue, multivalued ) {
    if( typeof name!='string' ) {
        throw new Error( 'SeLiteSettings.Field() expects a string name ("primitive" string, not new String(..)).');
    }
    if( SeLiteSettings.reservedNames().indexOf(name)>=0 ) {
        throw new Error( 'SeLiteSettings.Field() reserves name "' +name+ '". Do not use that as a field name.');
    }
    loadingPackageDefinition || ensureFieldName( name, 'field name', true );
    this.name= name;
    
    if( typeof multivalued==='undefined') {
        multivalued= false;
    }
    if( typeof multivalued!=='boolean') {
        throw new Error( 'SeLiteSettings.Field() expects multivalued to be a boolean, if provided.');
    }
    this.multivalued= multivalued;
    
    if( typeof defaultValue=='undefined' ) {
        defaultValue= null;
    }
    if( defaultValue===null && !this.multivalued ) {
        defaultValue= this.generateDefaultValue();
        if( defaultValue===null && !loadingPackageDefinition ) {
            throw new Error( "SeLiteSettings.Field() requires generateDefaultValue() to return non-null." );
        }
    }
    this.defaultValue= defaultValue;
    
    if( this.defaultValue!==null && this.multivalued ) {
        throw new Error( "SeLiteSettings.Field(..) expects defaultValue to be null, if multivalued is true.");
    }
    
    if( !this.name.endsWith('.prototype') ) {
        if( this.constructor==SeLiteSettings.Field ) {
            throw new Error( "Can't instantiate SeLiteSettings.Field directly, except for prototype instances. name: " +this.name );
        }
        if( !(this instanceof SeLiteSettings.Field.Bool) &&
            !(this instanceof SeLiteSettings.Field.Int) &&
            !(this instanceof SeLiteSettings.Field.String) &&
            !(this instanceof SeLiteSettings.Field.File) &&
            !(this instanceof SeLiteSettings.Field.SQLite) && 
            !(this instanceof SeLiteSettings.Field.Choice.Int) && 
            !(this instanceof SeLiteSettings.Field.Choice.String)
        ) {
            throw new Error( "Can't subclass SeLiteSettings.Field outside the package. name: " +this.name );
        }
        if( !loadingPackageDefinition && this.name.indexOf('.')>=0 ) {
            throw new Error( 'SeLiteSettings.Field() expects name not to contain a dot, but it received: ' +this.name);
        }
    }
    else {
        if( !loadingPackageDefinition ) {
            throw new Error( "Can't define instances of SeLiteSettings.Field whose name ends with '.prototype' outside the package." );
        }
    }
    this.module= null; // instance of SeLiteSettings.Module that this belongs to (once registered)
};

SeLiteSettings.Field.prototype.toString= function() {
    return this.constructor.name+ '[module: ' +(this.module ? this.module.name : 'unknown')+ ', name: ' +this.name+ ']';
};

/** This is used in place of parameter defaultValue to SeLiteSettings.Field(), if that defaultValue is not set.
 *  See docs of SeLiteSettings.Field().
 * */
SeLiteSettings.Field.prototype.generateDefaultValue= function() {
    if( !loadingPackageDefinition ) {
        throw new Error('Override generateDefaultValue() in subclasses of SeLiteSettings.Field.');
    }
    return null;
};

/** Used when sorting multivalued non-choice fields. By default we use
 *  case insensitive comparison for Field.String numeric comparison for Field.Number.
 *  @param string/number firstValue
 *  @param string/number secondValue
 *  @return int -1, 0, or 1, see compareCaseInsensitively()
 * */
SeLiteSettings.Field.prototype.compareValues= function( firstValue, secondValue ) {
    return compareCaseInsensitively( firstValue, secondValue );
};

SeLiteSettings.Field.prototype.registerFor= function( module ) {
    if( !(module instanceof SeLiteSettings.Module) ) {
        throw new Error( "SeLiteSettings.Field.registerFor(module) expects module to be an instance of SeLiteSettings.Module.");
    };
    if( this.module!=null ) {
        throw new Error( "SeLiteSettings.Field.registerFor(module) expects 'this' Field not to be registered yet, but field '" +this.name+ "' was registered already.");
    }
    this.module= module;
};

SeLiteSettings.Field.prototype.setDefault= function( setName ) {
    this.setValue( setName, this.defaultValue );
};
SeLiteSettings.Field.prototype.setValue= function( setName, value ) {
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    this.setPref( setNameDot+ this.name, value );
};
/** Set a field (with the given field and key name) to the given value. It doesn't call nsIPrefService.savePrefFile().
 * */
SeLiteSettings.Field.prototype.setPref= function( setFieldKeyName, value ) {
    this.module.prefsBranch.setCharPref( setFieldKeyName, value );
};

/** Only to be used with multivalued or choice fields. It doesn't call nsIPrefService.savePrefFile().
 * @param string setName May be empty.
 * @param mixed key as used to generate the preference name (key), appened after fieldName and a dot. String or number.
 * For non-choice multivalued fields it's also used as the value stored in preferences; and for Int
 * it transforms it into a number.
 * */
SeLiteSettings.Field.prototype.addValue= function( setName, key ) {
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( !(this.multivalued || this instanceof SeLiteSettings.Field.Choice) ) {
        throw new Error( "Use SeLiteSettings.Field.addValue() only for multivalued or choice fields." );
    }
    key= ''+key;
    var value= this instanceof SeLiteSettings.Field.Choice
        ? this.choicePairs[key]
        : key;
    if( (this instanceof SeLiteSettings.Field.Int || this instanceof SeLiteSettings.Field.Choice.Int)
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
SeLiteSettings.Field.prototype.removeValue= function( setName, key ) {
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    if( !this.multivalued && !(this instanceof SeLiteSettings.Field.Choice) ) {
        throw new Error( "Use SeLiteSettings.Field.removeValue() only for multivalued or choice fields." );
    }
    if( this.module.prefsBranch.prefHasUserValue(setNameDot+this.name+ '.' +key) ) {
        this.module.prefsBranch.clearUserPref( setNameDot+this.name+ '.' +key)
    }
};

/** @return bool
 * */
SeLiteSettings.Field.prototype.equals= function( other ) {
    return this.name===other.name
        && this.constructor==other.constructor
        && this.defaultValue===other.defaultValue; // Strict comparison is OK for primitive string/bool/int
};

// See also https://developer.mozilla.org/en/Introduction_to_Object-Oriented_JavaScript#Inheritance
SeLiteSettings.Field.Bool= function( name, defaultValue ) {
    SeLiteSettings.Field.call( this, name, defaultValue );
    if( this.defaultValue!==null && typeof this.defaultValue!='boolean' ) {
        throw new Error( "SeLiteSettings.Field.Bool(..) expects defaultValue to be a boolean (primitive), if provided.");
    }
};
SeLiteSettings.Field.Bool.prototype= new SeLiteSettings.Field('Bool.prototype');
SeLiteSettings.Field.Bool.prototype.constructor= SeLiteSettings.Field.Bool;
SeLiteSettings.Field.Bool.prototype.generateDefaultValue= function() { return false; };
SeLiteSettings.Field.Bool.prototype.setPref= function( setFieldKeyName, value ) {
    this.module.prefsBranch.setBoolPref( setFieldKeyName, value );
};

SeLiteSettings.Field.Int= function( name, defaultValue, multivalued ) {
    SeLiteSettings.Field.call( this, name, defaultValue, multivalued );
    if( this.defaultValue!==null && typeof this.defaultValue!='number' ) {
        throw new Error( "SeLiteSettings.Field.Int(..) expects defaultValue to be a number (primitive), if provided.");
    }
};
SeLiteSettings.Field.Int.prototype= new SeLiteSettings.Field('Int.prototype');
SeLiteSettings.Field.Int.prototype.constructor= SeLiteSettings.Field.Int;
SeLiteSettings.Field.Int.prototype.generateDefaultValue= function() { return 0; };
SeLiteSettings.Field.Int.prototype.setPref= function( setFieldKeyName, value ) {
    this.module.prefsBranch.setIntPref( setFieldKeyName, value );
};
/** This works even if one or both parameters are strings - it transforms them into numbers.
 *  We need this for XUL GUI setCellText handler.
 * */
SeLiteSettings.Field.Int.prototype.compareValues= function( firstValue, secondValue ) {
    return compareAsNumbers(firstValue, secondValue );
}

SeLiteSettings.Field.String= function( name, defaultValue, multivalued ) {
    SeLiteSettings.Field.call( this, name, defaultValue, multivalued );
    if( this.defaultValue!==null && typeof this.defaultValue!='string' ) {
        throw new Error( "SeLiteSettings.Field.String(..) expects defaultValue to be a string ('primitive'), if provided.");
    }
};
SeLiteSettings.Field.String.prototype= new SeLiteSettings.Field('String.prototype');
SeLiteSettings.Field.String.prototype.constructor= SeLiteSettings.Field.String;
SeLiteSettings.Field.String.prototype.generateDefaultValue= function() { return ''; };

/** @param string name
 *  @param bool startInProfileFolder Whether the file picker dialog opens in user's Firefox profile folder (if the file was not set yet)
 *  @param filters Optional, an object serving as an associative array of file filters { 'visible filter name': '*.extension; *.anotherExtension...', ... }
 *  A false/null/0 key or value mean 'All files'.
 *  See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFilePicker#appendFilter%28%29
 * */
SeLiteSettings.Field.File= function( name, startInProfileFolder, filters, defaultValue ) {
    SeLiteSettings.Field.call( this, name, defaultValue );
    this.startInProfileFolder= startInProfileFolder || false;
    if( typeof this.startInProfileFolder!='boolean' ) {
        throw new Error( 'SeLiteSettings.Field.File() expects startInProfileFolder to be a boolean, if provided.');
    }
    this.filters= filters || {};
    if( typeof(this.filters)!='object' || this.filters instanceof Array ) {
        throw new Error( 'SeLiteSettings.Field.File() expects filters to be an object serving as an associative array, if provided.');
    }
    if( this.defaultValue!==null && typeof this.defaultValue!='string' ) {
        throw new Error( "SeLiteSettings.Field.File(..) expects defaultValue to be a string ('primitive') - a file path, if provided.");
    }
};
SeLiteSettings.Field.File.prototype= new SeLiteSettings.Field('File.prototype');
SeLiteSettings.Field.File.prototype.constructor= SeLiteSettings.Field.File;
SeLiteSettings.Field.File.prototype.generateDefaultValue= function() { return ''; };

SeLiteSettings.Field.File.prototype.parentEquals= SeLiteSettings.Field.File.prototype.equals;
SeLiteSettings.Field.File.prototype.equals= function( other ) {
    if( !this.parentEquals(other)
    || this.startInProfileFolder!==other.startInProfileFolder
    || this.defaultValue!==other.defaultValue ) {
        return false;
    }
    if( !compareAllFields(this.filters, other.filters, true) ) {
        return false;
    }
    return true;
};

SeLiteSettings.Field.SQLite= function( name, defaultValue ) {
    SeLiteSettings.Field.File.call( this, name, true, { 'SQLite': '*.sqlite', 'any': null}, defaultValue );
};
SeLiteSettings.Field.SQLite.prototype= new SeLiteSettings.Field.File('SQLite.prototype', false, {}, '' );
SeLiteSettings.Field.SQLite.prototype.constructor= SeLiteSettings.Field.SQLite;

/** @param defaultValue It's actually a key (Preferences subfield name), not the visible integer/string value.
 *  @param choicePairs Anonymous object serving as an associative array {
 *      string key => string/number ('primitive') label
 *  } It's not clear what is intuitive here. However, with this format, the type and positioning of
 *  label reflectshow it is shown when using Firefox url about:config.
 *  Also, Javascript transforms object field/key names to strings even if they were set as integer.
 * */
SeLiteSettings.Field.Choice= function( name, defaultValue, multivalued, choicePairs ) {
    SeLiteSettings.Field.call( this, name, defaultValue, multivalued );
    if( this.defaultValue!==null && typeof this.defaultValue!='string' ) {
        throw new Error( "SeLiteSettings.Field.Choice(..) expects defaultValue to be a string ('primitive'), if provided.");
    }
    if( !loadingPackageDefinition && this.constructor==SeLiteSettings.Field.Choice ) {
        throw new Error( "Can't define instances of SeLiteSettings.Field.Choice class itself outside the package. Use SeLiteSettings.Field.Choice.Int or SeLiteSettings.Field.Choice.String." );
    }
    if( !loadingPackageDefinition && (typeof choicePairs!=='object' || choicePairs.constructor.name==='Array') ) {
        throw new Error( "Instances of subclasses of SeLiteSettings.Field.Choice require choicePairs to be an anonymous object serving as an associative array." );
    }
    this.choicePairs= choicePairs;
};
SeLiteSettings.Field.Choice.prototype= new SeLiteSettings.Field('Choice.prototype');
SeLiteSettings.Field.Choice.prototype.constructor= SeLiteSettings.Field.Choice;
SeLiteSettings.Field.Choice.prototype.generateDefaultValue= function() {
    if( this.multivalued ) {
        throw new Error( 'Do not use SeLiteSettings.Field.Choice.generateDefaultValue() for multivalued fields.');
    }
    for( var key in this.choicePairs ) { // Just return the first one.
        return key;
    }
    return null;
};
SeLiteSettings.Field.Choice.prototype.compareValues= function() {
    throw new Error( 'Do not use SeLiteSettings.Field.Choice.compareValues(). Sort choicePairs yourself.');
};
SeLiteSettings.Field.Choice.prototype.setDefault= function() {
    throw new Error("Do not call setDefault() on SeLiteSettings.Field.Choice family.");
};
SeLiteSettings.Field.Choice.prototype.setValue= function() {
    throw new Error("Do not call setValue() on SeLiteSettings.Field.Choice family.");
};
SeLiteSettings.Field.Choice.prototype.setPref= SeLiteSettings.Field.prototype.setPref;

SeLiteSettings.Field.Choice.Int= function( name, defaultValue, multivalued, choicePairs ) {
    SeLiteSettings.Field.Choice.call( this, name, defaultValue, multivalued, choicePairs );
    for( var key in this.choicePairs ) {
        var value= this.choicePairs[key];
        if( typeof value!=='number' || value!==Math.round(value) ) {
            throw new Error( 'SeLiteSettings.Field.Choice.Int() expects values in choicePairs to be integers, but for key ' +key+
                ' it has ' +(typeof value)+ ' - ' +value );
        }
    }
};
SeLiteSettings.Field.Choice.Int.prototype= new SeLiteSettings.Field.Choice('ChoiceInt.prototype');
SeLiteSettings.Field.Choice.Int.prototype.constructor= SeLiteSettings.Field.Choice.Int;
SeLiteSettings.Field.Choice.Int.prototype.setPref= SeLiteSettings.Field.Int.prototype.setPref;

SeLiteSettings.Field.Choice.String= function( name, defaultValue, multivalued, choicePairs ) {
    SeLiteSettings.Field.Choice.call( this, name, defaultValue, multivalued, choicePairs );
    for( var key in this.choicePairs ) {
        var value= this.choicePairs[key];
        if( typeof value!=='string' ) {
            throw new Error( 'SeLiteSettings.Field.Choice.String() expects values in choicePairs to be strings, but for key ' +key+
                ' it has ' +(typeof value)+ ' - ' +value );
        }
    }
};
SeLiteSettings.Field.Choice.String.prototype= new SeLiteSettings.Field.Choice('ChoiceString.prototype');
SeLiteSettings.Field.Choice.String.prototype.constructor= SeLiteSettings.Field.Choice.String;

/** @param name string Name prefix for preferences/fields for this module.
 *  As per Mozilla standard, it should be dot-separated and start with 'extensions.' See Firefox url about:config.
 *  @param fields Array of SeLiteSettings.Field objects, in the order how they will be displayed.
 *  Beware: this.fields will not be an array, but an object serving as an associative array { string field name => Field object}
 *  @param allowSets bool Whether to allow multiple sets of settings for this module
 *  @param defaultSetName string Name of the default set. Optional, null by default; only allowed (but not required) if allowSets==true
 *  @param definitionJavascriptFile string Full path & filename (including the extension) of a javascript file which contains a 
 *  definition of this module. Optional; if present, it lets SeLiteSettings to load a definition automatically.
 *  If not set and the module was already registered with a javascript file and it gets re-registered,
 *  then the javascript file will get 'removed' from this module in the preferences - SeLiteSettings won't be able
 *  to load it automatically (unless it gets re-registered with the javascript file again).
 * */
SeLiteSettings.Module= function( name, fields, allowSets, defaultSetName, definitionJavascriptFile ) {
    this.name= name;
    if( typeof this.name!='string' ) {
        throw new Error( 'SeLiteSettings.Module() expects a string name.');
    }
    ensureFieldName( name, 'module name');
    if( typeof fields!=='object' || !fields.constructor || fields.constructor.name!=='Array' ) {
        // @TODO my docs I can't check (fields instanceof Array) neither (fields.constructor===Array) when this script a component. It must be caused by JS separation.
        throw new Error( 'SeLiteSettings.Module() expects an array fields, but it received ' +(typeof fields)+ ' - ' +fields);
    }
    this.fields= {}; // Object serving as an associative array { string field name => SeLiteSettings.Field instance }
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
    this.defaultSetName= defaultSetName || null;
    if( this.defaultSetName!=null && typeof this.defaultSetName!='string' ) {
        throw new Error( 'SeLiteSettings.Module() expects defaultSetName to be a string, if provided.');
    }
    if( this.defaultSetName!=null && !this.allowSets ) {
        throw new Error( 'SeLiteSettings.Module() allows optional parameter defaultSetName only if allowSets is true..');
    }
    defaultSetName===null || ensureFieldName( defaultSetName, 'defaultSetName' );
    
    this.definitionJavascriptFile= definitionJavascriptFile || null;
    if( this.definitionJavascriptFile!=null && typeof this.definitionJavascriptFile!='string') {
        throw new Error( 'SeLiteSettings.Module() expects definitionJavascriptFile to be a string, if provided.');
    }
    this.prefsBranch= prefs.getBranch( this.name+'.' );
};

SeLiteSettings.savePrefFile= function() {
    prefs.savePrefFile( null );
};

/** Get an existing module with the same name, or the passed one. If there is an existing module, this checks that
 *  fields and other parameters are equal, otherwise it fails.
 *  If createOrUpdate is true (by default), this (re)registers the module, which calls nsIPrefService.savePrefFile().
 * @param module Object instance of SeLiteSettings.Module that you want to register (or an equal one)
 *  @param createOrUpdate Boolean, optional, true by default; whether to create or update any existing sets by calling module.createOrUpdate()
 *  @return An existing equal Module instance, if any; given module otherwise.
 * */
SeLiteSettings.register= function( module, createOrUpdate ) {
    if( !(module instanceof SeLiteSettings.Module) ) {
        throw new Error( 'SeLiteSettings.register() expects module to be an instance of SeLiteSettings.Module.');
    }
    if( module.name in SeLiteSettings.modules ) {
        var existingModule= SeLiteSettings.modules[module.name];
        
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
        SeLiteSettings.modules[module.name]= module;
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
SeLiteSettings.Module.prototype.setNames= function() {
    if( !this.allowSets ) {
        return [''];
    }
    var children= directChildList( this.prefsBranch );
    children.sort( compareCaseInsensitively );
    var result= [];
    for( var i=0; i<children.length; i++ ) {
        var child= children[i];
        if( SeLiteSettings.reservedNames().indexOf(child)<0 ) {
            result.push( child );
        }
    }
    return result;
};

/** @return string name of the selected (active) set, including a trailing dot '.'. Null if no set is selected.
 *  @throws If the module doesn't allow sets.
 * */
SeLiteSettings.Module.prototype.selectedSetName= function() {
    if( !this.allowSets ) {
        throw new Error( "Module '" +this.name+ "' doesn't allow sets.");
    }
    if( this.prefsBranch.prefHasUserValue(SeLiteSettings.SELECTED_SET_NAME) ) {
        return this.prefsBranch.getCharPref( SeLiteSettings.SELECTED_SET_NAME );
    }
    return null;
};

/** It sets a selected set for the module. It doesn't call nsIPrefService.savePrefFile().
 *  @param string name of the set to become selected (active), including a trailing dot '.'
 *  @throws If the module doesn't allow sets.
 * */
SeLiteSettings.Module.prototype.setSelectedSetName= function( setName ) {
    if( !this.allowSets ) {
        throw new Error( "Module '" +this.name+ "' doesn't allow sets.");
    }
    ensureFieldName( setName, 'setName' );
    this.prefsBranch.setCharPref( SeLiteSettings.SELECTED_SET_NAME, setName );
};

/** @param setName Name of the set; an empty string if the module doesn't allow sets, or if you want a selected set.
 *  @return Object serving as associative array {
 *      string field name => string/boolean/number ('primitive') value
 *      -- for non-choice single-value fields, and
 *      -- for fields not defined in this.fields
 *      string choice or (non-choice and multi-value) field name => array{
 *          string key => string/number ('primitive') label or value entered by user
 *      }
 *      -- this is present for all choice and for all non-choice multi-value fields,
 *      including those that don't have any value in Preferences DB
 *  }
 *  It also includes fields that are not defined in this.fields. It excludes any single-value fields defined in this.fields
 *  with no value stored in the preferences (there shouldn't be any, since SeLiteSettings.loadFromJavascript()
 *  reloads the javascript definition and it requires non-null default values).
 * */
SeLiteSettings.Module.prototype.getFieldsOfSet= function( setName ) {
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
    var result= {};
    var reservedNames= SeLiteSettings.reservedNames();
    
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
                    if( this.fields[fieldName] && (this.fields[fieldName].multivalued || this.fields[fieldName] instanceof SeLiteSettings.Field.Choice) ) {
                        if( !result[fieldName]
                        || typeof result[fieldName]!=='object' // In case there is an orphan/sick single value for fieldName itself, e.g. after you change field definition from single-value to multivalued
                        ) {
                            result[fieldName]= {};
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
    // Fill in any empty multivalued or choice fields:
    for( var fieldName in this.fields ) {
        var field= this.fields[fieldName];
        if( field.multivalued || field instanceof SeLiteSettings.Field.Choice ) {
            if( !result[fieldName] ) {
                result[fieldName]= {};
            }
        }
        if( field.multivalued && !(field instanceof SeLiteSettings.Field.Choice) ) {
            result[fieldName]= sortByKeys( result[fieldName], field.compareValues );
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
SeLiteSettings.Module.prototype.register= function() {
    if( this.definitionJavascriptFile ) {
        this.prefsBranch.setCharPref( SeLiteSettings.MODULE_DEFINITION_FILE_OR_URL, this.definitionJavascriptFile );
    }
    else {
        this.prefsBranch.clearUserPref( SeLiteSettings.MODULE_DEFINITION_FILE_OR_URL ); // This works even if the preference doesn't exist
    }
    if( this.allowSets ) {
        var setNames= this.setNames();
        // Update any existing sets
        for( var i=0; i<setNames.length; i++ ) {
            this.createSet( setNames[i] );
        }
        if( this.defaultSetName ) {
            if( !this.prefsBranch.prefHasUserValue(SeLiteSettings.SELECTED_SET_NAME) ) { // @TODO Maybe better: prefs.getPrefType(..)
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
SeLiteSettings.Module.prototype.createSet= function( setName ) {
    if( typeof setName=='undefined' || setName===null ) {
        setName= '';
    }
    if( typeof setName!='string' ) {
        throw new Error( "SeLiteSettings.Module.createOrUpdateSet(setName) expects optional setName to be a string, if provided.");
    }
    if( setName!=='' ) {
        ensureFieldName( setName, 'set name');
    }
    var setNameDot= setName!==''
        ? setName+'.'
        : '';
    for( var fieldName in this.fields ) {
        var field= this.fields[fieldName];
        if( !field.multivalued ) {
            if( !(field instanceof SeLiteSettings.Field.Choice) ) {
                if( !this.prefsBranch.prefHasUserValue(setNameDot+fieldName) ) {
                    field.setDefault( setName ); // That adds a dot, if necessary
                }
            }
            else {
                var children= prefsBranch.getChildList( setNameDot+fieldName+'.', {} );
                for( var child in children );
                if( typeof child==='undefined' ) {
                    field.addValue( setNameDot, field.defaultValue );
                }
            }
        }
    }
};

/** Remove the set of the given name.
    @param setName string name of the set to create/update. If empty, it operates on the main & only set.
 * */
SeLiteSettings.Module.prototype.removeSet= function( setName ) {
    if( typeof setName==='undefined' ) {
        setName= '';
    }
    if( typeof setName!='string' ) {
        throw new Error( "SeLiteSettings.Module.createOrUpdateSet(setName) expects optional setName to be a string.");
    }
    if( setName!=='' ) {
        ensureFieldName( setName, 'set name');
        setName+= '.';
    }
    for( var fieldName in this.fields ) {
        var field= this.fields[fieldName];
        if( field.multivalued || field instanceof SeLiteSettings.Field.Choice ) {
            this.prefsBranch.deleteBranch( setName+fieldName+'.' );
        }
        else
        if( this.prefsBranch.prefHasUserValue(setName+fieldName) ) {
            this.prefsBranch.clearUserPref( setName+fieldName );
        }
    }
};

/** Load & register the module from its Javascript file, if stored in preferences.
 *  The file will be cached - any changes will have affect only once you relad Firefox.
 *  If called subsequently, it returns an already loaded instance.
 *  @param moduleName string Name of the preference path/prefix up to the module (including the module name), excluding the trailing dot
 *  @return Module instance
 *  @throws an error if no such preference branch, or preferences don't contain javascript file, or the javascript file doesn't exist.
 * */
SeLiteSettings.loadFromJavascript= function( moduleName ) {
    if( SeLiteSettings.modules[ moduleName ] ) {
        return SeLiteSettings.modules[ moduleName ];
    }
    var prefsBranch= prefs.getBranch( moduleName+'.' );
    if( prefsBranch.prefHasUserValue(SeLiteSettings.MODULE_DEFINITION_FILE_OR_URL) ) {
        var fileNameOrUrl= prefsBranch.getCharPref(SeLiteSettings.MODULE_DEFINITION_FILE_OR_URL);
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
    if( !(moduleName in SeLiteSettings.modules) ) {
        throw new Error();
    }
    return SeLiteSettings.modules[ moduleName ];
};

SeLiteSettings.moduleNamesFromPreferences= function( namePrefix ) {
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
        if( child.endsWith(SeLiteSettings.MODULE_DEFINITION_FILE_OR_URL) ) {
            var moduleNameLength= child.length-1-SeLiteSettings.MODULE_DEFINITION_FILE_OR_URL.length;
            result.push( child.substring(0, moduleNameLength) );
        }
    }
    return result;
};

loadingPackageDefinition= false;

var EXPORTED_SYMBOLS= ['SeLiteSettings'];