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

var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
var nsIFilePicker = Components.interfaces.nsIFilePicker;
Components.utils.import("resource://gre/modules/FileUtils.jsm" );
Components.utils.import( "chrome://selite-misc/content/selite-misc.js" );
Components.utils.import("resource://gre/modules/osfile.jsm");
//var console = (Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console;

var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                              .getService(Components.interfaces.nsIPromptService);
var SeLiteSettings= {};
Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js", SeLiteSettings);
Components.utils.import("resource://gre/modules/Services.jsm");
var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
var nsIIOService= Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);    
var nsIPrefBranch= Components.interfaces.nsIPrefBranch;

var CREATE_NEW_SET= "Create a new set";
var DELETE_THE_SET= "Delete the set";
var ADD_NEW_VALUE= "Add a new value";
var DELETE_THE_VALUE= "Delete the value";

/** Select a file/folder for a field or a folder for which to load the configuration (via manifests).
 *  @param field Instance of a subclass of Field.FileOrFolder (Field.File, Field.Folder or Field.SQLite), or null if no field
 *  @param tree, used only when changing a field.
 *  @param row int 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
        var column= { value: null }; // value is instance of TreeColumn.
    @param column instance of TreeColumn
    @param bool isFolder whether it's for a folder, rather than a file
    @param string currentTargetFolder Used as the default folder, when field==null
    @return false if nothing selected, string file/folder path if selected
 * */
function chooseFileOrFolder( field, tree, row, column, isFolder, currentTargetFolder ) {
    var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    filePicker.init(
        window,
        "Select a " +(isFolder ? "folder" : "file")+ (field ? " for " +field.name : ""),
        isFolder
        ? nsIFilePicker.modeGetFolder
        : nsIFilePicker.modeOpen
    );
    if( field ) {
        for( var filterName in field.filters ) {
            if( field && field.filters[filterName] ) {
                filePicker.appendFilter( filterName, field.filters[filterName]);
            }
            else { // field==false means that it should be a non-restrictive filter
                filePicker.appendFilters( nsIFilePicker.filterAll);
            }
        }
        var previousValue= tree.view.getCellText(row, column);
        var filePickerDirectoryIsSet= false;
        if( previousValue ) {
            var file= null;
            try {
                file= new FileUtils.File(previousValue);
            }
            catch(e) {}
            if( file!=null && file.exists() ) {
                filePicker.defaultString= file.leafName;
            }
            if( file!=null && file.parent!==null && file.parent.exists() ) {
                var localParent= Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
                localParent.initWithPath( file.parent.path );
                filePicker.displayDirectory= localParent;
                filePickerDirectoryIsSet= true;
            }
        }
        if( !filePickerDirectoryIsSet ) {
            if( field.startInProfileFolder ) {
                var profileDir= Components.classes["@mozilla.org/file/directory_service;1"].getService( Components.interfaces.nsIProperties)
                    .get("ProfD", Components.interfaces.nsIFile);
                filePicker.displayDirectory= profileDir;
            }
        }
    }
    else
    if( currentTargetFolder ) {
        filePicker.displayDirectory= currentTargetFolder;
    }
    var result= filePicker.show();
    if (result== nsIFilePicker.returnOK || result== nsIFilePicker.returnReplace) {
        if( field ) {
            tree.view.setCellText(row, column, filePicker.file.path );
        }
        return filePicker.file.path;
    }
    return false;
}

/** Enumeration-like class to use symbols for tree levels and also for columns.
 * @param string name
 * @param int level. If not set or negative, then the instance can't be used with below().
 * @param bool blank Whether generateTreeItem() should store its parameter value in properties,
 * and not as value (so that Module/Set/Field cell is blank). Optional; false by default.
 */
function RowLevel( name, level, blank ) {
    if( RowLevel.MODULE && RowLevel.SET && RowLevel.CHECKBOX && RowLevel.FIELD && RowLevel.OPTION && RowLevel.ACTION ) {
        throw new Error( "Do not create any other instances of RowLevel, because they are compared to by identity." );
    }
    if( level===undefined ) {
        level= -1;
    }
    if( blank===undefined) {
        blank= false;
    }
    this.name= name;
    this.level= level;
    this.blank= blank;
}
RowLevel.MODULE= new RowLevel('MODULE', 0);
RowLevel.SET= new RowLevel('SET', 1);
RowLevel.FIELD= new RowLevel('FIELD', 2);
RowLevel.OPTION= new RowLevel('OPTION', 3);
// Special:
RowLevel.CHECKBOX= new RowLevel('CHECKBOX', -1);
RowLevel.ACTION= new RowLevel('ACTION', -1, true);

RowLevel.prototype.toString= function() {
    return 'RowLevel.' +this.name;
};

/** @param other object of RowLevel
 *  @return bool Whether this is at a more detailed level (i.e. 'below') other.
 *  sameLevel.below(sameLevel) is false.
 * */
RowLevel.prototype.below= function( other ) {
    if( !(other instanceof RowLevel) ) {
        throw new Error( 'RowLevel.below(other) expects other to be an instance of RowLevel.');
    }
    if( this.level<0 ) {
        throw new Error( 'RowLevel.below(other) cannot be called on level ' +this );
    }
    if( other.level<0 ) {
        throw new Error( 'RowLevel.below(other) cannot be used with parameter ' +other );
    }
    return this.level>other.level;
};

if( !RowLevel.SET.below(RowLevel.MODULE) ) {
    throw new Error( 'Bad RowLevel.below()');
}

/** @return one of forModule, forSet, forField or forOption, depending on the level
 * */
RowLevel.prototype.forLevel= function( forModule, forSet, forCheckbox, forField, forOption ) {
    if( this===RowLevel.MODULE ) {
        return forModule;
    }
    if( this===RowLevel.SET || this===RowLevel.ACTION ) {
        return forSet;
    }
    if( this===RowLevel.CHECKBOX ) {
        return forCheckbox;
    }
    if( this===RowLevel.FIELD ) {
        return forField;
    }
    if( this===RowLevel.OPTION ) {
        return forOption;
    }
    if( this.level<0 ) {
        return '';
    }
    throw new Error( "Bad instance of RowLevel." );
};

/** It contains elements for <treecol> tags, as returned by document.createElementNS( XUL_NS, 'tree_col').
 These are not nsITreeColumn instances, but their .element fields.
 In order to get nsITreeColumn instance, use treeColumn(). See also comments near a call to getCellAt().
 */
var treeColumnElements= {
    moduleSetField: null,
    selectedSet: null,
    checked: null,
    value: null,
    action: null, // This is 'Set' in folder-based view
    manifest: null
};

/** @param element Element for <treecol> tag, one of those stored in treeColumnElements (as applicable).
 *  @return object Instance of nsITreeColumn, where returnedObject.element=element.
 * */
function treeColumn( element ) {
    var tree= document.getElementById('settingsTree');
    for( var i=0; i<tree.columns.length; i++ ) {
        var column= tree.columns[i];
        if( column.element===element ) {
            return column;
        }
    }
    return null;
}

/** @param allowModules bool Whether we show any module/s rather than just a specific one. If allowModules is true,
 *  there may be none, one or more modules to show.
 *  @param perFolder bool Whether we're showing fields in per-folder mode - then we show a 'Reset' or 'Inherit' buttons and tooltips that
 *  indicate where each field is inherited from.
 * @return node object for <treecols>
 * */
