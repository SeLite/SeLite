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
Components.utils.import( "chrome://selite-misc/content/extensions/selite-misc.js" );
seliteAlert.go= function(msg) { alert(msg); };
var CREATE_NEW_SET= "Create a new set";
var DELETE_THE_SET= "Delete the set";
var ADD_NEW_VALUE= "Add a new value";
var DELETE_THE_VALUE= "Delete the value";

/** @param field Instance of SeLiteSettings.Field.File or its subclass (SeLiteSettings.prototype.Field.SQLite)
 *  @param tree
 *  @param row int 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
        var column= { value: null }; // value is instance of TreeColumn.
    @param column instance of TreeColumn
    @return void
 * */
function chooseFile( field, tree, row, column ) {
	var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	filePicker.init(window, "Select a file for " +field.name, nsIFilePicker.modeOpen);
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
        var file= new FileUtils.File(previousValue);
        if( file.exists() ) {
            filePicker.defaultString= file.leafName;
        }
        if( file.parent!==null && file.parent.exists() ) {
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
	var result= filePicker.show();
	if (result== nsIFilePicker.returnOK || result== nsIFilePicker.returnReplace) {
		tree.view.setCellText(row, column, filePicker.file.path );
	}
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
    if( typeof level==='undefined' ) {
        level= -1;
    }
    if( typeof blank==='undefined') {
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
    action: null
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
 * @return node object for <treecols>
 * */
function generateTreeColumns( allowModules ) {
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
        treecol.setAttribute('editable', ''+allowSets );
        treecol.setAttribute( 'ordinal', '3');
        treecols.appendChild(treecol);
        
        splitter= document.createElementNS( XUL_NS, 'splitter' );
        splitter.setAttribute( 'ordinal', '4');
        treecols.appendChild( splitter );
    }
    
    treecol= treeColumnElements.checked= document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label', 'True');
    treecol.setAttribute('type', 'checkbox');
    treecol.setAttribute('editable', 'true');
    treecol.setAttribute( 'ordinal', '5');
    treecols.appendChild(treecol);

    splitter= document.createElementNS( XUL_NS, 'splitter' );
    splitter.setAttribute( 'ordinal', '6');
    treecols.appendChild( splitter );
    
    treecol= treeColumnElements.value= document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label', 'Value');
    treecol.setAttribute('editable', 'true');
    treecol.setAttribute( 'flex', '1');
    treecol.setAttribute( 'ordinal', '7');
    treecols.appendChild(treecol);
    
    if( allowSets || allowMultivaluedNonChoices ) {
        splitter= document.createElementNS( XUL_NS, 'splitter' );
        splitter.setAttribute( 'ordinal', '6');
        treecols.appendChild( splitter );

        treecol= treeColumnElements.action= document.createElementNS( XUL_NS, 'treecol');
        treecol.setAttribute('label', 'Action');
        treecol.setAttribute('editable', 'false');
        treecol.setAttribute( 'flex', '1');
        treecol.setAttribute( 'ordinal', '9');
        treecols.appendChild(treecol);
    }
    return treecols;
}

/** Sorted anonymous object serving as an associative array {
 *     string module name => SeLiteSettings.Module object
 *  }
 * */
var modules= sortedObject(true);

/** Sorted object (anonymous in any other respect) serving as multi-level associative array {
    *   string module name => anonymous object {
    *      string set name (it may be an empty string) => sorted object {
    *          one or none: SeLiteSettings.SET_SELECTION_ROW => <treerow> element/object for the row that has a set selection cell
    *             - only if we show set sellection column and the module allows set selection
    *          zero or more: string field name (field is non-choice and single value) => <treerow> element/object for the row that has that field
    *          zero or more: string field name (the field is multivalue or a choice) => anonymous or sorted object {
    *             value fields (ones with keys that are not reserved) are sorted by key, but entries with reserved keys may be at any position
    *             - one: SeLiteSettings.FIELD_MAIN_ROW => <treerow> element/object for the row that contains all options for that field
    *             - one: SeLiteSettings.FIELD_TREECHILDREN => <treechildren> element/object for this field, that contains <treeitem><treerow> levels for each option
    *             - zero or more: string key => <treerow> element/object for the row that contains a value/option
    *             - zero or one: SeLiteSettings.NEW_VALUE_ROW => <treerow> element/object for the row that contains a value that the user will only have to fill in
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
        if( typeof object[fieldName]==='undefined' ) {
            object[fieldName]= sortedObject(true);
        }
        object= object[fieldName];
    }
    return object;
}

/** @param module object of SeLiteSettings.Module
 *  @param setName string set name; either '' if the module doesn't allow sets; otherwise it's a set name when at field level
 *  attribute for the <treerow> nodes, so that when we handle a click event, we know what field the node is for.
 *  @param field mixed, usually an object of a subclass of SeLiteSettings.Field. If rowLevel==RowLevel.MODULE or rowLevel==RowLevel.SET,
 *  then field is null. It's a field present in Preferences DB but not in module definition, then it's a string name of that field.
 *  Otherwise it must be an instance of a subclass of SeLiteSettings.Field.
 *  @param string key 'key' (used as a trailing part of field option preference name);
 *  use for fields of SeLiteSettings.Field.Choice family and for multivalued fields only. For multivalued non-choice fields it should be the same
 *  as parameter value. If the field is of a subclass of SeLiteSettings.Field.Choice, then key and value may be different.
 *  @param valueOrPair
 *  For single valued non-choice fields or fields not defined in module.fields[]
 *  it is the value/label of the field as shown. Ignored if  not applicable.
 *  For multivalued or choice fields it's an anonymous object serving as an array
 *  { string key => string/number ('primitive') valueItself
 *    ....
 *  } where
 *  - key serves as a trailing part of field option preference name)
 *  -- for multivalued non-choice fields it should be the same as valueItself
 *  -- if the field is of a subclass of SeLiteSettings.Field.Choice, then key and valueItself may be different.
 *  - valueItself is the actual value/label as displayed
 *  @param rowLevel object of RowLevel
 *  @param optionIsSelected bool Whether the option is selected. Only used when rowLevel===RowLevel.OPTION and field instanceof SeLiteSettings.Field.Choice.
 *  @param isNewValueRow bool Whether the row is for a new value that will be entered by the user. If so, then this doesn't set the label for the value cell.
 *  It still puts the new <treerow> element to treeRows[moduleName...], so that it can be updated/removed once the user fills in the value. Optional; false by default.
 *  @return object for a new element <treeitem> with one <treerow>
 * */
function generateTreeItem( module, setName, field, valueOrPair, rowLevel, optionIsSelected, isNewValueRow ) {
    var key= null;
    if( !(rowLevel instanceof RowLevel) || rowLevel===RowLevel.CHECKBOX || rowLevel===RowLevel.ACTION ) {
        throw new Error("Parameter rowLevel must be an instance of RowLevel, but not CHECKBOX neither ACTION.");
    }
    if( typeof valueOrPair==='object' && valueOrPair!==null ) {
        if( rowLevel!==RowLevel.OPTION ) {
            throw new Error( "generateTreeItem(): parameter valueOrPair must not be an object, unless RowLevel is OPTION, but that is " +rowLevel );
        }
        if( !(field.multivalued || field instanceof SeLiteSettings.Field.Choice) ) {
            throw new Error( 'generateTreeItem(): parameter valueOrPair can be an object only for multivalued fields or choice fields, but it was used with ' +field );
        }
        for( var keyName in valueOrPair ) {
            if( key!==null ) {
                throw new Error( "generateItem(): parameter valueOrPair can be an object, but with exactly one field, yet it received one with more fields." );
            }
            key= keyName;
        }
        if( key===null ) {
            throw new Error( "generateItem(): parameter valueOrPair can be an object, but with exactly one field, yet it received an empty one." );
        }
    }
    var value= key!==null
        ? valueOrPair[key]
        : valueOrPair;
            
    if( field && typeof field!=='string' && !(field instanceof SeLiteSettings.Field) ) {
        throw new Error( "Parameter field must be an instance of a subclass of SeLiteSettings.Field, unless rowLevel===RowLevel.MODULE or rowLevel===RowLevel.SET, but it is "
            +(typeof field==='object' ? 'an instance of ' +field.constructor.name : typeof field)+ ': ' +field );
    }
    if( typeof optionIsSelected==='undefined' ) {
        optionIsSelected= false;
    }
    if( typeof isNewValueRow==='undefined' ) {
        isNewValueRow= false;
    }
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
        : '';//if( rowLevel===RowLevel.FIELD ) {alert( 'field is Field ' +(field instanceof SeLiteSettings.Field)+ ' - '+fieldName); return;}
    /* This is why I don't allow spaces in module/set/field names. For level===RowLevel.OPTION
     * key may contains space(s). That's why there can't be any more entries in 'properties' after key.
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
            //alert( 'after SET_SELECTION_ROW:\n' +objectToString(treeRows, 4) );
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
        if( !field.multivalued && !(field instanceof SeLiteSettings.Field.Choice) ) {
           subContainer( treeRows, module.name, setName )[ fieldName ]= treerow;
        }
        else {
            subContainer( treeRows, module.name, setName, fieldName )[ SeLiteSettings.FIELD_MAIN_ROW ]= treerow;
        }
        //alert( 'after RowLevel.FIELD:\n' +objectToString(treeRows, 4) );
    }
    if( rowLevel===RowLevel.OPTION ) {
        subContainer( treeRows, module.name, setName, fieldName )[ key ]= treerow;
        //alert( 'after RowLevel.OPTION:\n' +objectToString(treeRows, 4) );
    }
    
    // Cell for checkbox (if the field is boolean or a choice):
    treecell= document.createElementNS( XUL_NS, 'treecell');
    treerow.appendChild( treecell);
    if( rowLevel!==RowLevel.FIELD && rowLevel!==RowLevel.OPTION
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
    if( rowLevel!==RowLevel.FIELD && rowLevel!==RowLevel.OPTION
        || typeof value=='boolean'
        || !(field instanceof SeLiteSettings.Field)
        || field.multivalued && rowLevel===RowLevel.FIELD
        || field instanceof SeLiteSettings.Field.Choice
    ) {
        treecell.setAttribute('editable' , 'false');
    }
    if( (typeof value==='string' || typeof value==='number') && !isNewValueRow ) {
        treecell.setAttribute('label', ''+value);
    }
    
    if( allowSets || allowMultivaluedNonChoices ) {
        // Cell for action:
        treecell= document.createElementNS( XUL_NS, 'treecell');
        treerow.appendChild( treecell);
        treecell.setAttribute('editable', 'false');
        if( rowLevel===RowLevel.MODULE || rowLevel===RowLevel.SET ) {
            treecell.setAttribute( 'label',
                !setName
                    ? (module.allowSets
                        ? CREATE_NEW_SET
                        : ''
                      )
                    : DELETE_THE_SET
            );
        }
        if( field!==null && !(field instanceof SeLiteSettings.Field.Choice) && field.multivalued ) {
            if( rowLevel===RowLevel.FIELD ) {
                treecell.setAttribute( 'label', ADD_NEW_VALUE );
            }
            if( rowLevel===RowLevel.OPTION ) {
                treecell.setAttribute( 'label', DELETE_THE_VALUE );
            }
        }
    }
    return treeitem;
}

/** @param node moduleChildren <treechildren>
 *  @param object module SeLiteSettings.Module
 * */
function generateSets( moduleChildren, module ) {
    var setNames= module.setNames();
    if( !allowSets && setNames.length!==1 ) {
        throw new Error( "allowSets should be set false only if a module has the only set." );
    }
    for( var i=0; i<setNames.length; i++ ) {
        var setName= setNames[i];
        // setFields includes all fields from Preferences DB for the module name, even if they are not in the module definition
        var setFields= module.getFieldsOfSet( setName );
        
        var setChildren= null;
        if( module.allowSets ) {
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

var treeRowsReported= false; //@TODO remove
function generateFields( setChildren, module, setName, setFields ) {
    for( var fieldName in setFields ) {
        var fieldValueOrPairs= setFields[fieldName];
        var field= fieldName in module.fields
            ? module.fields[fieldName]
            : fieldName;
        
        var singleValueOrNull= typeof setFields[fieldName]!=='object'
            ? setFields[fieldName]
            : null;
        var fieldItem= generateTreeItem(module, setName, field, singleValueOrNull, RowLevel.FIELD );
        setChildren.appendChild( fieldItem );
        
        if( field instanceof SeLiteSettings.Field && (field.multivalued || field instanceof SeLiteSettings.Field.Choice) ) {
            var fieldChildren= createTreeChildren( fieldItem );
            var pairsToList= field instanceof SeLiteSettings.Field.Choice
                ? field.choicePairs
                : fieldValueOrPairs;
            
            for( var key in pairsToList ) {////@TODO potential IterableArray
                var pair= {};
                pair[key]= pairsToList[key];
                var optionItem= generateTreeItem(module, setName, field, pair,
                    RowLevel.OPTION,
                    field instanceof SeLiteSettings.Field.Choice
                        && typeof(fieldValueOrPairs)==='object' // This protects when the field has a sick/obsolete non-choice single value in Preferences DB, and no choice value
                        && key in fieldValueOrPairs
                );
                fieldChildren.appendChild( optionItem );
            }
            treeRows[ module.name ][ setName ][ fieldName ][ SeLiteSettings.FIELD_TREECHILDREN ]= fieldChildren;
            /*if( !treeRowsReported )
                alert( 'after generateFields():\n' +objectToString(treeRows, 3, false, ['XULElement', '']) );
            treeRowsReported= true;/**/
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
    if( !(level instanceof RowLevel) ) {
        throw new Error("propertiesPart() expects parameter level to be an instance of RowLevel, but its type is " +(typeof level)+ ": " +level );
    }
    var propertiesParts= properties.split( ' ' );
    
    if( level.level>=propertiesParts.length ) {
        return typeof otherwise!=='undefined'
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
    var pseudoElementHit= {}; // unused, but needed. @TODO Move to the function call, eliminate the variable
    tree.boxObject.getCellAt(event.clientX, event.clientY, row, column, pseudoElementHit );
    
    if( row.value>=0 && column.value ) {
        var modifiedPreferences= false;
        var rowProperties= tree.view.getRowProperties(row.value); // This requires Gecko 22+ (Firefox 22+). See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeBoxObject
        var moduleName= propertiesPart( rowProperties, RowLevel.MODULE );
        var module= modules[moduleName];
        var moduleRows= treeRows[moduleName];
        //alert( objectToString(moduleRows, 3, false, ['XULElement', '']) );

        if( column.value!=null && row.value>=0 ) {
            var cellIsEditable= tree.view.isEditable(row.value, column.value);
            var cellValue= tree.view.getCellValue(row.value, column.value); // For checkboxes this is true/false as toggled by the click.
            var cellText= tree.view.getCellText(row.value, column.value);
            
            if( allowSets && column.value.element==treeColumnElements.selectedSet && cellIsEditable ) { // Select the clicked set, de-select previously selected set
                if( cellValue!=='true') {
                    throw new Error( 'Only unselected sets should have the set selection column editable.' );
                }
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
                    if( !(field instanceof SeLiteSettings.Field.Bool) ) {
                        throw new Error();
                    }
                    var clickedCell= treeCell( moduleRows[setName][field.name], RowLevel.CHECKBOX );
                    field.setValue( setName, clickedCell.getAttribute( 'value')==='true' );
                }
                else {
                    var clickedOptionKey= propertiesPart( rowProperties, RowLevel.OPTION );
                    var clickedTreeRow= moduleRows[setName][field.name][ clickedOptionKey ];
                    var clickedCell= treeCell( clickedTreeRow, RowLevel.CHECKBOX );
                    
                    if( !field.multivalued ) { // field is multivalued non-choice. Uncheck & remove the previously checked value.
                        clickedCell.setAttribute( 'editable', 'false');
                        for( var otherOptionKey in moduleRows[setName][field.name] ) { // de-select the previously selected value, make editable
                            
                            if( SeLiteSettings.reservedNames().indexOf(otherOptionKey)<0 && otherOptionKey!==clickedOptionKey ) {
                                var otherOptionRow= moduleRows[setName][field.name][otherOptionKey];
                                
                                var otherOptionCell= treeCell( otherOptionRow, RowLevel.CHECKBOX );
                                if( otherOptionCell.getAttribute('value')==='true' ) {
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
                    if( !(field instanceof SeLiteSettings.Field.File) ) {
                        tree.startEditing( row.value, column.value );
                    }
                    else {
                        chooseFile( field, tree, row.value, column.value ); // On change that will trigger my custom setCellText()
                    }
                }
            }
            if( column.value.element==treeColumnElements.action ) {
                if( cellText===CREATE_NEW_SET ) {
                    var setName= prompt('Enter the new set name');
                    if( setName ) {
                        module.createSet( setName );
                        SeLiteSettings.savePrefFile(); // Must save here, before reload()
                        window.location.reload();
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
                        throw new Error();
                    }
                    var treeChildren= moduleRows[setName][field.name][SeLiteSettings.FIELD_TREECHILDREN];
                    if( cellText===ADD_NEW_VALUE ) {
                        // Add a row for a new value, right below the clicked row (i.e. at the top of all existing values)
                        var pair= {};
                        pair[ SeLiteSettings.NEW_VALUE_ROW ]= SeLiteSettings.NEW_VALUE_ROW;
                        var treeItem= generateTreeItem(module, setName, field, pair, RowLevel.OPTION, false, /*Don't show the initial value:*/true );
                        
                        var previouslyFirstValueRow= null;
                        for( var key in moduleRows[setName][field.name] ) {
                            if( SeLiteSettings.reservedNames().indexOf(key)<0 ) {
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
                        tree.startEditing( row.value+1, treeColumn(treeColumnElements.value) );
                    }
                    if( cellText===DELETE_THE_VALUE ) {
                        var clickedOptionKey= propertiesPart( rowProperties, RowLevel.OPTION );
                        var clickedTreeRow= moduleRows[setName][field.name][ clickedOptionKey ];
                        delete moduleRows[setName][field.name][ clickedOptionKey ];
                        treeChildren.removeChild( clickedTreeRow.parentNode );
                        field.removeValue( setName, clickedOptionKey );
                        modifiedPreferences= true;
                    }
                }
            }
        }
        if( modifiedPreferences ) {
            SeLiteSettings.savePrefFile();
        }
    }
}

function setCellText( row, col, value ) {
    var tree= document.getElementById( 'settingsTree' );
    // setCellText() gets triggered only for string/number fields and for File fields; not for checkboxes.
    // @param row is 0-based index among the expanded rows, not all rows.
    var rowProperties= tree.view.getRowProperties(row);

    var moduleName= propertiesPart( rowProperties, RowLevel.MODULE );
    var module= modules[moduleName];
    var setName= propertiesPart( rowProperties, RowLevel.SET );
    var fieldName= propertiesPart( rowProperties, RowLevel.FIELD );
    var field= module.fields[fieldName];

    var moduleRows= treeRows[moduleName];
    var fieldTreeRows= null; // Only non-null if field.multivalued==true
    var treeRow;
    if( !field.multivalued ) {
        treeRow= moduleRows[setName][fieldName];
        // @TODO Docs Can't use treeRow.constructor.name here - because it's a native object.
        if( !(treeRow instanceof XULElement) || treeRow.tagName!=='treerow') {
            throw new Error( 'treeRow should be an instance of XULElement for a <treerow>.');
        }
    }
    else {
        fieldTreeRows= moduleRows[setName][fieldName];
        if( !(fieldTreeRows instanceof SortedObjectTarget) ) {
            throw new Error( "fieldTreeRows should be an instance of SortedObjectTarget (actually, a proxy to such an instance), but it is " +fieldTreeRows.constructor.name );
        }
        var oldKey= propertiesPart( rowProperties, RowLevel.OPTION );
        if( value===oldKey ) { //setCellText() is called after editing, even if there was no change
            return;
        }//alert( 'value ' +value+ '\n' +objectToString(fieldTreeRows, 3, false, ['XULElement', '']) );
        if( value in fieldTreeRows ) {
            alert( "Values must be unique. Another entry for this field already has same value " +value );
            return false;
        }
        treeRow= fieldTreeRows[oldKey];
    }

    var cell= treeCell( treeRow, RowLevel.FIELD );
    //alert( Object.keys(fieldTreeRows) );
    //@TODO custom field validation?
    if( field instanceof SeLiteSettings.Field.Int ) {
        var numericValue= Number(value);
        if( isNaN(numericValue) || numericValue!==Math.round(numericValue) ) { // Can't compare using value===Number.NaN
            alert( "This field accepts integer (whole numbers) only." );
            return false;
        }
    }
    if( !field.multivalued ) {
        field.setValue( setName, value );
    }
    else {
        var rowAfterNewPosition= null; // It may be null - then append the new row at the end; if same as treeRow, then the new value stays in treeRow.
            // If the new value still fits at the original position, then rowAfterNewPosition will be treeRow.
        //alert( objectToString(fieldTreeRows, 3, false, ['XULElement', '']) );
        var debugOtherKeys= [];
        for( var otherKey in fieldTreeRows ) {
            debugOtherKeys.push( otherKey );
            // Following check also excludes SeLiteSettings.NEW_VALUE_ROW, because we don't want to compare it to real values. 
            //!==SeLiteSettings.FIELD_MAIN_ROW && otherKey!==SeLiteSettings.FIELD_TREECHILDREN 
            if( SeLiteSettings.reservedNames().indexOf(otherKey)<0 && field.compareValues(otherKey, value)>=0 ) {
                rowAfterNewPosition= fieldTreeRows[otherKey];
                break;
            }
        }
        alert( 'debugOtherKeys: ['+debugOtherKeys+ '], rowAfterNewPosition found: ' +(rowAfterNewPosition==null) );
        //seliteAlert.go.call(null, 'rowAfterNewPosition found: ' +(rowAfterNewPosition==null));
        if( rowAfterNewPosition===null && fieldTreeRows[SeLiteSettings.NEW_VALUE_ROW] && Object.keys(fieldTreeRows).length===3 ) {
            // there's no other existing value, and the row being edited is a new one (it didn't have a real value set yet)
            if( fieldTreeRows[SeLiteSettings.NEW_VALUE_ROW]!==treeRow || oldKey!==SeLiteSettings.NEW_VALUE_ROW ) {
                throw new Error( "This assumes that if fieldTreeRows[SeLiteSettings.NEW_VALUE_ROW] is set, then that's the row we're just editing." );
            }
            rowAfterNewPosition= treeRow;
        }
        if( rowAfterNewPosition!==treeRow ) { // Repositioning - remove treeRow, create a new treeRow
            var treeChildren= fieldTreeRows[SeLiteSettings.FIELD_TREECHILDREN];
            treeChildren.removeChild( treeRow.parentNode );
            var pair= {};
            pair[ value ]= value;
            var treeItem= generateTreeItem( module, setName, field, pair, RowLevel.OPTION ); // This sets 'properties' and it adds an entry to moduleRows[setName][fieldName][value]
                // (which is same as fieldTreeRows[value] here).
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
            fieldTreeRows[value]= treeRow;
            var propertiesPrefix= rowProperties.substr(0, /*length:*/rowProperties.length-oldKey.length); // That includes a trailing space
            treeRow.setAttribute( 'properties', propertiesPrefix+value );
        }
        delete fieldTreeRows[oldKey];
        if( oldKey!==SeLiteSettings.NEW_VALUE_ROW ) {
            field.removeValue( setName, oldKey );
        }
        field.addValue( setName, value );
    }
    SeLiteSettings.savePrefFile();
}

/*function TreeView(originalView) {
    this.originalView= originalView;
    this.rowCount = originalView.rowCount;
    this.selection= originalView.selection;
    
    this.getCellText = function(row, col) {
        return this.originalView.getCellText( row, col );
    };
    this.setCellText = function(row, col, value) {
        setCellText( row, col, value );
        return this.originalView.setCellText( row, col, value );
    };
    this.getCellValue = function(row, col) {
            return this.originalView.getCellValue(row, col);
    };
    this.setTree = function(treebox) {
            this.treebox = treebox;
            return this.originalView.setTree(treebox);
    };
    this.isEditable = function(row, col) {
            return this.originalView.isEditable(row, col);;
    };
    this.isContainer = function(row){
        return this.originalView.isContainer(row);
    };
    this.isContainerOpen= function(row){
        return this.originalView.isContainerOpen(row);
    };
    this.isContainerEmpty= function(row){
        return this.originalView.isContainerEmpty(row);
    };
    this.isSeparator = function(row){
        return this.originalView.isSeparator(row);
    };
    this.isSorted = function(){
        return this.originalView.isSorted(); 
    };
    this.getLevel = function(row){
        return this.originalView.getLevel(row);
    };
    this.getParentIndex= function(row) {
        return this.originalView.getParentIndex(row);
    };
    this.getImageSrc = function(row,col){
        return this.originalView.getImageSrc(row, col);
    };
    this.getRowProperties = function(row,props) {
        return this.originalView.getRowProperties(row, props);
    };
    this.getCellProperties = function(row,col,props){
        return this.originalView.getCellProperties(row, col, props);
    };
    this.getColumnProperties = function(colid,col,props){
        return this.originalView.getColumnProperties(colid, col, props);
    };
    this.cycleHeader = function(col, elem) {
        return this.originalView.cycleHeader(col, elem);
    }
    this.setCellValue= function( row, col, value ) {
        return this.originalView.setCellValue( row, col, value );
    };
    this.toggleOpenState= function(row) {
        return this.originalView.toggleOpenState( row );
    };
}/**/
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
            setCellText( row, col, value );
            return original.setCellText(row, col, value);
        },
        setCellValue: function(row, col, value) { return original.setCellValue(row, col, value); },
        setTree: function(tree) { return original.setTree(tree); },
        toggleOpenState: function(index) { return original.toggleOpenState(index); }
    }
}
    
/* @var allowSets bool Whether to show the column for selection of a set. If we're only showing one module, this is module.allowSets.
 *  If we're showing more modules, then it's true if at least one of those modules has allowSets==true.
*/
var allowSets= false;
/** @var allowMultivaluedNonChoices bool Whether we allow multivalued non-choice (free text) fields.
 *  If allowMultivaluedNonChoices or allowSets, then we show 'Action' column.
 */
var allowMultivaluedNonChoices= false;

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

var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                              .getService(Components.interfaces.nsIPromptService);
Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js");
Components.utils.import("resource://gre/modules/Services.jsm");
var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
var nsIIOService= Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);    
                      
window.addEventListener( "load", function(e) {
    var params= document.location.search.substring(1);
    if( document.location.search ) {
        var regex= /load/;
        var match= regex.exec( params );
        if( match ) {
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
        var regex= /module=([a-zA-Z0-9_.-]+)/;
        var match= regex.exec( params );
        if( match ) {
            modules[ match[1] ]= SeLiteSettings.loadFromJavascript( match[1] );
        }
    }
    var allowModules= false;
    if( isEmptyObject(modules) ) {
        allowModules= true;
        var prefixName= '';
        if( document.location.search ) {
            regex= /prefix=([a-zA-Z0-9_.-]+)/;
            match= regex.exec( params );
            if( match ) {
                prefixName= match[1];
            }
        }
        var moduleNames= SeLiteSettings.moduleNamesFromPreferences( prefixName );
        for( var i=0; i<moduleNames.length; i++ ) {
            modules[ moduleNames[i] ]= SeLiteSettings.loadFromJavascript( moduleNames[i]);
        }
    }
    var settingsBox= document.getElementById('SeSettingsBox');
    var tree= document.createElementNS( XUL_NS, 'tree' );
    tree.setAttribute( 'id', 'settingsTree');
    tree.setAttribute( 'editable', 'true');
    tree.setAttribute( 'seltype', 'single' );
    tree.setAttribute( 'hidecolumnpicker', 'true');
    tree.setAttribute( 'hidevscroll', 'false');
    tree.setAttribute( 'class', 'tree');
    tree.setAttribute( 'flex', '1');
    tree.setAttribute( 'rows', '25'); //@TODO
    settingsBox.appendChild( tree );
    
    for( var moduleName in modules ) {
        var module= modules[moduleName];
        allowSets= allowSets || module.allowSets;
        
        for( var fieldName in module.fields ) {
            var field= module.fields[fieldName];
            allowMultivaluedNonChoices= allowMultivaluedNonChoices || field.multivalued && field instanceof SeLiteSettings.Field.Choice;
        }
    }
    tree.appendChild( generateTreeColumns(allowModules) );
    var topTreeChildren= createTreeChildren( tree );
    
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
        allowSets= modules[moduleName].allowSets;
        
        var moduleChildren;
        if( allowSets ) {
            var moduleTreeItem= generateTreeItem( modules[moduleName], null, null, null, RowLevel.MODULE );
            topTreeChildren.appendChild( moduleTreeItem );
            moduleChildren= createTreeChildren( moduleTreeItem );
        }
        else {
            moduleChildren= topTreeChildren;
        }
        generateSets( moduleChildren, modules[moduleName] );
    }
    
    topTreeChildren.addEventListener( 'click', treeClickHandler );
    
    //tree.view.setCellText= setCellText;
    tree.view= createTreeView( tree.view );
    
    // following fails:
    //var newView= Object.create(tree.view);
    //newView.setCellText= setCellText;
    //tree.view= newView;
    
    /*tree.addEventListener( 'change', function( event ) {
    // event.target, event.currentTarget and event.explicitOriginalTarget is an XULElement for <tree>.
    // event.originalTarget is an HTMLInputElement with tagName 'html:input'.
    } );*/
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