function generateTreeColumns( allowModules, perFolder ) {
    if( typeof allowModules!=='boolean' || typeof allowSets!=='boolean' || typeof allowMultivaluedNonChoices!=='boolean' ) {
        throw new Error('generateTreeColumns() requires all three parameters to be boolean.');
    }
    
    var treecols= document.createElementNS( XUL_NS, 'treecols' );

    var treecol= treeColumnElements.moduleSetField= document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label',
        allowModules
        ? (allowSets
            ? 'Module/Set/Field'
            : 'Module/Field'
          )
        : (allowSets
            ? 'Set/Field'
            : 'Field'
          )
    );
    treecol.setAttribute( 'flex', '2');
    treecol.setAttribute('primary', 'true'); // without this we don't get expand/collapse triangles
    treecol.setAttribute( 'ordinal', '1');
    treecols.appendChild(treecol);
    
    var splitter= document.createElementNS( XUL_NS, 'splitter' );
    splitter.setAttribute( 'ordinal', '2');
    treecols.appendChild( splitter );
    
    if( allowSets ) {
        treecol= treeColumnElements.selectedSet= document.createElementNS( XUL_NS, 'treecol');
        treecol.setAttribute('label', 'Active');
        treecol.setAttribute('type', 'checkbox');
        treecol.setAttribute('editable', 'true' );
        treecol.setAttribute( 'ordinal', '3');
        treecols.appendChild(treecol);
        
        splitter= document.createElementNS( XUL_NS, 'splitter' );
        splitter.setAttribute( 'ordinal', '4');
        treecols.appendChild( splitter );
    }
    
    treecol= treeColumnElements.checked= document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label', 'True');
    treecol.setAttribute('type', 'checkbox');
    treecol.setAttribute('editable', ''+!perFolder );
    treecol.setAttribute( 'ordinal', '5');
    treecols.appendChild(treecol);

    splitter= document.createElementNS( XUL_NS, 'splitter' );
    splitter.setAttribute( 'ordinal', '6');
    treecols.appendChild( splitter );
    
    treecol= treeColumnElements.value= document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label', 'Value');
    treecol.setAttribute('editable', ''+!perFolder );
    treecol.setAttribute( 'flex', '1');
    treecol.setAttribute( 'ordinal', '7');
    treecols.appendChild(treecol);
    
    if( perFolder || allowSets || allowMultivaluedNonChoices ) {
        splitter= document.createElementNS( XUL_NS, 'splitter' );
        splitter.setAttribute( 'ordinal', '8');
        treecols.appendChild( splitter );

        treecol= treeColumnElements.action= document.createElementNS( XUL_NS, 'treecol');
        treecol.setAttribute('label', perFolder
            ? 'Set'
            : 'Action');
        treecol.setAttribute('editable', 'false');
        treecol.setAttribute( 'flex', '1');
        treecol.setAttribute( 'ordinal', '9');
        treecols.appendChild(treecol);
    }
    
    // Per-folder view: Manifest or definition. Per-module view: Null/Undefine
    splitter= document.createElementNS( XUL_NS, 'splitter' );
    splitter.setAttribute( 'ordinal', '10');
    treecols.appendChild( splitter );

    treecol= treeColumnElements.manifest= document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label', perFolder
        ? 'Manifest or definition'
        : 'Null/Undefine');
    treecol.setAttribute('editable', 'false');
    treecol.setAttribute( 'flex', '1');
    treecol.setAttribute( 'ordinal', '11');
    treecols.appendChild(treecol);
    return treecols;
}

/** Sorted anonymous object serving as an associative array {
 *     string module name => Module object
 *  }
 * */
var modules= sortedObject(true);

/** Sorted object (anonymous in any other respect) serving as multi-level associative array {
    *   string module name => anonymous object {
    *      string set name (it may be an empty string) => sorted object {
    *          one or none: SET_SELECTION_ROW => <treerow> element/object for the row that has a set selection cell
    *             - only if we show set sellection column and the module allows set selection
    *          zero or more: string field name (field is non-choice and single value) => <treerow> element/object for the row that has that field
    *          zero or more: string field name (the field is multivalue or a choice) => anonymous or sorted object {
    *             value fields (ones with keys that are not reserved) are sorted by key, but entries with reserved keys may be at any position
    *             - one: FIELD_MAIN_ROW => <treerow> element/object for the collapsible row that contains all options for that field
    *             - one: FIELD_TREECHILDREN => <treechildren> element/object for this field, that contains <treeitem><treerow> levels for each option
    *             - zero or more: string key => <treerow> element/object for the row that contains a value/option
    *             - zero or one: NEW_VALUE_ROW => <treerow> element/object for the row that contains a value that the user will only have to fill in
    *               (that is, a row dynamically created but with no value specified yet).
    *          }
           }
           ...
    *   }
    *   ...
 *  }
 * Reasons for having it:
 * 1. I want users to select a set (and then I deselect the previously selected set).
 * But I don't want users to deselect currently selected set (that would leave its module without a selected set).
 * So when a user selects a set, I change its 'editable' attribute to false. Navigating tree using DOM functions seems to be more complex.
   2. I use this when saving a set/module/all displayed modules.
 *  * */
var treeRows= sortedObject(true);

/** Get a <treecell> element/object from a given treeRow and level
 *  @param object treeRow object/element for <treerow>
 *  @param object level RowLevel, it indicates which column to return <treecell> for
 *  @return object Element for <treecell>
 * */
function treeCell( treeRow, level ) {
    if( !(treeRow instanceof XULElement) ) {
        throw new Error( 'treeCell() requires treeRow to be an XULElement object, but it received ' +treeRow );
    }
    if( treeRow.tagName!=='treerow' ) {
        throw new Error( 'treeCell() requires treeRow to be an XULElement object for <treerow>, but it received XULElement for ' +treeRow.tagName );
    }
    if( !(level instanceof RowLevel) ) {
        throw new Error( 'treeCell() requires level to be an instance of RowLevel.' );
    }
    var cells= treeRow.getElementsByTagName( 'treecell' );
    return cells[ allowSets
        ? level.forLevel(0, 1, 2, 3, 4)
        : level.forLevel(0, undefined, 1, 2, 3)
    ];
}

/** Access sub(sub...)container of given parent.
 *  If parent[field1][field2][...] is not defined, then this creates any missing chains as new anonymous naturally sorted objects.
 *  @param parent A parent container
 *  @param string field
 *  @param string another field (optional)
 *  @param string another field (optional)
 *  ....
 *  @return the target parent[field][field2][...]@TODO move to SeLite Misc?
 * */
function subContainer( parent, fieldOrFields ) {
    var object= parent;
    for( var i=1; i<arguments.length; i++ ) {
        var fieldName= arguments[i];
        if( object[fieldName]===undefined ) {
            object[fieldName]= sortedObject(true);
        }
        object= object[fieldName];
    }
    return object;
}

/** Generate text for label for 'Null/Undefine' column. Only used in set mode
 *  (not in per-folder mode).
 *  @param field Instance of SeLiteSettings.Field
 *  @param valueCompound One of entries of result of Module.Module.getFieldsOfSet().
 *  @return string Empty string, 'Null' or 'Undefine', as an appropriate action for this field.
 * */
function nullOrUndefineLabel( field, valueCompound ) {
    targetFolder===null || fail();
    if( !field.multivalued ) {
        return valueCompound.entry===null
            ? (field.allowsNotPresent
                ? 'Undefine'
                : ''
              )
            : 'Null';
    }
    else {
        // We only allow 'Undefine' button once there are no value(s) for the multivalued field
        return valueCompound.entry!==undefined && Object.keys(valueCompound.entry).length===0 && field.allowsNotPresent
            ? 'Undefine'
            : '';
    }
}

/** @param module object of Module
 *  @param setName string set name; either '' if the module doesn't allow sets; otherwise it's a set name when at field level
 *  attribute for the <treerow> nodes, so that when we handle a click event, we know what field the node is for.
 *  @param field mixed, usually an object of a subclass of Field. If rowLevel==RowLevel.MODULE or rowLevel==RowLevel.SET,
 *  then field is null. Otherwise it must be an instance of a subclass of Field.
 *  @param string key 'key' (used as a trailing part of field option preference name);
 *  use for fields of Field.Choice family and for multivalued fields only. For multivalued non-choice fields it should be the same
 *  as parameter value. If the field is of a subclass of Field.Choice, then key and value may be different.
 *  @param valueOrPair
 *  For single valued non-choice fields or fields not defined in module.fields[]
 *  it is the value/label of the field as shown. Ignored if  not applicable.
 *  For multivalued or choice fields it's an anonymous object serving as an array
 *  { string key => string/number ('primitive') valueItself
 *    ....
 *  } where
 *  - key serves as a trailing part of field option preference name)
 *  -- for multivalued non-choice fields it should be the same as valueItself
 *  -- if the field is of a subclass of Field.Choice, then key and valueItself may be different.
 *  - valueItself is the actual value/label as displayed
 *  @param rowLevel object of RowLevel
 *  @param optionIsSelected bool Whether the option is selected. Only used when rowLevel===RowLevel.OPTION and field instanceof Field.Choice.
 *  @param isNewValueRow bool Whether the row is for a new value that will be entered by the user. If so, then this doesn't set the label for the value cell.
 *  It still puts the new <treerow> element to treeRows[moduleName...], so that it can be updated/removed once the user fills in the value. Optional; false by default.
 *  @param object valueCompound Anonymous object, one of entries in result of Module.getFieldsDownToFolder(..)
 *  or Module.Module.getFieldsOfSet() in form {
 *          fromPreferences: boolean, whether the value comes from preferences; otherwise it comes from a values manifest or from field default,
 *          setName: string set name (only valid if fromPreferences is true),
 *          folderPath: string folder path to the manifest file (either values manifest, or associations manifest);
 *              empty string '' if the value(s) come from a global (active) set;
 *              null if fromPreferences===true or if the value comes from field default (as in the module definition)
 *          entry: as described for Module.getFieldsDownToFolder(..)
 *  }
 *  Required if rowLevel===RowLevel.FIELD.
 *  @return object for a new element <treeitem> with one <treerow>
 * */
function generateTreeItem( module, setName, field, valueOrPair, rowLevel, optionIsSelected, isNewValueRow, valueCompound ) {
    if( !(rowLevel instanceof RowLevel) || rowLevel===RowLevel.CHECKBOX || rowLevel===RowLevel.ACTION ) {
        throw new Error("Parameter rowLevel must be an instance of RowLevel, but not CHECKBOX neither ACTION.");
    }
    var multivaluedOrChoice= field!==null && (field.multivalued || field instanceof SeLiteSettings.Field.Choice);
    var key= null; // If valueOrPair is an object with exactly one (iterable) key, this is the key
    if( typeof valueOrPair==='object' && valueOrPair!==null ) {
        rowLevel===RowLevel.OPTION || fail( "generateTreeItem(): parameter valueOrPair must not be an object, unless RowLevel is OPTION, but that is " +rowLevel );
        multivaluedOrChoice || fail( 'generateTreeItem(): parameter valueOrPair can be an object only for multivalued fields or choice fields, but it was used with ' +field );
        var keys= Object.keys(valueOrPair);
        keys.length===1 || fail( "generateItem(): parameter valueOrPair can be an object, but with exactly one field, yet it received one with " +keys.length+ ' fields.' );
        key= keys[0];
    }
    var value= key!==null
        ? valueOrPair[key]
        : valueOrPair;
            
    if( field && typeof field!=='string' && !(field instanceof SeLiteSettings.Field) ) {
        throw new Error( "Parameter field must be an instance of a subclass of Field, unless rowLevel===RowLevel.MODULE or rowLevel===RowLevel.SET, but it is "
            +(typeof field==='object' ? 'an instance of ' +field.constructor.name : typeof field)+ ': ' +field );
    }
    optionIsSelected= optionIsSelected || false;
    if( isNewValueRow===undefined ) {
        isNewValueRow= false;
    }
    valueCompound= valueCompound || null;
    var treeitem= document.createElementNS( XUL_NS, 'treeitem');
    var treerow= document.createElementNS( XUL_NS, 'treerow');
    treeitem.appendChild( treerow );
    // Shortcut xxxName variables prevent null exceptions, so I can pass them to rowLevel.forLevel(..) without extra validation
    var moduleName= module
        ? module.name
        : '';
    var fieldName= field
        ?   (field instanceof SeLiteSettings.Field
                ? field.name
                : field
            )
        : '';
    /* Following is why I don't allow spaces in module/set/field names. For level===RowLevel.OPTION,
     * variable key may contains space(s). That's why there can't be any more entries in 'properties' after key:
    */
    treerow.setAttribute( 'properties',
        rowLevel.forLevel(
            moduleName,
            moduleName+' '+setName,
            undefined,
            moduleName+' '+setName+' '+fieldName,
            moduleName+' '+setName+' '+fieldName+ ' ' +key)
    );
    
    // Cell for name of the Module/Set/Field:
    var treecell= document.createElementNS( XUL_NS, 'treecell');
    treerow.appendChild( treecell);
    treecell.setAttribute('label', !rowLevel.blank
        ? rowLevel.forLevel( moduleName, setName, undefined, fieldName, '')
        : '' );
    treecell.setAttribute('editable', 'false');

    if( allowSets ) { // Radio-like checkbox for selecting a set
        treecell= document.createElementNS( XUL_NS, 'treecell');
        treerow.appendChild( treecell);
        if( rowLevel===RowLevel.SET && module.allowSets) {
            subContainer( treeRows, module.name, setName )[ SeLiteSettings.SET_SELECTION_ROW ]= treerow;
            var thisSetSelected= setName==module.selectedSetName();
            treecell.setAttribute('value', ''+thisSetSelected );
            treecell.setAttribute('editable', ''+!thisSetSelected ); // I allow to select an unselected set, but not to de-select a selected set
        }
        else {
            treecell.setAttribute('value', 'false' );
            treecell.setAttribute('editable', 'false' );
        }
        treecell.setAttribute('properties', SeLiteSettings.SELECTED_SET_NAME ); // so that I can style it in CSS as a radio button
    }
    // Register treerow in treeRows[][...]
    if( rowLevel===RowLevel.FIELD ) {
        if( !multivaluedOrChoice ) {
           subContainer( treeRows, module.name, setName )[ fieldName ]= treerow;
        }
        else {
            subContainer( treeRows, module.name, setName, fieldName )[ SeLiteSettings.FIELD_MAIN_ROW ]= treerow;
        }
    }
    if( rowLevel===RowLevel.OPTION ) {
        subContainer( treeRows, module.name, setName, fieldName )[ key ]= treerow;
    }
    
    // Cell for checkbox (if the field is boolean or a choice):
    treecell= document.createElementNS( XUL_NS, 'treecell');
    treerow.appendChild( treecell);
    if( targetFolder!==null
        || rowLevel!==RowLevel.FIELD && rowLevel!==RowLevel.OPTION
        || !(field instanceof SeLiteSettings.Field.Bool || field instanceof SeLiteSettings.Field.Choice)
        || (typeof value==='string' || typeof value==='number') && !(field instanceof SeLiteSettings.Field.Choice)
        || rowLevel===RowLevel.FIELD && field instanceof SeLiteSettings.Field.Choice
        || rowLevel===RowLevel.OPTION && optionIsSelected && !field.multivalued
    ) {
        treecell.setAttribute('editable', 'false');
    }
    if( typeof value==='boolean' ) {
        treecell.setAttribute('value', ''+value);
    }
    if( field instanceof SeLiteSettings.Field.Choice ) {
        treecell.setAttribute( 'value', ''+optionIsSelected );
    }
    if( rowLevel===RowLevel.OPTION ) {
        treecell.setAttribute('properties', field.multivalued
            ? SeLiteSettings.OPTION_NOT_UNIQUE_CELL
            : SeLiteSettings.OPTION_UNIQUE_CELL
        );
    }
    
    // Cell for the text value:
    treecell= document.createElementNS( XUL_NS, 'treecell');
    treerow.appendChild( treecell);
    if( targetFolder!==null
        || rowLevel!==RowLevel.FIELD && rowLevel!==RowLevel.OPTION
        || !(field instanceof SeLiteSettings.Field)
        || field instanceof SeLiteSettings.Field.Bool
        || field.multivalued && rowLevel===RowLevel.FIELD
        || field instanceof SeLiteSettings.Field.Choice
    ) {
        treecell.setAttribute('editable' , 'false');
    }
    var isNull, isNullOrUndefined;
    if( rowLevel===RowLevel.FIELD ) {
        valueCompound.entry!==null || !field.multivalued || fail( 'Field ' +field.name + ' is multivalued, yet its compoundValue.entry is null. In per-folder mode: ' +(targetFolder!==null) );
        valueCompound.entry!==undefined || field.allowsNotPresent || fail( 'Field ' +field.name+ ' has allowsNotPresent=false, yet its entry is undefined.');
        isNull= valueCompound.entry===null;
        isNullOrUndefined= isNull || valueCompound.entry===undefined;
    }
    if( (typeof value==='string' || typeof value==='number' || isNullOrUndefined
        ) && !isNewValueRow
    ) {
        treecell.setAttribute('label', value!==null
            ? ''+value
            : (isNull
                ? 'null'
                : 'undefined'
              )
        );
        if( targetFolder!==null && valueCompound!==null ) {
            if( valueCompound.fromPreferences ) {
                treecell.setAttribute( 'properties',
                    valueCompound.folderPath!==''
                        ? SeLiteSettings.ASSOCIATED_SET
                        : SeLiteSettings.SELECTED_SET
                );
            }
            else {
                treecell.setAttribute( 'properties',
                    valueCompound.folderPath!==null
                        ? SeLiteSettings.VALUES_MANIFEST
                        : SeLiteSettings.FIELD_DEFAULT // For visual effect
                );
            }
        }
        if( isNullOrUndefined ) {
            treecell.setAttribute( 'properties', SeLiteSettings.FIELD_NULL_OR_UNDEFINED );
        }
    }
    if( allowSets || allowMultivaluedNonChoices || targetFolder!==null ) {
        // Cell for Action column (in module view) or 'Set' column (in per-folder view)
        treecell= document.createElementNS( XUL_NS, 'treecell');
        treerow.appendChild( treecell);
        treecell.setAttribute('editable', 'false');
        if( rowLevel===RowLevel.MODULE || rowLevel===RowLevel.SET ) {
            treecell.setAttribute( 'label',
                !setName
                    ? (allowSets && module.allowSets
                        ? CREATE_NEW_SET
                        : ''
                      )
                    : DELETE_THE_SET
            );
        }
        if( targetFolder===null ) {
            if( field!==null && !(field instanceof SeLiteSettings.Field.Choice) && field.multivalued ) {
                if( rowLevel===RowLevel.FIELD ) {
                    treecell.setAttribute( 'label', ADD_NEW_VALUE );
                }
                if( rowLevel===RowLevel.OPTION ) {
                    treecell.setAttribute( 'label', DELETE_THE_VALUE );
                }
            }
        }
        else {
            if( rowLevel===RowLevel.FIELD ) {
                treecell.setAttribute( 'label', valueCompound.fromPreferences
                    ? valueCompound.setName
                    : (valueCompound.folderPath
                            ? ''
                            : 'module default'
                      )
                );
                if( valueCompound.fromPreferences && valueCompound.setName===module.selectedSetName() ) {
                    treecell.setAttribute( 'properties', SeLiteSettings.SELECTED_SET );
                }
                else
                if( !valueCompound.fromPreferences && valueCompound.folderPath===null ) {
                    treecell.setAttribute( 'properties', SeLiteSettings.FIELD_DEFAULT );
                }
            }
        }
        if( rowLevel===RowLevel.FIELD ) {
            // per-folder view: Manifest or definition; per-module view: Null/Undefine
            treecell= document.createElementNS( XUL_NS, 'treecell');
            treerow.appendChild( treecell);
            treecell.setAttribute('editable', 'false');
            if( targetFolder===null ) {
                treecell.setAttribute( 'label', nullOrUndefineLabel(field, valueCompound) );
            }
            else {
                treecell.setAttribute( 'properties', valueCompound.folderPath!==null
                    ? (     valueCompound.folderPath!==''
                            ? (valueCompound.fromPreferences
                                    ? SeLiteSettings.ASSOCIATED_SET
                                    : SeLiteSettings.VALUES_MANIFEST
                              ) + ' ' +valueCompound.folderPath
                            : ''
                      )
                    : SeLiteSettings.FIELD_DEFAULT // For the click handler
                );
                treecell.setAttribute( 'label', valueCompound.folderPath
                    ? OS.Path.join( valueCompound.folderPath, valueCompound.fromPreferences
                            ? SeLiteSettings.ASSOCIATIONS_MANIFEST_FILENAME
                            : SeLiteSettings.VALUES_MANIFEST_FILENAME
                      )
                    : (!valueCompound.fromPreferences
                            ? module.definitionJavascriptFile
                            : ''
                      )
                );
            }
        }
    }
    return treeitem;
}

/** @param node moduleChildren <treechildren>
 *  @param object module Module
 * */
function generateSets( moduleChildren, module ) {
    var setNames= targetFolder===null
        ? module.setNames()
        : [null];
    if( !allowSets && setNames.length!==1 ) {
        throw new Error( "allowSets should be set false only if a module has the only set." );
    }
    for( var i=0; i<setNames.length; i++ ) {
        var setName= setNames[i];
        // setFields includes all fields from Preferences DB for the module name, even if they are not in the module definition
        var setFields= targetFolder===null
            ? module.getFieldsOfSet( setName )
            : module.getFieldsDownToFolder( targetFolder, true );
        if( targetFolder===null ) {
            moduleSetFields[module.name]= moduleSetFields[module.name] || {};
            moduleSetFields[module.name][ setName ]= setFields;
        }
        var setChildren= null;
        if( allowSets && module.allowSets ) {
            var setItem= generateTreeItem(module, setName, null, null, RowLevel.SET );
            moduleChildren.appendChild( setItem );
            setChildren= createTreeChildren( setItem );
        }
        else {
            setChildren= moduleChildren;
        }
        generateFields( setChildren, module, setName, setFields );
    }
}

/** @param setFields Result of SeLiteSettings.Module.getFieldsOfSet() or SeLiteSettings.Module.getFieldsDownToFolder()
 * */
function generateFields( setChildren, module, setName, setFields ) {
    for( var fieldName in setFields ) {
        var compound= setFields[fieldName];
        var field= fieldName in module.fields
            ? module.fields[fieldName]
            : fieldName;
        
        var singleValueOrNull= typeof compound.entry!=='object'
            ? compound.entry
            : null;
        var fieldItem= generateTreeItem(module, setName, field, singleValueOrNull, RowLevel.FIELD, false, false, compound );
        setChildren.appendChild( fieldItem );
        
        if( field instanceof SeLiteSettings.Field &&
            (field.multivalued || field instanceof SeLiteSettings.Field.Choice)
        ) {
            var fieldChildren= createTreeChildren( fieldItem );
            var pairsToList= field instanceof SeLiteSettings.Field.Choice
                ? field.choicePairs
                : compound.entry;
            
            for( var key in pairsToList ) {////@TODO potential IterableArray
                var pair= {};
                pair[key]= pairsToList[key];
                var optionItem= generateTreeItem(module, setName, field, pair,
                    RowLevel.OPTION,
                    field instanceof SeLiteSettings.Field.Choice
                        && typeof(compound.entry)==='object'
                        && key in compound.entry,
                    false,
                    compound
                );
                fieldChildren.appendChild( optionItem );
            }
            treeRows[ module.name ][ setName ][ fieldName ][ SeLiteSettings.FIELD_TREECHILDREN ]= fieldChildren;
        }
    }
}

/** @param string properties <treerow> or <treecell> 'properties' attribute, which contains space-separated module/set/field/choice name
 *  - as applicable. Do not use with cells for set selection cells.
 *  @param level object of RowLevel. Here it acts more like a 'column' level, indicating which level we want the name for. Not all levels
 *  may apply. For level===RowLevel.OPTION this may return a string with space(s) in it.
 *  @param string otherwise Value to return if there is no property for this level; optional, '' by default
 *  @return string name for the given level, or value of parameter otherwise
 *  @TODO I would use https://developer.mozilla.org/en-US/docs/Web/API/element.dataset,
 *  but I don't know how to get it for <treerow> element where the user clicked - tree.view doesn't let me.
 * */
function propertiesPart( properties, level, otherwise ) {
    level instanceof RowLevel || fail( "propertiesPart() expects parameter level to be an instance of RowLevel, but its type is " +(typeof level)+ ": " +level );
    var propertiesParts= properties.split( ' ' );
    
    if( level.level>=propertiesParts.length ) {
        return otherwise!==undefined
            ? otherwise
            : '';
    }
    if( level!==RowLevel.OPTION ) {
        return propertiesParts[level.level];
    }
    // For RowLevel.OPTION, we return the part at the index respective to RowLevel.OPTION.level, and any other (optional) parts
    // concatenated with spaces - that's for values that contain space(s)
    propertiesParts= propertiesParts.slice( level.level );
    return propertiesParts.join( ' ');
}

function treeClickHandler( event ) {
    // FYI: event.currentTarget.tagName=='tree'. However, document.getElementById('settingsTree')!=event.currentTarget
    var tree= document.getElementById('settingsTree');
    var row= { value: -1 }; // value is 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
    var column= { value: null }; // value is instance of TreeColumn. See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeColumn
            // column.value.element is one of 'treecol' nodes created above. column.value.type can be TreeColumn.TYPE_CHECKBOX etc.
    tree.boxObject.getCellAt(event.clientX, event.clientY, row, column, {}/*unused, but needed*/ );
    
    if( row.value>=0 && column.value ) {
        var modifiedPreferences= false;
        var rowProperties= tree.view.getRowProperties(row.value); // This requires Gecko 22+ (Firefox 22+). See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeView#getCellProperties%28%29
        var moduleName= propertiesPart( rowProperties, RowLevel.MODULE );
        var module= modules[moduleName];
        var moduleRows= treeRows[moduleName];
        if( column.value!=null && row.value>=0 ) {
            var cellIsEditable= tree.view.isEditable(row.value, column.value);
            var cellValue= tree.view.getCellValue(row.value, column.value); // For checkboxes this is true/false as toggled by the click.
            var cellProperties= tree.view.getCellProperties( row.value, column.value ); // Space-separated properties
            var cellText= tree.view.getCellText(row.value, column.value);
            
            if( allowSets && column.value.element==treeColumnElements.selectedSet && cellIsEditable ) { // Select the clicked set, de-select previously selected set
                cellValue==='true' || fail( 'Only unselected sets should have the set selection column editable.' );
                var selectedSetName= propertiesPart( rowProperties, RowLevel.SET );
                module.setSelectedSetName( selectedSetName );
                modifiedPreferences= true;
                
                for( var setName in moduleRows ) {
                    var treeRow= moduleRows[setName][SeLiteSettings.SET_SELECTION_ROW];
                    var cell= treeCell( treeRow, RowLevel.SET, true );
                    cell.setAttribute( 'editable', ''+(setName!==selectedSetName) );
                    if( setName!==selectedSetName) {
                        cell.setAttribute( 'value', 'false' );
                    }
                }
            }
            if( column.value.element==treeColumnElements.checked && cellIsEditable ) {
                var setName= propertiesPart( rowProperties, RowLevel.SET );
                var field= module.fields[ propertiesPart( rowProperties, RowLevel.FIELD ) ];
                var isSingleNonChoice= !(field.multivalued || field instanceof SeLiteSettings.Field.Choice);
                
                if( isSingleNonChoice  ) {
                    field instanceof SeLiteSettings.Field.Bool || fail('field ' +field.name+ ' should be Field.Bool');
                    var clickedCell= treeCell( moduleRows[setName][field.name], RowLevel.CHECKBOX );
                    field.setValue( setName, clickedCell.getAttribute( 'value')==='true' );
                }
                else {
                    var clickedOptionKey= propertiesPart( rowProperties, RowLevel.OPTION );
                    var clickedTreeRow= moduleRows[setName][field.name][ clickedOptionKey ];
                    var clickedCell= treeCell( clickedTreeRow, RowLevel.CHECKBOX );
                    
                    if( !field.multivalued ) { // field is a single-valued choice. Uncheck & remove the previously checked value.
                        clickedCell.setAttribute( 'editable', 'false');
                        for( var otherOptionKey in moduleRows[setName][field.name] ) { // de-select the previously selected value, make editable
                            
                            if( SeLiteSettings.reservedNames.indexOf(otherOptionKey)<0 && otherOptionKey!==clickedOptionKey ) {
                                var otherOptionRow= moduleRows[setName][field.name][otherOptionKey];
                                
                                var otherOptionCell= treeCell( otherOptionRow, RowLevel.CHECKBOX );
                                if( targetFolder===null && otherOptionCell.getAttribute('value')==='true' ) {
                                    otherOptionCell.setAttribute( 'value', 'false');
                                    otherOptionCell.setAttribute( 'editable', 'true');
                                    field.removeValue( setName, otherOptionKey );
                                }
                            }
                        }
                        field.addValue( setName, clickedOptionKey );
                    }
                    else {
                        clickedCell.getAttribute('value')==='true' // That is *after* the click
                            ? field.addValue( setName, clickedOptionKey )
                            : field.removeValue( setName, clickedOptionKey );
                    }
                }
                modifiedPreferences= true;
            }
            var field;
            if( column.value.element==treeColumnElements.value || column.value.element==treeColumnElements.action ) {
                field= module.fields[ propertiesPart(rowProperties, RowLevel.FIELD) ];
            }
            if( column.value.element==treeColumnElements.value ) {
                if( cellIsEditable && rowProperties) {
                    if( targetFolder===null ) {
                        if( !(field instanceof SeLiteSettings.Field.FileOrFolder) ) {
                            tree.startEditing( row.value, column.value );
                        }
                        else {
                            chooseFileOrFolder( field, tree, row.value, column.value, field.isFolder ); // On change that will trigger my custom setCellText()
                        }
                    }
                }
            }
            if( column.value.element===treeColumnElements.action ) {
                if( cellProperties==='' ) {
                    if( cellText===CREATE_NEW_SET ) {
                        var setName= prompt('Enter the new set name');
                        if( setName ) {
                            module.createSet( setName );
                            SeLiteSettings.savePrefFile(); // Must save here, before reload()
                            window.location.reload();//@TODO ?module=...&set=...
                            // @TODO URL param set -> selectedSet
                            // @TODO support ?selectedModule=...&selectedSet=...
                            // and ?module=...& selectedSet=...
                        }
                    }
                    var setName= propertiesPart( rowProperties, RowLevel.SET );
                    if( cellText===DELETE_THE_SET ) {
                        if( setName===module.selectedSetName() ) {
                            alert( "Please select (or create and select) a different set before you remove this one." );
                            return;
                        }
                        module.removeSet( setName);
                        SeLiteSettings.savePrefFile(); // Must save here, before reload()
                        window.location.reload();
                    }
                    if( (cellText===ADD_NEW_VALUE || cellText===DELETE_THE_VALUE) ) {
                        if( !field.multivalued || field instanceof SeLiteSettings.Field.Choice ) {
                            fail( 'We only allow Add/Delete buttons for non-choice multivalued fields, but it was triggered for field ' +field.name );
                        }
                        var treeChildren= moduleRows[setName][field.name][SeLiteSettings.FIELD_TREECHILDREN];
                        if( cellText===ADD_NEW_VALUE ) {
                            // Add a row for a new value, right below the clicked row (i.e. at the top of all existing values)
                            var pair= {};
                            pair[ SeLiteSettings.NEW_VALUE_ROW ]= SeLiteSettings.NEW_VALUE_ROW;
                            // Since we're editing, that means targetFolder===null, so I don't need to generate anything for navigation from folder view here.
                            var treeItem= generateTreeItem(module, setName, field, pair, RowLevel.OPTION, false, /*Don't show the initial value:*/true );

                            var previouslyFirstValueRow= null;
                            for( var key in moduleRows[setName][field.name] ) {
                                if( SeLiteSettings.reservedNames.indexOf(key)<0 ) {
                                    previouslyFirstValueRow= moduleRows[setName][field.name][key];
                                    if( !(previouslyFirstValueRow instanceof XULElement) || previouslyFirstValueRow.tagName!=='treerow' || previouslyFirstValueRow.parentNode.tagName!=='treeitem' ) {
                                        throw Error();
                                    }
                                    break;
                                }
                            }
                            // Firefox 22.b04 and 24.0a1 doesn't handle parent.insertBefore(newItem, null), even though it should - https://developer.mozilla.org/en-US/docs/Web/API/Node.insertBefore
                            if(true) {//@TODO test in new Firefox, choose one branch
                                if( previouslyFirstValueRow!==null ) {
                                    treeChildren.insertBefore( treeItem, previouslyFirstValueRow.parentNode );
                                }
                                else {
                                    treeChildren.appendChild( treeItem );
                                }
                            }
                            else {
                                treeChildren.insertBefore( treeItem,
                                    previouslyFirstValueRow!==null
                                        ? previouslyFirstValueRow.parentNode
                                        : null );
                            }
                            if( treeChildren.parentNode.getAttribute('open')!=='true' ) {
                                treeChildren.parentNode.setAttribute('open', 'true');
                            }
                            tree.boxObject.ensureRowIsVisible( row.value+1 );
                            if( field instanceof SeLiteSettings.Field.FileOrFolder ) {
                                chooseFileOrFolder( field, tree, row.value+1, column.value, field.isFolder ); // On change that will trigger my custom setCellText()
                            }
                            else {
                                tree.startEditing( row.value+1, treeColumn(treeColumnElements.value) );
                            }
                        }
                        if( cellText===DELETE_THE_VALUE ) {
                            var clickedOptionKey= propertiesPart( rowProperties, RowLevel.OPTION );
                            var clickedTreeRow= moduleRows[setName][field.name][ clickedOptionKey ];
                            delete moduleRows[setName][field.name][ clickedOptionKey ];
                            treeChildren.removeChild( clickedTreeRow.parentNode );
                            field.removeValue( setName, clickedOptionKey ); //@TODO error here?
                            modifiedPreferences= true;
                        }
                    }
                }
                else {
                    window.open( '?module=' +escape(module.name)+ '&set=' +escape(cellText), '_blank');
                }
            }
            if( column.value.element===treeColumnElements.manifest && cellProperties!=='' ) {
                if( cellProperties!==SeLiteSettings.FIELD_DEFAULT ) {
                    if( cellProperties.startsWith(SeLiteSettings.ASSOCIATED_SET) ) {
                        var folder= cellProperties.substring( SeLiteSettings.ASSOCIATED_SET.length+1 );
                        window.open( 'file://' +OS.Path.join(folder, SeLiteSettings.ASSOCIATIONS_MANIFEST_FILENAME), '_blank' );
                    }
                    else {
                        ensure( cellProperties.startsWith(SeLiteSettings.VALUES_MANIFEST) );
                        var folder= cellProperties.substring( SeLiteSettings.VALUES_MANIFEST.length+1 );
                        window.open( 'file://' +OS.Path.join(folder, SeLiteSettings.VALUES_MANIFEST_FILENAME), '_blank' );
                    }
                }
                else {
                    window.open( SeLiteSettings.fileNameToUrl(module.definitionJavascriptFile), '_blank' );
                }
            }
        }
        if( modifiedPreferences ) {
            SeLiteSettings.savePrefFile();
            moduleSetFields[moduleName][setName]= module.getFieldsOfSet( setName );
        }
    }
}

/** Gather some information about the cell, the field, set and module.
 *  Validate the value.
 * @param row is 0-based index among the expanded rows, not all rows.
 * @param string value new value (as typed)
 *  @return mixed an anonymous object {
       module: ??,
        rowProperties: string,
        setName: string,
        field: ??,
        treeRow: ??,
        oldKey: string, the key as it was before this edit, only used when it's a multi-valued field
        validationPassed: boolean,
        valueChanged: boolean,
        fieldTreeRowsOrChildren: object serving as an associative array, with values being <treerow> or <treechildren> objects for the field {
            string value or option key => <treerow> object
            ...
            SeLiteSettings.FIELD_MAIN_ROW => <treerow> for the main (collapsible) level of this field
            SeLiteSettings.FIELD_TREECHILDREN => <treechildren>
            SeLiteSettings.NEW_VALUE_ROW => <treerow> for the new value to be added (not saved yet), optional
        }
 *  }
 * */
function gatherAndValidateCell( row, value ) {
    var tree= document.getElementById( 'settingsTree' );
    var rowProperties= tree.view.getRowProperties(row);

    var moduleName= propertiesPart( rowProperties, RowLevel.MODULE );
    var module= modules[moduleName];
    var setName= propertiesPart( rowProperties, RowLevel.SET );
    var fieldName= propertiesPart( rowProperties, RowLevel.FIELD );
    var field= module.fields[fieldName];

    var moduleRows= treeRows[moduleName];
    var fieldTreeRowsOrChildren= null; //Non-null only if field.multivalued==true
    var treeRow;
    var oldKey;
    var validationPassed= true;
    var valueChanged;
    if( !field.multivalued ) {
        treeRow= moduleRows[setName][fieldName];
        // @TODO Docs Can't use treeRow.constructor.name here - because it's a native object.
        if( !(treeRow instanceof XULElement) || treeRow.tagName!=='treerow') {
            throw new Error( 'treeRow should be an instance of XULElement for a <treerow>.');
        }
        // I don't set oldKey variable here, because I don't need it in the result to return
        var oldEntry= moduleSetFields[moduleName][setName][fieldName].entry;
        valueChanged= value!==''+oldEntry
            && !(value==='null' && oldEntry===null)
            && !(value==='undefined' && oldEntry===undefined);
    }
    else {
        fieldTreeRowsOrChildren= moduleRows[setName][fieldName];
        fieldTreeRowsOrChildren instanceof SortedObjectTarget || fail( "fieldTreeRowsOrChildren should be an instance of SortedObjectTarget, but it is " +fieldTreeRowsOrChildren.constructor.name );
        oldKey= propertiesPart( rowProperties, RowLevel.OPTION );
        valueChanged= value!==oldKey;
        if( valueChanged ) {
            if( value in fieldTreeRowsOrChildren ) {
                console.warn( "Values must be unique. Another entry for field " +field.name+ " already has same value " +value ); //@TODO?
                validationPassed= false;
            }
        }
        treeRow= fieldTreeRowsOrChildren[oldKey];
    }
    //@TODO custom field validation?
    if( field instanceof SeLiteSettings.Field.Int ) {
        var numericValue= Number(value);
        if( isNaN(numericValue) || numericValue!==Math.round(numericValue) ) { // Can't compare using value===Number.NaN
            //alert( "This field accepts integer (whole numbers) only." ); //@TODO?
            validationPassed= false;
        }
    }
    return {
        module: module,
        rowProperties: rowProperties,
        setName: setName,
        field: field,
        fieldTreeRowsOrChildren: fieldTreeRowsOrChildren,
        treeRow: treeRow,
        oldKey: oldKey,
        validationPassed: validationPassed,
        valueChanged: valueChanged
    };
}

/** This - nsITreeView.setCellText() - gets triggered only for string/number fields and for File fields; not for checkboxes.
 * @param info Result of  gatherAndValidateCell(..), if it was successful.
 * * @param value new value
 * */
function setCellText( info, value ) {
    var module= info.module;
    var setName= info.setName;
    var field= info.field;
    var fieldTreeRowsOrChildren= info.fieldTreeRowsOrChildren;
    var treeRow= info.treeRow;
    var oldKey= info.oldKey;
    if( !field.multivalued ) {
        field.setValue( setName, value );
    }
    else {
        var rowAfterNewPosition= null; // It may be null - then append the new row at the end; if same as treeRow, then the new value stays in treeRow.
            // If the new value still fits at the original position, then rowAfterNewPosition will be treeRow.
        for( var otherKey in fieldTreeRowsOrChildren ) {
            // Following check also excludes SeLiteSettings.NEW_VALUE_ROW, because we don't want to compare it to real values. 
            if( SeLiteSettings.reservedNames.indexOf(otherKey)<0 && field.compareValues(otherKey, value)>=0 ) {
                rowAfterNewPosition= fieldTreeRowsOrChildren[otherKey];
                break;
            }
        }
        if( rowAfterNewPosition===null && fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW] && Object.keys(fieldTreeRowsOrChildren).length===3 ) {
            // fieldTreeRowsOrChildren has 3 keys: SeLiteSettings.FIELD_MAIN_ROW, SeLiteSettings.FIELD_TREECHILDREN, SeLiteSettings.NEW_VALUE_ROW.
            // So there's no other existing value, and the row being edited is a new one (it didn't have a real value set yet)
            fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW]===treeRow && oldKey===SeLiteSettings.NEW_VALUE_ROW
            || fail( "This assumes that if fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW] is set, then that's the row we're just editing." );
            rowAfterNewPosition= treeRow;
        }
        if( rowAfterNewPosition!==treeRow ) { // Repositioning - remove treeRow, create a new treeRow
            var treeChildren= fieldTreeRowsOrChildren[SeLiteSettings.FIELD_TREECHILDREN];
            treeChildren.removeChild( treeRow.parentNode );
            var pair= {};
            pair[ value ]= value;
            var treeItem= generateTreeItem( module, setName, field, pair, RowLevel.OPTION ); // This sets 'properties' and it adds an entry to treeRow[value]
                // (which is same as fieldTreeRowsOrChildren[value] here).
            // Firefox 22.b04 and 24.0a1 doesn't handle parent.insertBefore(newItem, null), even though it should - https://developer.mozilla.org/en-US/docs/Web/API/Node.insertBefore
            if(true){//@TODO cleanup
                if( rowAfterNewPosition!==null ) {
                    treeChildren.insertBefore( treeItem, rowAfterNewPosition.parentNode );
                }
                else {
                    treeChildren.appendChild( treeItem );
                }
            }
            else {
                treeChildren.insertBefore( treeItem,
                rowAfterNewPosition!==null
                    ? rowAfterNewPosition.parentNode
                    : null );
            }
            treeItem.focus();
        }
        else { // No repositioning - just update 'properties' attribute
            fieldTreeRowsOrChildren[value]= treeRow;
            var propertiesPrefix= info.rowProperties.substr(0, /*length:*/info.rowProperties.length-oldKey.length); // That includes a trailing space
            treeRow.setAttribute( 'properties', propertiesPrefix+value );
        }
        delete fieldTreeRowsOrChildren[oldKey];
        if( oldKey!==SeLiteSettings.NEW_VALUE_ROW ) {
            field.removeValue( setName, oldKey );
        }
        field.addValue( setName, value );
    }
    SeLiteSettings.savePrefFile();
}

function createTreeView(original) {
    return {
        get rowCount() { return original.rowCount; },
        get selection() { return original.selection; },
        set selection(newValue) { return original.selection= newValue; },
        canDrop: function(index, orientation, dataTransfer) { return original.canDrop(index, orientation, dataTransfer); },
        cycleCell: function(row, col) { return original.cycleCell(row, col); },
        cycleHeader: function(col) { return original.cycleHeader(col); },
        drop: function(row, orientation, dataTransfer) { return original.drop(row, orientation, dataTransfer ); },
        getCellProperties: function(row, col) { return original.getCellProperties(row, col); },
        getCellText: function(row, col) { return original.getCellText(row, col); },
        getCellValue: function(row, col) { return original.getCellValue(row, col); },
        getColumnProperties: function(col, properties ) { return original.getColumnProperties(col, properties); },
        getImageSrc: function(row, col) { return original.getImageSrc(row, col); },
        getLevel: function(index) { return original.getLevel(index); },
        getParentIndex: function(rowIndex) { return original.getParentIndex(rowIndex); },
        getProgressMode: function(row ) { return original.getProgressMode(row); },
        getRowProperties: function(index) { return original.getRowProperties(index); },
        hasNextSibling: function(rowIndex, afterIndex) { return original.hasNextSibling(rowIndex, afterIndex); },
        isContainer: function(index) { return original.isContainer(index); },
        isContainerEmpty: function(index) { return original.isContainerEmpty(index); },
        isContainerOpen: function(index) { return original.isContainerOpen(index); },
        isEditable: function(row, col) { return original.isEditable(row, col); },
        isSelectable: function(row, col) { return original.isSelectable(row, col); },
        isSeparator: function(index) { return original.isSeparator(index); },
        isSorted: function() { return original.isSorted(); },
        performAction: function(action) { return original.performAction(action); },
        performActionOnCell: function(action, row, col) { return original.performActionOnCell(action, row, col); },
        performActionOnRow: function(action, row) { return original.performActionOnRow(action, row); },
        selectionChanged: function() { return original.selectionChanged(); },
        setCellText: function(row, col, value) {
            // I don't use parameter col in my own methods, because I use module definition to figure out the editable cell.
            // If we had more than one editable cell per row, then I'd have to use parameter col.
            var info= gatherAndValidateCell( row, value );
            if( info.validationPassed ) {
                var result= original.setCellText(row, col, value);
                if( info.valueChanged ) {
                    setCellText( info, value );
                    if( !info.field.multivalued ) {
                        treeCell( info.treeRow, RowLevel.FIELD ).setAttribute( 'properties', '' );
                        moduleSetFields[info.module.name][info.setName][info.field.name].entry= value;
                    }
                    else {
                        moduleSetFields[info.module.name][info.setName]= info.module.getFieldsOfSet( info.setName );
                    }
                }
                return result;
            }
            alert('Field ' +info.field.name+ " can't accept value "+ value);
            //I wanted to keep the field as being edited, but this didn't work here in Firefox 24.0: document.getElementById( 'settingsTree' ).startEditing( row, col );
            if( info.field.multivalued && info.fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW] ) {
                info.fieldTreeRowsOrChildren[SeLiteSettings.FIELD_TREECHILDREN].removeChild( info.fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW].parentNode );
                delete treeRows[info.module.name][info.setName][info.field.name][SeLiteSettings.NEW_VALUE_ROW];
            }
            return false;
        },
        setCellValue: function(row, col, value) { return original.setCellValue(row, col, value); },
        setTree: function(tree) { return original.setTree(tree); },
        toggleOpenState: function(index) { return original.toggleOpenState(index); }
    }
}

/** Set/unset special value for the field in the preferences, if the change involves setting/unsetting a special value
 *  - that is, SeLiteSettings.VALUE_PRESENT or SeLiteSettings.NULL.
 *  Don't actually set/add/remove any actual value (other than a special value).
 *  Update 'properties' attribute and Null/Undefine label, if needed.
 *  Reload moduleSetFields for this set.
 *  @param setName string Name of the set; empty if the module doesn't allow multiple sets
 *  @param field Field instance
 *  @param int addOrRemove +1 if adding entry; -1 if removing it; any of 0/null/undefined if replacing or setting to null/undefined.
 *  It can be one of +1, -1 only if field.multivalued.
 *  @param mixed keyOrValue the value to store, or (for Choice) the key for the value to store.
 *  It can be anything (and is not used) if addOrRemove is +1 or -1. Otherwise
 *  It should have been validated - this function doesn't validate keyOrValue.
 *  It can be null if it's a single-valued field.
 *  It can be undefined if field.allowsNotPresent; then if it is multi-valued, the field must have
 *  no actual values (but it can/should contain VALUE_PRESENT).
 * */
function updateSpecial( setName, field, addOrRemove, keyOrValue ) {
    !addOrRemove || field.multivalued || fail("addOrRemove can be one of +1, -1 only if field.multivalued. addOrRemove is " +addOrRemove+ " and field.multivalued is " +field.multivalued);
    addOrRemove || keyOrValue!==undefined || field.allowsNotPresent || fail("Field " +field.name+ " doesn't have allowsNotPresent true, but keyOrValue is undefined.");
    addOrRemove || keyOrValue!==null || !field.multivalued || fail("Field " +field.name+ " is multivalued, yet keyOrValue is null.");
    var setNameDot= setName
        ? setName+'.'
        : setName;
    var compound= moduleSetFields[field.module.name][setName][field.name];
    if( addOrRemove ) {
        if( addOrRemove>0 ) {
            if( Object.keys(compound.entry).length===0 && field.module.prefsBranch.prefHasUserValue(setNameDot+field.name) ) {
                field.module.prefsBranch.clearUserPref( setNameDot+field.name); // Clearing VALUE_PRESENT @TODO see @TODO below
            }
        }
        else {
            if( Object.keys(compound.entry).length===1 ) {//@TODO Do we call this function before we add/remove the value from preferences, or after?
                field.module.prefsBranch.setCharPref( setNameDot+ field.name, SeLiteSettings.VALUE_PRESENT );
            }
        }
    }
    else {
        if( keyOrValue===null ) {
            if( field.module.prefsBranch.prefHasUserValue(setNameDot+field.name) && field.prefType()!==nsIPrefBranch.PREF_STRING ) {
                field.module.prefsBranch.clearUserPref( setNameDot+field.name);
            }
            field.module.prefsBranch.setCharPref( setNameDot+field.name, SeLiteSettings.NULL );
        }
        else
        if( keyOrValue===undefined ) {
            !field.multivalued || Object.keys(compound.entry).length===0 || fail("Multivalued field " +field.name+ " has one or more entries, therefore keyOrValue must not be undefined.");
            if( field.module.prefsBranch.prefHasUserValue(setNameDot+field.name) ) {
                this.module.prefsBranch.clearUserPref(setNameDot+field.name);
            }
        }
        // Otherwise, if the field had NULL, then I don't clear that preference here, because that preference gets set outside of this function
    }
    moduleSetFields[field.module.name][setName]= TODO;
}

/* @var allowSets bool Whether to show the column for selection of a set. If we're only showing one module, this is module.allowSets
 * if we're not showing fields per folder.
 *  If we're showing more modules, then it's true if at least one of those modules has allowSets==true if we're not showing fields per folder.
 *  This will be set depending on the definition of module(s).
*/
var allowSets= false;
/** @var allowMultivaluedNonChoices bool Whether we allow multivalued non-choice (free text) fields.
 *  If allowMultivaluedNonChoices or allowSets, then we show 'Action' column.
 *  This will be set depending on the definition of module(s).
 */
var allowMultivaluedNonChoices= false;

/** @var mixed Null if we're showing configuration set(s) irrelevant of a folder. Otherwise it's 
 *  a string, absolute path to the folder we're applying the overall configuration.
 *  This will be set depending on how this file is invoked.
 * */
var targetFolder= null;

/** Create an object for a new <treechildren>. Add it to the parent.
 *  @return XULElement for the new <treechildren>
 * */
function createTreeChildren( parent ) {
    if( !(parent instanceof XULElement)
    || parent.tagName!=='treeitem' && parent.tagName!=='tree' ) {
        throw new Error( 'createTreeChildren() requires parent to be an object for <treeitem> or <tree>.');
    }
    var treeChildren= document.createElementNS( XUL_NS, 'treechildren');
    if( parent.tagName!=='tree' ) {
        parent.setAttribute('container', 'true');
        parent.setAttribute('open', 'false');
    }
    parent.appendChild( treeChildren);
    return treeChildren;
}

/** Anonymous object serving as a multidimensional associative array {
 *      string module name: {
 *          string set name (possibly empty): result of Module.getFieldsOfSet();
 *      }
        It's only populated, updated and used in set mode; not in per-folder mode.
 *      Purpose: setCellText() uses it to determine whether in a single-valued string field
 *      'undefined' or 'null' are the actual values, or indicators of the field being undefined/null in that set.
 *      I also use it at some places that call nullOrUndefineLabel().
 *  }
 * */
var moduleSetFields= {};

window.addEventListener( "load", function(e) {
    var params= document.location.search.substring(1);
    if( document.location.search ) {
        if( /load/.exec( params ) ) {
            var result= {};
            if( promptService.select(
                window,
                'How to load a module definition',
                'You are about to load a Javascript definition of your module. How would you enter it?',
                2,
                ['Locate as a local file', 'Enter a url'],
                result
            ) ) {
                var url= null;
                if( result.value===0 ) {
                    var file= chooseJavascriptFile();
                    if( file ) {
                        //var file= new FileUtils.File(fileName);
                        url= Services.io.newFileURI( file );
                    }
                }
                else {
                    var urlText= prompt( "Please enter the full URL to your Javascript file." );
                    if( urlText ) {
                        url= nsIIOService.newURI( urlText, null, null);
                    }
                }
                if( url ) {
                    subScriptLoader.loadSubScript( url.spec, {} );
                    window.location.search= '';
                }
            }
            return;
        }
        var match= /folder=([^&]*)/.exec( params );
        if( match ) {
            targetFolder= unescape( match[1] );
        }
        var match= /module=([a-zA-Z0-9_.-]+)/.exec( params );
        var moduleName= null;
        if( match ) {
            moduleName= unescape( match[1] );
            modules[ moduleName ]= SeLiteSettings.loadFromJavascript( moduleName, false );
            ensure( !targetFolder || modules[moduleName].associatesWithFolders, "You're using URL with folder=" +targetFolder+
                " and module=" +moduleName+ ", however that module doesn't allow to be associated with folders." );
        }
        match= /prefix=([a-zA-Z0-9_.-]+)/.exec( params );
        var prefix= '';
        if( match ) {
            prefix= unescape( match[1] );
        }
        if( /selectFolder/.exec(params) ) {
            var newTargetFolder= chooseFileOrFolder( null, null, null, null, true/*isFolder*/, targetFolder );
            if( newTargetFolder ) {
                var newLocation= "?";
                if( moduleName ) {
                    newLocation+= "module=" +moduleName+ "&";
                }
                if( prefix ) {
                    newLocation+= "prefix="+prefix+ "&";
                }
                newLocation+= "folder=" +escape(newTargetFolder);
                document.location= newLocation;
            }
        }
    }
    var allowModules= false; // true if we list all modules (if any); false if we just list one named in URL parameter 'module' (if any)
    if( isEmptyObject(modules) ) {
        allowModules= true;
        var moduleNames= SeLiteSettings.moduleNamesFromPreferences( prefix );
        for( var i=0; i<moduleNames.length; i++ ) {
            var module= SeLiteSettings.loadFromJavascript( moduleNames[i], false );
            if( targetFolder===null || module.associatesWithFolders ) {
                modules[ moduleNames[i] ]= module;
            }
        }
    }
    var settingsBox= document.getElementById('SeSettingsBox');
    var tree= document.createElementNS( XUL_NS, 'tree' );
    tree.setAttribute( 'id', 'settingsTree');
    tree.setAttribute( 'editable', ''+(targetFolder===null) );
    tree.setAttribute( 'seltype', 'single' );
    tree.setAttribute( 'hidecolumnpicker', 'true');
    tree.setAttribute( 'hidevscroll', 'false');
    tree.setAttribute( 'class', 'tree');
    tree.setAttribute( 'flex', '1');
    tree.setAttribute( 'rows', '25'); //@TODO This has to be specified, otherwise the tree is not shown at all (except for column headers). Investigate
    settingsBox.appendChild( tree );
    
    for( var moduleName in modules ) {
        var module= modules[moduleName];
        allowSets= allowSets || module.allowSets && targetFolder===null;
        
        for( var fieldName in module.fields ) {
            var field= module.fields[fieldName];
            allowMultivaluedNonChoices= allowMultivaluedNonChoices || field.multivalued && field instanceof SeLiteSettings.Field.Choice;
        }
    }
    tree.appendChild( generateTreeColumns(allowModules,  targetFolder!==null) );
    var topTreeChildren= createTreeChildren( tree );
    
    var setNameToExpand= null;
    if( allowModules ) {
        for( var moduleName in modules ) {
            var moduleTreeItem= generateTreeItem( modules[moduleName], null, null, null, RowLevel.MODULE );
            topTreeChildren.appendChild( moduleTreeItem );
            
            var moduleChildren= createTreeChildren( moduleTreeItem );
            generateSets( moduleChildren, modules[moduleName] );
        }
    }
    else
    if( !isEmptyObject(modules) ) {
        for( var moduleName in modules ); // just get moduleName
        
        var moduleChildren;
        if( allowSets && modules[moduleName].allowSets ) {
            var moduleTreeItem= generateTreeItem( modules[moduleName], null, null, null, RowLevel.MODULE );
            topTreeChildren.appendChild( moduleTreeItem );
            moduleChildren= createTreeChildren( moduleTreeItem );
        }
        else {
            moduleChildren= topTreeChildren;
        }
        if( document.location.search ) {
            var match= /set=([a-zA-Z0-9_.-]+)/.exec( params );
            if( match ) {
                setNameToExpand= unescape( match[1] );
            }
        }
        generateSets( moduleChildren, modules[moduleName] );
        tree.view.toggleOpenState(0); // expand the module 
    }
    topTreeChildren.addEventListener( 'click', treeClickHandler );
    tree.view= createTreeView( tree.view );
    if( setNameToExpand ) {
        var setIndex= module.setNames().indexOf(setNameToExpand);
        if( setIndex>=0 ) {
            tree.view.toggleOpenState( setIndex+1 ); // expand the set
        }
    }
}, false);

/** @return nsIFile instance for a javascript file, if picked; null if none.
 * */
function chooseJavascriptFile() {
	var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	filePicker.init(window, "Select a Javascript file with definition of your module(s)", nsIFilePicker.modeOpen);
    filePicker.appendFilter( 'Javascript', '*.js');
    filePicker.appendFilters( nsIFilePicker.filterAll);
	var result= filePicker.show();
	if (result== nsIFilePicker.returnOK || result== nsIFilePicker.returnReplace) {
		return filePicker.file;
	}
    return null
}