/*  Copyright 2013, 2014 Peter Kehl
 
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

if( typeof SeLiteMisc==='undefined' ) {
    Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js" );
    SeLiteMisc.loadVerifyScope( 'chrome://selite-settings/content/ui/ovOptions.js',
        {
            window: window,
            XULElement: XULElement//typeof XULElement==='function', therefore I don't need to declare it below
        },
        new SeLiteMisc.Settable(
            ['window', 'nsIFilePicker', 'FileUtils', 'promptService', 'SeLiteSettings', 'Services', 'subScriptLoader', 'nsIIOService', 'nsIPrefBranch', 'treeColumnElements', 'modules', 'treeRowsOrChildren', 'moduleSetFields'], 'some-object',

            'newValueRow', ['number', 'undefined'],
            ['XUL_NS', 'CREATE_NEW_SET', 'DELETE_THE_SET', 'ADD_NEW_VALUE', 'DELETE_THE_VALUE'], 'string',
            ['pastFirstBlur', 'allowSets', 'allowMultivaluedNonChoices'], 'boolean',
            'targetFolder', ['string', 'null']
        )
    );
}
else {
    SeLiteMisc.isLoadedInVerifiedScope() || SeLiteMisc.fail();
    
/* This has many workarounds because of inflexibility in Mozilla XUL model. It can run in two main modes: editable (showing all sets for any modules, or for matching modules) and review (per-folder).
 * <br/>On change of fields, it doesn't reload the whole page. It updates the preferences in Firefox. Then it reloads the relevant row(s) in GUI based on the updated preferences. 
 * <br/>If you add/remove a configuration set, then it reloads the whole page, which loses the collapse/expand status.
 * <br/>It needs to show two separate columns Action and Null/Undefine, because if you have a multi-valued Field.String that allows null, and the field has null value, then this needs to show both 'Add a new value' and 'Undefine' - hence two columns.
 * */
var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
var nsIFilePicker = Components.interfaces.nsIFilePicker;
Components.utils.import("resource://gre/modules/FileUtils.jsm" );
Components.utils.import("resource://gre/modules/osfile.jsm");
//var console = (Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console;

var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                              .getService(Components.interfaces.nsIPromptService);
Components.utils.import("chrome://selite-settings/content/SeLiteSettings.js" );
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
    @param column Probably an instance of TreeColumn
    @param bool isFolder whether it's for a folder, rather than a file
    @param string currentTargetFolder Used as the default folder, when field==null. Optional.
    @param boolean saveFile Whether we're saving/creating a file, otherwise we're opening/reading. Optional, false by default.
    Only needed when isFolder is false, because the file/folder picker dialog always lets you create new folder (if you have access).
    @return false if nothing selected, string file/folder path if selected
 * */
var chooseFileOrFolder= function chooseFileOrFolder( field, tree, row, column, isFolder, currentTargetFolder, saveFile ) {
    var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    filePicker.init(
        window,
        "Select a "
        +( isFolder
                ? "folder"
                : "file"
        )
        +( field
                ? " for " +field.name
                : ""
        ),
        isFolder
            ? nsIFilePicker.modeGetFolder
            : (saveFile
                ? nsIFilePicker.modeSave
                : nsIFilePicker.modeOpen
            )
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
            if( file!==null && file.exists() ) {
                filePicker.defaultString= file.leafName;
            }
            if( file!==null && file.parent!==null && file.parent.exists() ) {
                var localParent= Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
                localParent.initWithPath( file.parent.path );
                filePicker.displayDirectory= localParent;
                filePickerDirectoryIsSet= true;
            }
        }
        if( !filePickerDirectoryIsSet ) {
            // Based on https://developer.mozilla.org/en-US/Add-ons/Code_snippets/File_I_O
            var profileDir= Components.classes["@mozilla.org/file/directory_service;1"].getService( Components.interfaces.nsIProperties)
                .get("Home", Components.interfaces.nsIFile);
            filePicker.displayDirectory= profileDir;
        }
    }
    else
    if( currentTargetFolder ) {
        filePicker.displayDirectory= currentTargetFolder;
    }
    var result= filePicker.show();
    if (result===nsIFilePicker.returnOK || result===nsIFilePicker.returnReplace) {
        if( field ) {
            tree.view.setCellText(row, column, filePicker.file.path );
        }
        return filePicker.file.path;
    }
    return false;
};

/** Enumeration-like class. Instances of subclasses indicate hierarchical levels of rows within the tree, or the column.
 * @class
 * @param {string} name
 * @param {int} level 0-based level/index
 */
var RowLevelOrColumn= function RowLevelOrColumn( name, level ) {
    SeLiteMisc.Enum.call( this, name );
    this.level= level;
};
RowLevelOrColumn.prototype= Object.create( SeLiteMisc.Enum.prototype );
RowLevelOrColumn.prototype.constructor= RowLevelOrColumn;
RowLevelOrColumn= SeLiteMisc.proxyVerifyFields( RowLevelOrColumn, {}, {forLevel: 'function'}, {level: 'number' } );

SeLiteMisc.proxyAllowFields( RowLevelOrColumn.prototype, {forTestOnly: 'function'} );
/** This is a simple translation map. It returns n-th argument (counting from 0), where n=this.level. If that argument is a function (a closure), this calls it and then it returns its result.
 * */
RowLevelOrColumn.prototype.forLevel= function forLevel(first, second, etc ) {
    this.level<arguments.length || SeLiteMisc.fail( ''+this+ '.forLevel() was called with few arguments: only ' +arguments.length+ ' of them.' );
    this.constructor.instances.length===arguments.length || SeLiteMisc.fail( "Class " +this.constructor.name+ " has " +this.constructor.instances.length+ " instances, but forLevel() received a different number of arguments: " +arguments.length );
    return typeof arguments[this.level]!=='function'
        ? arguments[this.level]
        : arguments[this.level].call();
};

/** @class
 */
var RowLevel= function RowLevel( name, level ) {
    RowLevelOrColumn.call( this, name, level );
};
//var unproxyfiedRowLevel= RowLevel;
//RowLevel.prototype= new RowLevelOrColumn( '', -1 );
RowLevel.prototype= Object.create(RowLevelOrColumn.prototype); //@TODO use new XXX(), or pass it through SeLiteMisc.proxyVerifyFields()
RowLevel.prototype.constructor= RowLevel;
debugger;
RowLevel= SeLiteMisc.proxyVerifyFields( RowLevel );
SeLiteMisc.proxyAllowFields( RowLevel, ['MODULE', 'SET', 'FIELD', 'OPTION'] );
debugger;
RowLevel.MODULE= new RowLevel('MODULE', 0);
// @TODO low importance AA test unit for SeLiteMisc:
//SeLiteMisc.fail( ''+(RowLevel.SELITE_MISC_TARGET_CLASS===unproxyfiedRowLevel) );
//SeLiteMisc.fail( ''+(RowLevel.MODULE.SELITE_MISC_TARGET_CONSTRUCTOR===unproxyfiedRowLevel) )
RowLevel.SET= new RowLevel('SET', 1);
RowLevel.FIELD= new RowLevel('FIELD', 2);
/**  RowLevel.OPTION must be the last instance of Column that refers to a part of 'properties' attribute, since its part of 'properties' represents the field's key (for SeLiteSettings.Field.Choice or SeLiteSettings.Field.FixedMap), which may contain spaces. Therefore its part of 'properties' attribute contains anything after (right of) all parts in 'properties' (RowLevel.MODULE...RowLevel.FIELD). */
RowLevel.OPTION= new RowLevel('OPTION', 3); // For options of Choice, for entries in multi-valued String/Int/Decimal and for entries in FixedMap

/** @class
*/
var Column= function Column( name, level ) {
    RowLevelOrColumn.call( this, name, level );
};
Column.prototype= Object.create(RowLevelOrColumn.prototype);//new RowLevelOrColumn( '', -1 );
Column.prototype.constructor= Column;
Column= SeLiteMisc.proxyVerifyFields( Column );
SeLiteMisc.proxyAllowFields( Column, ['MODULE_SET_FIELD_FIXEDMAPKEYS', 'DEFAULT', 'CHECKED', 'VALUE', 'ACTION_SET', 'NULL_UNDEFINE_DEFINITION'] );
Column.MODULE_SET_FIELD_FIXEDMAPKEYS= new Column('MODULE_SET_FIELD_FIXEDMAPKEYS', 0);
Column.DEFAULT= new Column('DEFAULT', 1);
Column.CHECKED= new Column('CHECKED', 2); // Column for checkbox (if the field is boolean) or radio-like select (if the field is a choice)
Column.VALUE= new Column('VALUE', 3);
Column.ACTION_SET= new Column('ACTION_SET', 4);
Column.NULL_UNDEFINE_DEFINITION= new Column('NULL_UNDEFINE_DEFINITION', 5);

/** It contains elements for <treecol> tags, as returned by window.document.createElementNS( XUL_NS, 'tree_col').
 These are not nsITreeColumn instances, but their .element fields!
 In order to get nsITreeColumn instance, use treeColumn(). See also comments near a call to getCellAt().
 */
var treeColumnElements= {
    moduleSetField: null,
    defaultSet: null,
    checked: null,
    value: null,
    action: null, // This is 'Set' in folder-based view
    manifest: null
};

/** @param element Element for <treecol> tag, one of those stored in treeColumnElements (as applicable).
 *  @return object Instance of nsITreeColumn, where returnedObject.element=element.
 * */
var treeColumn= function treeColumn( element ) {
    var tree= window.document.getElementById('settingsTree');
    for( var i=0; i<tree.columns.length; i++ ) {
        var column= tree.columns[i];
        if( column.element===element ) {
            return column;
        }
    }
    return null;
};

/** @param allowModules bool Whether we show any module/s rather than just a specific one. If allowModules is true,
 *  there may be none, one or more modules to show.
 *  @param perFolder bool Whether we're showing fields in per-folder mode - then we show a 'Reset' or 'Inherit' buttons and tooltips that
 *  indicate where each field is inherited from.
 * @return node object for <treecols>
 * */
var generateTreeColumns= function generateTreeColumns( allowModules, perFolder ) {
    if( typeof allowModules!=='boolean' || typeof allowSets!=='boolean' || typeof allowMultivaluedNonChoices!=='boolean' ) {
        throw new Error('generateTreeColumns() requires all three parameters to be boolean.');
    }
    
    var treecols= window.document.createElementNS( XUL_NS, 'treecols' );

    var treecol= treeColumnElements.moduleSetField= window.document.createElementNS( XUL_NS, 'treecol');
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
    
    var splitter= window.document.createElementNS( XUL_NS, 'splitter' );
    splitter.setAttribute( 'ordinal', '2');
    treecols.appendChild( splitter );
    
    if( allowSets ) {
        treecol= treeColumnElements.defaultSet= window.document.createElementNS( XUL_NS, 'treecol');
        treecol.setAttribute('label', 'Default');
        treecol.setAttribute('type', 'checkbox');
        treecol.setAttribute('editable', 'true' );
        treecol.setAttribute( 'ordinal', '3');
        treecol.setAttribute( 'tooltip', 'tooltipDefault');
        treecols.appendChild(treecol);
        
        splitter= window.document.createElementNS( XUL_NS, 'splitter' );
        splitter.setAttribute( 'ordinal', '4');
        treecols.appendChild( splitter );
    }
    
    treecol= treeColumnElements.checked= window.document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label', 'True');
    treecol.setAttribute('type', 'checkbox');
    treecol.setAttribute('editable', ''+!perFolder );
    treecol.setAttribute( 'ordinal', '5');
    if( !perFolder ) {
        treecol.setAttribute( 'tooltip', 'tooltipChoice' );
    }
    treecols.appendChild(treecol);

    splitter= window.document.createElementNS( XUL_NS, 'splitter' );
    splitter.setAttribute( 'ordinal', '6');
    treecols.appendChild( splitter );
    
    treecol= treeColumnElements.value= window.document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label', 'Value');
    treecol.setAttribute('editable', ''+!perFolder );
    treecol.setAttribute( 'flex', '1');
    treecol.setAttribute( 'ordinal', '7');
    if( !perFolder ) {
        treecol.setAttribute( 'tooltip', 'tooltipValue');
    }
    treecols.appendChild(treecol);
    
    if( perFolder || allowSets || allowMultivaluedNonChoices ) {
        splitter= window.document.createElementNS( XUL_NS, 'splitter' );
        splitter.setAttribute( 'ordinal', '8');
        treecols.appendChild( splitter );

        treecol= treeColumnElements.action= window.document.createElementNS( XUL_NS, 'treecol');
        treecol.setAttribute('label', perFolder
            ? 'Set'
            : 'Action');
        treecol.setAttribute('editable', 'false');
        treecol.setAttribute( 'flex', '1');
        treecol.setAttribute( 'ordinal', '9');
        treecols.appendChild(treecol);
    }
    
    // Per-folder view: Manifest/Definition. Per-module view: Null/Undefine
    splitter= window.document.createElementNS( XUL_NS, 'splitter' );
    splitter.setAttribute( 'ordinal', '10');
    treecols.appendChild( splitter );

    treecol= treeColumnElements.manifest= window.document.createElementNS( XUL_NS, 'treecol');
    treecol.setAttribute('label', perFolder
        ? 'Manifest/Definition'
        : 'Null/Undefine');
    treecol.setAttribute('editable', 'false');
    treecol.setAttribute( 'flex', '1');
    treecol.setAttribute( 'ordinal', '11');
    treecol.setAttribute( 'tooltip', perFolder
        ? 'tooltipManifest'
        : 'tooltipNull'
    );
    treecols.appendChild(treecol);
    return treecols;
};

/** Sorted anonymous object serving as an associative array {
 *     string module name => Module object
 *  }
 * */
var modules= SeLiteMisc.sortedObject(true);

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
 * I use this when saving a set/module/all displayed modules.
 *  * */
var treeRowsOrChildren= SeLiteMisc.sortedObject(true);

/** Get a <treecell> element/object from a given treeRow and level
 *  @param object treeRow object/element for <treerow>
 *  @param {Column} level It indicates which column to return <treecell> for
 *  @return object Element for <treecell>
 * */
var treeCell= function treeCell( treeRow, level ) {
    treeRow instanceof XULElement || SeLiteMisc.fail( 'treeCell() requires treeRow to be an XULElement object, but it received ' +treeRow );
    treeRow.tagName==='treerow' || SeLiteMisc.fail( 'treeCell() requires treeRow to be an XULElement object for <treerow>, but it received XULElement for ' +treeRow.tagName );
    SeLiteMisc.ensureInstance( level, Column, 'level' );
    var cells= treeRow.getElementsByTagName( 'treecell' );
    allowSets || level!==Column.DEFAULT || SeLiteMisc.fail( 'allowSets is false, therefore level should not be Column.DEFAULT.' );
    return cells[ allowSets
        ? level.forLevel(0,         1, 2, 3, 4, 5)
        : level.forLevel(0, undefined, 1, 2, 3, 4)
    ];
};

/** Simple shortcut function
 * */
var valueCompound= function valueCompound( field, setName ) {
    return moduleSetFields[field.module.name][setName][field.name];
};

/** Enum-like, instances indicate the source of value for a field. Only used in per-folder mode.
 *  @class
 * */
var ValueSource= function ValueSource( name ) {
    SeLiteMisc.Enum.call( this, name );
};
ValueSource.prototype= Object.create(SeLiteMisc.Enum.prototype);//new SeLiteMisc.Enum( '', true );
ValueSource.prototype.constructor= ValueSource;
ValueSource= SeLiteMisc.proxyVerifyFields( ValueSource );
SeLiteMisc.proxyAllowFields( ValueSource, ['ASSOCIATED_SET', 'DEFAULT_SET', 'VALUES_MANIFEST', 'FIELD_MANIFEST', 'FIELD_DEFAULT'] );
ValueSource.ASSOCIATED_SET= new ValueSource( 'ASSOCIATED_SET' );
ValueSource.DEFAULT_SET= new ValueSource( 'DEFAULT_SET' );
ValueSource.VALUES_MANIFEST= new ValueSource( 'VALUES_MANIFEST' );
ValueSource.FIELD_DEFAULT= new ValueSource( 'FIELD_DEFAULT' );

/** This keeps information for a row to display (at any given RowLevel). It populates the fields from given parameters, and it collects some extra fields.
 * @class
/** @param {SeLiteSettings.Module} module object of Module
 *  @param {(string|undefined)} setName set name (if the module allows sets and we're at set level or deeper); otherwise it's undefined
 *  attribute for the <treerow> nodes, so that when we handle a click event, we know what field the node is for.
 *  @param {RowLevel} rowLevel
 *  @param {SeLiteSettings.Field} field An object of a subclass of Field. If rowLevel==RowLevel.MODULE or rowLevel==RowLevel.SET,  then field is null.
 *  @param {string} key Key for the value to display. If no such key, it should be undefined. It must be defined for multivalued or choice field when rowLevel===RowLevel.OPTION. It serves as a trailing part of field option preference name)
 *  -- for multivalued non-choice fields it should be the same as value in valueCompound
 *  -- if the field is of a subclass of Field.Choice or Field.FixedMap, then key may differ to (current value in valueCompound.
 *  @param {SeLiteSettings.FieldInformation} valueCompound Value compound for a given field. See also {@link Module#getFieldsDownToFolder}() or {@link Module#getFieldsOfSet}().
 *  @param {boolean} [isUndeclaredEntry] Whether this is a value of an undeclared field, or a value of an undeclared key of a declared Field.FixedMap.
 *  Required if rowLevel===RowLevel.FIELD.
 * */
var RowInfo= function RowInfo( module, setName, rowLevel, field, key, valueCompound, isUndeclaredEntry ) {
    SeLiteMisc.objectFillIn( this, ['module', 'setName', 'rowLevel', 'field', 'key', 'valueCompound', 'isUndeclaredEntry'], arguments, false, /*dontSetMissingOnes*/true );
    
    showingPerFolder() || rowLevel===RowLevel.MODULE || !module.allowSets || this.setName!==undefined || SeLiteMisc.fail( "setName must not be undefined, since we are showing an editable view of module " +module.name+ " allows sets and rowLevel " +rowLevel+ " is deeper than RowLevel.MODULE." );
    
    this.field || this.rowLevel===RowLevel.MODULE || this.rowLevel===RowLevel.SET || SeLiteMisc.fail( "Parameter field must be defined, unless rowLevel===RowLevel.MODULE or rowLevel===RowLevel.SET, but rowLevel is " +this.rowLevel );
    
    if( 'key' in this && this.key===SeLiteSettings.NEW_VALUE_ROW ) {
        this.rowLevel===RowLevel.OPTION && this.field.multivalued && !SeLiteMisc.isInstance( this.field, [SeLiteSettings.Field.FixedMap,SeLiteSettings.Field.Choice] ) || SeLiteMisc.fail( 'Only use SeLiteSettings.NEW_VALUE_ROW for multivalued freetype fields at RowLevel.OPTION.' );
        !('valueCompound' in this) || SeLiteMisc.fail( 'When using SeLiteSettings.NEW_VALUE_ROW, do not pass valueCompound.' );
        this.valueCompound= new SeLiteSettings.FieldInformation( /*entry*/{});
    }
    !('valueCompound' in this) || this.valueCompound instanceof SeLiteSettings.FieldInformation;
    
    !('isUndeclaredEntry' in this) || !this.isUndeclaredEntry || rowLevel===RowLevel.FIELD && SeLiteMisc.hasType(this.valueCompound.entry, ['some-object', 'primitive']) || rowLevel===RowLevel.OPTION && SeLiteMisc.hasType(this.valueCompound.entry, 'some-object') || SeLiteMisc.fail();
    
    rowLevel===RowLevel.MODULE || rowLevel===RowLevel.SET || 'valueCompound' in this || SeLiteMisc.fail( 'valueCompound must be an instance of SeLiteSettings.FieldInformation, since rowLevel is ' +rowLevel+ ', which is other than MODULE or SET.' );
    
    // Basic collecting
    if( this.field ) {
        if( !this.field.multivalued && !(this.field instanceof SeLiteSettings.Field.Choice) ) {
            this.rowLevel===RowLevel.FIELD || SeLiteMisc.fail();
            this.value= typeof this.valueCompound.entry!=='object' // I only pass the single value or undefined as 'value' parameter
                ? this.valueCompound.entry
                : undefined;
        }
        else if( this.rowLevel===RowLevel.OPTION ) {
            if( this.field instanceof SeLiteSettings.Field.FixedMap ) {
                this.value= valueCompound.entry
                    ? valueCompound.entry[ this.key ]
                    : undefined;
            }
            else {
                var pairsToList= this.field instanceof SeLiteSettings.Field.Choice
                    ? this.field.choicePairs
                    : this.valueCompound.entry;
                this.value= pairsToList[ this.key ];
            }
        }
        !('value' in this) || SeLiteMisc.ensureType( this.value, ['string', 'number', 'boolean', 'undefined', 'null'], 'value' );
    }
    if( showingPerFolder() && 'valueCompound' in this && this.valueCompound!==undefined ) {
        if( this.valueCompound.fromPreferences ) {
            /** @var {(ValueSource|undefined)} Location of the module definition or 'values' manifest where the value comes from. Only in per-folder mode. */
            this.source= this.valueCompound.setName!==this.module.getDefaultSetName()//old?!: valueCompound.folderPath!==''
                ? ValueSource.ASSOCIATED_SET
                : ValueSource.DEFAULT_SET;
        }
        else {
            this.source= this.valueCompound.folderPath!==null//or?: !==''
                ? ValueSource.VALUES_MANIFEST
                : ValueSource.FIELD_DEFAULT;
        }
    }
    if( this.rowLevel===RowLevel.OPTION && this.field instanceof SeLiteSettings.Field.Choice ) {
        /** @var {boolean} Whether the radio button for a Choice field is checked. Not valid for Bool fields. */
        this.optionIsSelected= SeLiteMisc.hasType( this.valueCompound.entry, 'some-object' ) && this.key in this.valueCompound.entry;
    }
    //         this.isUndefined= this.isNull= false;
};
RowInfo= SeLiteMisc.proxyVerifyFields( RowInfo, {}, {'*': SeLiteMisc.catchAllFunctions}, {
    module: SeLiteSettings.Module,
    setName: ['string', 'undefined'],
    rowLevel: RowLevel,
    field: [SeLiteSettings.Field, 'undefined'],
    key: ['string', 'undefined', 'null'],
    valueCompound: SeLiteSettings.FieldInformation/* if set - it can be left undefined, if not applicable*/,
    isUndeclaredEntry: 'boolean',
    value: 'any',
    source: [ValueSource, 'undefined'],
    optionIsSelected: ['boolean', 'undefined']
} );

/** Instantiate. Validate the parameters. Then set this.xyz to results of relevant functions collectXyz().
 *  @class
 *  @param {RowInfo} rowInfo
 *  @param {Column} column
 * */
var CellInfo= function CellInfo( rowInfo, column ) {
    column instanceof Column || SeLiteMisc.fail();
    column!==Column.DEFAULT || allowSets || SeLiteMisc.fail( "allowSets is false, but column is not DEFAULT: " +column );
    column!==Column.ACTION_SET && column!==Column.NULL_UNDEFINE_DEFINITION || allowSets || allowMultivaluedNonChoices || showingPerFolder() || SeLiteMisc.fail( "Can't use Column.ACTION_SET nor Column.NULL_UNDEFINE_DEFINITION." );
    
    this.label= rowInfo.collectLabel( column );
    this.value= rowInfo.collectValue( column );
    this.editable= rowInfo.collectEditable( column );
    this.properties= rowInfo.collectProperties( column );
};
CellInfo= SeLiteMisc.proxyVerifyFields( CellInfo, {}, {}, {
    label: ['string', 'undefined'],
    value: 'any',
    editable: 'boolean',
    properties: ['string', 'undefined']
} );
/** @param {Column} column
 * @returns {boolean} Value to use for 'editable' attribute - but convert it to a string first.
 */
RowInfo.prototype.collectEditable= function collectEditable( column ) {
    // the simplest cases - 'catch all' - first
    if( this.rowLevel===RowLevel.MODULE ) {
        return false;
    }
    if( this.rowLevel===RowLevel.SET || column===Column.DEFAULT ) {
        return column===Column.DEFAULT && this.rowLevel===RowLevel.SET && this.module.allowSets;
    }
    if( column===Column.MODULE_SET_FIELD_FIXEDMAPKEYS ) {
        return false;
    }
    var isChoice= this.field instanceof SeLiteSettings.Field.Choice;
    if( column===Column.CHECKED ) {
        return !showingPerFolder()
        && (this.rowLevel===RowLevel.FIELD || this.rowLevel===RowLevel.OPTION)
        && (this.field instanceof SeLiteSettings.Field.Bool || isChoice)
        && ( this.rowLevel!==RowLevel.FIELD || !isChoice )
        && ( this.rowLevel!==RowLevel.OPTION || !this.optionIsSelected || this.field.multivalued );
    }
    if( isChoice ) {
        return false;
    }
    if( column===Column.VALUE ) {
        return this.rowLevel===RowLevel.FIELD && !this.field.multivalued
            || this.rowLevel===RowLevel.OPTION && this.field.multivalued; // This includes FixedMap
    }
    return false;
};

/** @param {Column} column
 *  @return {string} Value to use for 'value' attribute, potentially an empty string. 'value' only controls checked/unchecked state of checbkox/radio button; it doesn't show as text, which comes from 'label' - see collectLabel().
 */
RowInfo.prototype.collectValue= function collectValue( column ) {
    if( column===Column.DEFAULT ) {
        if( allowSets ) { // Radio-like checkbox for (de)selecting a set
            if( this.rowLevel===RowLevel.SET && this.module.allowSets) {
                return ''+( this.setName===this.module.getDefaultSetName() );
            }
            else {
                return 'false';
            }
        }
    }
    else if( column===Column.CHECKED ) {
        if( this.field instanceof SeLiteSettings.Field.Bool ) {
            return ''+this.valueCompound.entry;
        }
        else if( this.rowLevel===RowLevel.OPTION && this.field instanceof SeLiteSettings.Field.Choice ) {
            return ''+this.optionIsSelected;
        }
    }
    return '';
};

/** @param {Column} column
 *  @return {string} Value to use for 'properties' attribute of a trecell, potentially an empty string. Not used for 'properties' of tree row - that is set by generateTreeItem().
 */
RowInfo.prototype.collectProperties= function collectProperties( column ) {
    if( column===Column.DEFAULT ) {
        return SeLiteSettings.DEFAULT_SET_NAME; // so that I can style it in CSS as a radio button
    }
    else if( column===Column.CHECKED ) {
        if( this.rowLevel===RowLevel.OPTION ) {
            return this.field.multivalued
                ? SeLiteSettings.OPTION_NOT_UNIQUE_CELL
                : SeLiteSettings.OPTION_UNIQUE_CELL
        }
    }
    else if( column===Column.VALUE ) {
        if( 'key' in this && this.key!==SeLiteSettings.NEW_VALUE_ROW ) {
            if( this.rowLevel===RowLevel.FIELD && this.valueCompound.entry===undefined ) {
                return SeLiteSettings.FIELD_NULL_OR_UNDEFINED;
            }
            if( this.rowLevel===RowLevel.OPTION ) {
                if( this.field instanceof SeLiteSettings.Field.FixedMap && (!this.valueCompound.entry || this.valueCompound.entry[this.key]===undefined) ) {
                    return SeLiteSettings.FIELD_NULL_OR_UNDEFINED;
                }
            }
        }
    }
    else if( column===Column.ACTION_SET ) {
        if( showingPerFolder() && this.rowLevel===RowLevel.FIELD ) {
            if( this.valueCompound.fromPreferences ) {
                return this.valueCompound.setName===this.module.getDefaultSetName()
                    ? SeLiteSettings.DEFAULT_SET
                    : SeLiteSettings.ASSOCIATED_SET;
            }
            else {
                return this.valueCompound.folderPath===null
                    ? SeLiteSettings.VALUES_MANIFEST
                    : SeLiteSettings.FIELD_DEFAULT;
            }
        }
    }
    else if( column===Column.NULL_UNDEFINE_DEFINITION ) {
        if( showingPerFolder() ) {
            return this.rowLevel===RowLevel.FIELD || this.rowLevel===RowLevel.OPTION
                ?  ( this.valueCompound.folderPath!==null
                    ? (     this.valueCompound.folderPath!==''
                            ? (this.valueCompound.fromPreferences
                                    ? SeLiteSettings.ASSOCIATED_SET
                                    : SeLiteSettings.VALUES_MANIFEST
                              ) + ' ' +this.valueCompound.folderPath
                            : ''
                      )
                    : SeLiteSettings.FIELD_DEFAULT // For the click handler
                  )
                : '';
        }
    }
    return '';
};

/** Generate text for label for 'Null/Undefine' column. Use only in editable mode, not in per-folder mode.
 *  @return {string} Empty string, 'Null' or 'Undefine', as an appropriate 'label' property for Column.NULL_UNDEFINE_DEFINITION for this field/entry with the given value.
 * */
RowInfo.prototype.nullOrUndefineLabel= function nullOrUndefineLabel() {
    !showingPerFolder() || SeLiteMisc.fail( "Don't call nullOrUndefineLabel() when showing fields per folder." );
    this.rowLevel!==RowLevel.OPTION || this.field.multivalued/*that includes FixedMap*/ || this.field instanceof SeLiteSettings.Field.Choice || SeLiteMisc.fail( "rowLevel can be RowLevel.OPTION only if field is an instance of Choice or FixedMap, but field is " +this.field );
    if( !this.field ) {
        return '';
    }
    if( this.rowLevel===RowLevel.OPTION ) {
        // FixedMap is always multivalued, hence it doesn't allow null
        return this.field instanceof SeLiteSettings.Field.FixedMap && 'value' in this && this.value!==undefined
            ? 'Undefine'
            : '';
    }
    else if( this.field && !this.field.multivalued ) {
        return this.valueCompound.entry!==undefined
            ? 'Undefine'
            : (this.valueCompound.entry!==null && this.field.allowNull
                ? 'Null'
                : ''
              );
    }
    // We allow 'Undefine' button only once there are no value(s) for the multivalued field
    return typeof(this.valueCompound.entry)==='object' && Object.keys(this.valueCompound.entry).length===0
        ? 'Undefine'
        : '';
};

/** @param {Column} column
 *  @return {(string|undefined)} Value to use for 'label' attribute (which also shows up for editable cells other than checkbox/radio button), potentially an empty string.
 */
RowInfo.prototype.collectLabel= function collectLabel( column ) {
    if( column===Column.MODULE_SET_FIELD_FIXEDMAPKEYS ) {
        return this.rowLevel.forLevel(
            this.module
                ? this.module.name
                : '',
            this.setName,
            this.field
                ? this.field.name//@TODO undeclared fields - but only if showingPerFolder()
                : '',
            this.field instanceof SeLiteSettings.Field.FixedMap
                ? this.key
                : ''
        ); 
    }
    else if( column===Column.VALUE ) {
        if( this.rowLevel===RowLevel.MODULE || this.rowLevel===RowLevel.SET ) {
            return '';
        }
        if( this.rowLevel===RowLevel.FIELD ) {
            if( this.valueCompound.entry===null //single-valued fields
             || this.valueCompound.entry===undefined //single/multi-valued
             || typeof this.valueCompound.entry!=='object' // single-valued fields
            ) {
                return ''+this.valueCompound.entry;
            }
        }
        if( this.rowLevel===RowLevel.OPTION ) { //multi-valued freetype, File or FixedMap; single/multi-valued Choice
            if( this.field instanceof SeLiteSettings.Field.Choice ) {
                return '' +this.field.choicePairs[this.key];
            }
            else {
                if( this.key===SeLiteSettings.NEW_VALUE_ROW ) {
                    return ''; // nothing to show
                }
                if( this.valueCompound.entry && this.key in this.valueCompound.entry ) {
                    return '' +this.valueCompound.entry[this.key];
                }// free-type or File get listed at OPTION level only when they have value(s). Since there is no value, the field is FixedMap (for which we list all entries, even undefined ones) and we show the value as 'undefined'.
                SeLiteMisc.ensureInstance( this.field, SeLiteSettings.Field.FixedMap, 'this.field' );
                return 'undefined';
            }
        }
    }
    else if( column===Column.ACTION_SET ) {
        if( this.rowLevel===RowLevel.MODULE || this.rowLevel===RowLevel.SET ) {
            return !this.setName
                    ? (allowSets && this.module.allowSets
                        ? CREATE_NEW_SET
                        : ''
                      )
                    : DELETE_THE_SET;
        }
        else if( !showingPerFolder() ) {
            if( this.field!==null && !SeLiteMisc.isInstance( this.field, [SeLiteSettings.Field.Choice, SeLiteSettings.Field.FixedMap], 'field' )
            && this.field.multivalued ) {
                if( this.rowLevel===RowLevel.FIELD ) {
                    return ADD_NEW_VALUE;
                }
                if( this.rowLevel===RowLevel.OPTION ) {
                    return DELETE_THE_VALUE;
                }
            }
        }
        else if( this.rowLevel===RowLevel.FIELD ) {
            return this.valueCompound.fromPreferences
                ? this.valueCompound.setName
                : (this.valueCompound.folderPath
                        ? ''
                        : 'module default'
                  );
        }
    }
    else if( column===Column.NULL_UNDEFINE_DEFINITION ) {
        if( !showingPerFolder() ) { //In editable view: show Null/Undefine.
            return this.nullOrUndefineLabel();
        }
        else { // In per-folder view: show manifest or field definition.
            return this.rowLevel===RowLevel.FIELD
                ? (this.valueCompound.folderPath
                    ? OS.Path.join( this.valueCompound.folderPath, this.valueCompound.fromPreferences
                            ? SeLiteSettings.ASSOCIATIONS_MANIFEST_FILENAME
                            : SeLiteSettings.VALUES_MANIFEST_FILENAME
                      )
                    : (!this.valueCompound.fromPreferences
                            ? this.module.definitionJavascriptFile
                            : ''
                      )
                  )
                : '';
        }
    }
    return '';
};

/**@param {object} treecell result of window.document.createElementNS( XUL_NS, 'treecell') 
 * @param {Column} column
 * */
RowInfo.prototype.setCellDetails= function setCellDetails( treecell, column ) {
    treecell || SeLiteMisc.fail();
    var cellInfo= new CellInfo( this, column );
    treecell.setAttribute( 'editable', '' +cellInfo.editable );
    // Checkbox/radio button cells use attribute 'value'. Other cells use attribute 'label'.
    cellInfo.value==='' || cellInfo.label==='' || SeLiteMisc.fail( "One of 'value' or 'label' must be an empty string." );
    treecell.setAttribute( 'value', cellInfo.value );
    treecell.setAttribute( 'label', cellInfo.label );
    treecell.setAttribute( 'properties', cellInfo.properties );
};

/** @return {Array} Array of Column instances applicable to the current screen/mode, in the same order as displayed. */
var applicableColumns= function applicableColumns() {
    var columns= [Column.MODULE_SET_FIELD_FIXEDMAPKEYS];
    if( allowSets ) {
        columns.push( Column.DEFAULT );
    }
    columns.push( Column.CHECKED, Column.VALUE );
    if( allowSets || allowMultivaluedNonChoices || showingPerFolder() ) {
        columns.push( Column.ACTION_SET );
        columns.push( Column.NULL_UNDEFINE_DEFINITION );
    }
    return columns;
};
    
/** Set details of all cells in a given treerow. Optional: create the cells.
 *  @param {object} Object for &lt;treerow&gt; element.
 *  @param {boolean} createCells Whether to create the cells.
 * */
RowInfo.prototype.setAllCellDetails= function updateAllCellDetails( treerow, createCells ) {
    var columns= applicableColumns();
    for( var i=0; i<columns.length; i++ ) { //@TODO low: for(..of..)
        var treecell= createCells
            ? window.document.createElementNS( XUL_NS, 'treecell')
            : treeCell( treerow, columns[i] );
        if( createCells ) {
            treerow.appendChild( treecell);
        }
        this.setCellDetails( treecell, columns[i] );
    }
};

/** 
 *  @return object for a new element <treeitem> with one <treerow>
 * */
RowInfo.prototype.generateTreeItem= function generateTreeItem() {
    var treeitem= window.document.createElementNS( XUL_NS, 'treeitem');
    var treerow= window.document.createElementNS( XUL_NS, 'treerow');
    treeitem.appendChild( treerow );
    // Shortcut xxxName variables prevent null exceptions, so I can pass them as parts of expressions to this.rowLevel.forLevel(..) without extra validation
    var moduleName= this.module
        ? this.module.name
        : '';
    var fieldName= this.field
        ? this.field.name
        : '';
    /* I use spaces as separators in the following (that's why I don't allow spaces in module/set/field name). For level===RowLevel.OPTION, this.key may contain space(s), since it's the last item on the following list. (That's why there can't be any more entries in 'properties' after value of this.key):
    */
    treerow.setAttribute( 'properties',
        this.rowLevel.forLevel(
            moduleName,
            moduleName+' '+this.setName,
            moduleName+' '+this.setName+' '+fieldName,
            (function() {
                this.key!==undefined && this.key!==null || SeLiteMisc.fail();
                return moduleName+' '+this.setName+' '+fieldName
                    +(this.field.multivalued || this.field instanceof SeLiteSettings.Field.Choice || this.field instanceof SeLiteSettings.Field.FixedMap
                        ? ' ' +this.key
                        : ''
                    );
            }).bind( this )
        )
    );

    this.setAllCellDetails( treerow, true );

    // Register treerow in treeRowsOrChildren[][...] if needed
    if( allowSets ) { // Radio-like checkbox for (de)selecting a set
        if( this.rowLevel===RowLevel.SET && this.module.allowSets) {
            treeRowsOrChildren.subContainer( this.module.name, this.setName )[ SeLiteSettings.SET_SELECTION_ROW ]= treerow;
        }
    }
    if( this.rowLevel===RowLevel.FIELD ) {
        if( !this.field.multivalued && !(this.field instanceof SeLiteSettings.Field.Choice) ) {//single valued
           treeRowsOrChildren.subContainer( this.module.name, this.setName )[ fieldName ]= treerow;
        }
        else {
            treeRowsOrChildren.subContainer( this.module.name, this.setName, fieldName )[ SeLiteSettings.FIELD_MAIN_ROW ]= treerow;
        }
    }
    if( this.rowLevel===RowLevel.OPTION ) {
        treeRowsOrChildren.subContainer( this.module.name, this.setName, fieldName )[ this.key ]= treerow;
    }
    return treeitem;
};

/** @param node moduleChildren <treechildren>
 *  @param object module Module
 * */
var generateSets= function generateSets( moduleChildren, module ) {
    try {
        var setNames= !showingPerFolder()
            ? module.setNames()
            : [undefined];
        if( !allowSets && setNames.length!==1 ) {
            throw new Error( "allowSets should be set false only if a module has the only set." );
        }
        for( var i=0; i<setNames.length; i++ ) {
            var setName= setNames[i];
            // setFields includes all fields from Preferences DB for the module name, even if they are not in the module definition
            
            var setFields= !showingPerFolder()
                ? module.getFieldsOfSet( setName, true )
                : module.getFieldsDownToFolder( targetFolder, true );
            if( !showingPerFolder() ) {
                moduleSetFields[module.name]= moduleSetFields[module.name] || {};
                moduleSetFields[module.name][ setName ]= setFields;
            }
            var setChildren= null;
            if( allowSets && module.allowSets ) {
                var setItem= new RowInfo( module, setName, RowLevel.SET, undefined, /*key*/ null ).generateTreeItem();
                moduleChildren.appendChild( setItem );
                setChildren= createTreeChildren( setItem );
            }
            else {
                setChildren= moduleChildren;
            }
            generateFields( setChildren, module, setName, setFields );
        }
    }
    catch(e) {
        e.message= 'Module ' +module.name+ ': ' +e.message;
        throw e;
    }
};

/** @param setFields Result of SeLiteSettings.Module.getFieldsOfSet() or SeLiteSettings.Module.getFieldsDownToFolder()
 * */
var generateFields= function generateFields( setChildren, module, setName, setFields ) {
    for( var fieldName in setFields ) {
        var field= module.fields[fieldName];
        if( field ) {
            var valueCompound= setFields[fieldName];
            var fieldItem= new RowInfo( module, setName, RowLevel.FIELD, field, /*key*/undefined, valueCompound ).generateTreeItem();
            setChildren.appendChild( fieldItem );

            var isChoice= field instanceof SeLiteSettings.Field.Choice;
            if( field.multivalued || isChoice ) {
                var fieldChildren= createTreeChildren( fieldItem );
                if( field instanceof SeLiteSettings.Field.FixedMap ) {
                    for( var i=0; i<field.keySet.length; i++ ) { //@TODO low: loop for( .. of ..) once NetBeans supports it
                        var key= field.keySet[i];
                        var optionItem= new RowInfo( module, setName, RowLevel.OPTION, field, key, valueCompound ).generateTreeItem();
                        fieldChildren.appendChild( optionItem );
                    }
                    for( var key in valueCompound.entry ) {
                        if( field.keySet.indexOf(key)<0 ) {
                            var optionItem= new RowInfo( module, setName, RowLevel.OPTION, field, key, valueCompound, true ).generateTreeItem();
                            fieldChildren.appendChild( optionItem );
                        }
                    }
                }
                else {
                    var pairsToList= isChoice
                        ? field.choicePairs
                        : valueCompound.entry;

                    for( var key in pairsToList ) {////@TODO low: potential IterableArray
                        isChoice || valueCompound.entry===undefined || typeof(valueCompound.entry)==='object' || SeLiteMisc.fail( 'field ' +field.name+ ' has value of type ' +typeof valueCompound.entry+ ': ' +valueCompound.entry );
                        var optionItem= new RowInfo( module, setName, RowLevel.OPTION, field, key, valueCompound ).generateTreeItem();
                        fieldChildren.appendChild( optionItem );
                    }
                }
                treeRowsOrChildren[ module.name ][ setName ][ fieldName ][ SeLiteSettings.FIELD_TREECHILDREN ]= fieldChildren;
            }
        }
        else {
            //@TODO undeclared field
        }
    }
};

/** @param string properties <treerow> or <treecell> 'properties' attribute, which contains space-separated module/set/field/choice(option) name
 *  - as applicable. Do not use with cells for Column.DEFAULT.
 *  @param {RowLevel} level It indicates which level we want the name for. Not all levels
 *  may apply. For level===RowLevel.OPTION this may return a string with space(s) in it.
 *  @return string name for the given level, or undefined if there's no property (word) at that level.
 *  Side note: I would have used https://developer.mozilla.org/en-US/docs/Web/API/element.dataset,
 *  but I didn't know (and still don't know) how to get it for <treerow> element where the user clicked - tree.view doesn't let me.
 * */
var propertiesPart= function propertiesPart( properties, level ) {
    SeLiteMisc.ensureInstance( level, RowLevel, 'level' );
    var propertiesParts= properties.split( ' ' );
    
    if( level.level>=propertiesParts.length ) {
        return undefined;
    }
    if( level!==RowLevel.OPTION ) {
        return propertiesParts[level.level];
    }
    propertiesParts= propertiesParts.slice( level.level );
    return propertiesParts.join( ' ');
};

/** 0-based index of row beig currently edited, within the set of *visible* rows only (it skips the collapsed rows),
 *  only if the row is for a new value of a multi-valued field and that value was not saved/submitted yet. Otherwise it's undefined.
 *  @see window's onblur handler, set to 'onTreeBlur()' in this file
 *   */
var newValueRow= undefined;
var pastFirstBlur= false;

/** When performing validation of a freetype values, most frequent use cases are handled in setCellText handler.
 *  From Firefox 25, the only relevant scenario not handled by setCellText() is when a user hits 'Add a new value'
 *  for a multi-valued field and then they hit ESC without filling in the value. That's when window's onTreeBlur() performs the validation.
 *  @see setCellText()
 */
window.onTreeBlur= function onTreeBlur() {
    //console.log('onblur; newValueRow: ' +newValueRow+ '; pastFirstBlur: ' +pastFirstBlur);
    if( newValueRow!==undefined ) {
        if( pastFirstBlur ) {
            var info= preProcessEdit( newValueRow, '' ); // This assumes that a new value is only empty. Otherwise we'd have to retrieve the actual value. 
            // If validation fails, I'm not calling startEditing(..). See notes in setCellText()
            pastFirstBlur= false;
            newValueRow= undefined;
        }
        else {
            pastFirstBlur= true;
        }
    }
};

var treeClickHandler= function treeClickHandler( event ) {
    //console.log( 'click');
    // FYI: event.currentTarget.tagName=='tree'. However, window.document.getElementById('settingsTree')!=event.currentTarget
    var tree= window.document.getElementById('settingsTree');
    var row= { value: -1 }; // value will be 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
    var column= { value: null }; // value is instance of TreeColumn. See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeColumn
            // column.value.element is one of 'treecol' nodes created above. column.value.type can be TreeColumn.TYPE_CHECKBOX etc.
    tree.boxObject.getCellAt(event.clientX, event.clientY, row, column, {}/*unused, but needed*/ );
    
    if( row.value>=0 && column.value ) {
        var modifiedPreferences= false;
        var rowProperties= tree.view.getRowProperties(row.value);
        var clickedOptionKey= propertiesPart( rowProperties, RowLevel.OPTION );
        var moduleName= propertiesPart( rowProperties, RowLevel.MODULE );
        var module= modules[moduleName];
        var moduleRowsOrChildren= treeRowsOrChildren[moduleName];
        var field= module.fields[ propertiesPart( rowProperties, RowLevel.FIELD ) ];
        if( column.value!==null && row.value>=0 ) {
            var cellIsEditable= tree.view.isEditable(row.value, column.value);
            var cellValue= tree.view.getCellValue(row.value, column.value); // For checkboxes this is true/false as toggled by the click.
            var cellProperties= tree.view.getCellProperties( row.value, column.value ); // Space-separated properties
            var cellText= tree.view.getCellText(row.value, column.value);
            
            var selectedSetName= propertiesPart( rowProperties, RowLevel.SET );
            if( allowSets && column.value.element===treeColumnElements.defaultSet && cellIsEditable ) { // Make the selected set be default, or unflag it as default.
                module.setDefaultSetName( cellValue==='true'
                    ? selectedSetName
                    : null
                );
                modifiedPreferences= true;
                if( cellValue==='true' ) { // We're making the selected set default, hence de-select previously default set (if any)
                    for( var setName in moduleRowsOrChildren ) {
                        var treeRow= moduleRowsOrChildren[setName][SeLiteSettings.SET_SELECTION_ROW];
                        var cell= treeCell( treeRow, Column.DEFAULT );
                        if( setName!==selectedSetName) {
                            cell.setAttribute( 'value', 'false' );
                        }
                    }
                }
                SeLiteSettings.changedDefaultSet();
            }
            if( column.value.element===treeColumnElements.checked && cellIsEditable ) {
                var isSingleNonChoice= !(field.multivalued || field instanceof SeLiteSettings.Field.Choice);
                
                if( isSingleNonChoice  ) {
                    field instanceof SeLiteSettings.Field.Bool || SeLiteMisc.fail('field ' +field.name+ ' should be Field.Bool');
                    var clickedCell= treeCell( moduleRowsOrChildren[selectedSetName][field.name], Column.CHECKED );
                    field.setValue( selectedSetName, clickedCell.getAttribute( 'value')==='true' );
                    // I don't need to call updateSpecial() here - if the field was SeLiteSettings.NULL, then the above setValue() replaced that
                }
                else {
                    var clickedTreeRow= moduleRowsOrChildren[selectedSetName][field.name][ clickedOptionKey ];
                    var clickedCell= treeCell( clickedTreeRow, Column.CHECKED );
                    
                    if( !field.multivalued ) { // field is a single-valued choice. The field is only editable if it was unchecked
                        // - so the user checked it now. Uncheck & remove the previously checked value (if any).
                        for( var otherOptionKey in moduleRowsOrChildren[selectedSetName][field.name] ) { // de-select the previously selected value, make it editable
                            
                            if( SeLiteSettings.reservedNames.indexOf(otherOptionKey)<0 && otherOptionKey!==clickedOptionKey ) {
                                var otherOptionRow= moduleRowsOrChildren[selectedSetName][field.name][otherOptionKey];
                                
                                var otherOptionCell= treeCell( otherOptionRow, Column.CHECKED );
                                if( otherOptionCell.getAttribute('value')==='true' ) {
                                    otherOptionCell.setAttribute( 'value', 'false');
                                    otherOptionCell.setAttribute( 'editable', 'true');
                                    field.removeValue( selectedSetName, otherOptionKey );
                                }
                            }
                        }
                        clickedCell.setAttribute( 'editable', 'false');
                        field.addValue( selectedSetName, clickedOptionKey );
                    }
                    else {
                        var checkedAfterClick= clickedCell.getAttribute('value')==='true';
                        checkedAfterClick
                            ? field.addValue( selectedSetName, clickedOptionKey )
                            : field.removeValue( selectedSetName, clickedOptionKey );
                    }
                    updateSpecial( selectedSetName, field,
                        !field.multivalued
                            ? 0
                            : (checkedAfterClick
                                ? +1
                                : -1
                            ),
                        clickedOptionKey );
                }
                modifiedPreferences= true;
            }
            if( column.value.element===treeColumnElements.value ) {
                if( cellIsEditable && rowProperties) {
                    if( !showingPerFolder() ) {
                        if( !(field instanceof SeLiteSettings.Field.FileOrFolder) ) {
                            tree.startEditing( row.value, column.value );
                        }
                        else {
                            chooseFileOrFolder( field, tree, row.value, column.value, field.isFolder, undefined, field.saveFile ); // On change that will trigger my custom setCellText()
                        }
                    }
                }
            }
            if( column.value.element===treeColumnElements.action ) {
                if( cellProperties==='' ) {
                    if( cellText===CREATE_NEW_SET ) {
                        var setName= window.prompt('Enter the new set name');
                        if( setName ) {
                            module.createSet( setName );
                            SeLiteSettings.savePrefFile(); // Must save here, before reload()
                            window.location.reload();
                        }
                    }
                    if( cellText===DELETE_THE_SET ) {
                        if( window.confirm('Are you sure you want to delete this set?') ) {
                            if( selectedSetName===module.getDefaultSetName() ) {
                                module.setDefaultSetName();
                            }
                            module.removeSet( selectedSetName);
                            SeLiteSettings.savePrefFile(); // Must save here, before reload()
                            window.location.reload();
                        }
                    }
                    if( (cellText===ADD_NEW_VALUE || cellText===DELETE_THE_VALUE) ) {
                        if( !field.multivalued || field instanceof SeLiteSettings.Field.Choice ) {
                            SeLiteMisc.fail( 'We only allow Add/Delete buttons for non-choice multivalued fields, but it was triggered for field ' +field.name );
                        }
                        var treeChildren= moduleRowsOrChildren[selectedSetName][field.name][SeLiteSettings.FIELD_TREECHILDREN];
                        if( cellText===ADD_NEW_VALUE ) {
                            // Add a row for a new value, right below the clicked row (i.e. at the top of all existing values)
                            // Since we're editing, it means that showingPerFolder()===false, so I don't need to generate anything for navigation from folder view here.
                            var rowInfo= new RowInfo( module, selectedSetName, RowLevel.OPTION, field, /*key*/SeLiteSettings.NEW_VALUE_ROW );
                            var treeItem= rowInfo.generateTreeItem();

                            var previouslyFirstValueRow;
                            for( var key in moduleRowsOrChildren[selectedSetName][field.name] ) {
                                if( SeLiteSettings.reservedNames.indexOf(key)<0 ) {
                                    previouslyFirstValueRow= moduleRowsOrChildren[selectedSetName][field.name][key];
                                    previouslyFirstValueRow instanceof XULElement && previouslyFirstValueRow.tagName==='treerow' && previouslyFirstValueRow.parentNode.tagName==='treeitem' || SeLiteMisc.fail();
                                    break;
                                }
                            }
                            // Firefox 22.b04 and 24.0a1 doesn't handle parent.insertBefore(newItem, null), even though it should - https://developer.mozilla.org/en-US/docs/Web/API/Node.insertBefore
                            if(true) {//@TODO low: test in new Firefox, choose one branch. Cleanup the above doc(?)
                                if( previouslyFirstValueRow!==undefined ) {
                                    treeChildren.insertBefore( treeItem, previouslyFirstValueRow.parentNode );
                                }
                                else {
                                    treeChildren.appendChild( treeItem );
                                }
                            }
                            else {
                                treeChildren.insertBefore( treeItem,
                                    previouslyFirstValueRow!==undefined
                                        ? previouslyFirstValueRow.parentNode
                                        : null );
                            }
                            if( treeChildren.parentNode.getAttribute('open')!=='true' ) {
                                treeChildren.parentNode.setAttribute('open', 'true');
                            }
                            tree.boxObject.ensureRowIsVisible( row.value+1 );
                            if( field instanceof SeLiteSettings.Field.FileOrFolder ) {
                                chooseFileOrFolder( field, tree, row.value+1, treeColumn(treeColumnElements.value), field.isFolder, undefined, field.saveFile ); // On change that will trigger my custom setCellText()
                            }
                            else {
                                tree.startEditing( row.value+1, treeColumn(treeColumnElements.value) );
                            }
                        }
                        if( cellText===DELETE_THE_VALUE ) {
                            var clickedTreeRow= moduleRowsOrChildren[selectedSetName][field.name][ clickedOptionKey ]; // same as above
                            delete moduleRowsOrChildren[selectedSetName][field.name][ clickedOptionKey ];
                            treeChildren.removeChild( clickedTreeRow.parentNode );
                            field.removeValue( selectedSetName, clickedOptionKey );
                            updateSpecial( selectedSetName, field, -1 );
                            modifiedPreferences= true;
                        }
                    }
                }
                else {
                    window.open( '?module=' +escape(module.name)+ '&set=' +escape(cellText), '_blank');
                }
            }
            if( column.value.element===treeColumnElements.manifest ) { // Manifest, or Null/Undefine
                if( showingPerFolder() ) {
                    if( cellProperties!==SeLiteSettings.FIELD_DEFAULT ) {
                        if( cellProperties.startsWith(SeLiteSettings.ASSOCIATED_SET) ) {
                            var folder= cellProperties.substring( SeLiteSettings.ASSOCIATED_SET.length+1 );
                            window.open( 'file://' +OS.Path.join(folder, SeLiteSettings.ASSOCIATIONS_MANIFEST_FILENAME), '_blank' );
                        }
                        else {
                            SeLiteMisc.ensure( cellProperties.startsWith(SeLiteSettings.VALUES_MANIFEST) );
                            var folder= cellProperties.substring( SeLiteSettings.VALUES_MANIFEST.length+1 );
                            window.open( 'file://' +OS.Path.join(folder, SeLiteSettings.VALUES_MANIFEST_FILENAME), '_blank' );
                        }
                    }
                    else
                    if( cellProperties!=='' ) {
                        window.open( SeLiteSettings.fileNameToUrl(module.definitionJavascriptFile), '_blank' );
                    }
                }
                else {
                    if( cellText==='Null' || cellText==='Undefine' ) {
                        if( clickedOptionKey!==undefined ) {
                            // Our state flow is: value selected -> click 'Null' -> null -> click 'Undefine' -> undefined. So option(s) could be selected only when we click 'Null'; when we click 'Undefine', the field was already set to null (and no option(s) were selected). Therefore this if() branch is simpler than its else {} branch (which handles clicking at 'Null' and unsetting any selected option).
                            field instanceof SeLiteSettings.Field.FixedMap || SeLiteMisc.fail( "Buttons Null/Undefine should show up at this level only for fields that are instances of SeLiteSettings.Field.FixedMap. However, it showed up for " +field );
                            updateSpecial( selectedSetName, field, 0,
                                cellText==='Null'
                                    ? null
                                    : undefined,
                                clickedOptionKey
                            );
                            // Set/unset SeLiteSettings.VALUE_PRESENT on the field, if applicable:
                            updateSpecial( selectedSetName, field,
                                cellText==='Null'
                                    ? 1
                                    : -1 );
                        }
                        else {
                            updateSpecial( selectedSetName, field, 0,
                                cellText==='Null'
                                    ? null
                                    : undefined );
                            var compound= valueCompound(field, selectedSetName);
                            if( field instanceof SeLiteSettings.Field.Bool && compound.entry ) {
                                treeCell( fieldTreeRow(selectedSetName, field), Column.CHECKED ).setAttribute( 'value', 'false' );
                            }
                            !field.multivalued || !(field instanceof SeLiteSettings.Field.Choice) || SeLiteMisc.fail('There should be no Null button for multivalued choices.' );
                            if( !field.multivalued && field instanceof SeLiteSettings.Field.Choice && compound.entry ) {
                                var keys= Object.keys(compound.entry);
                                keys.length===1 || SeLiteMisc.fail();
                                var previousChoiceCell= treeCell( treeRowsOrChildren[moduleName][selectedSetName][field.name][ keys[0] ], Column.CHECKED );
                                previousChoiceCell.setAttribute( 'value', 'false' );
                                previousChoiceCell.setAttribute( 'editable', 'true' );
                            }
                        }
                        modifiedPreferences= true;
                    }
                }
            }
        }
        if( modifiedPreferences ) {
            SeLiteSettings.savePrefFile();
            
            if( column.value.element!==treeColumnElements.defaultSet && cellText!==DELETE_THE_VALUE ) {
                moduleSetFields[moduleName][selectedSetName]= module.getFieldsOfSet( selectedSetName, true );
                
                //var fieldRow= fieldTreeRow(selectedSetName, field);
                //var rowToUpdate, rowLevel;
                
                !clickedOptionKey || field.multivalued/*that includes FixedMap*/ || field instanceof SeLiteSettings.Field.Choice || SeLiteMisc.fail( "When clickedOptionKey is set, the field should be multivalued, or an instance of Choice or FixedMap."); //@TODO centralise this validation, remove duplicates
                var fieldRowInfo= new RowInfo( module, selectedSetName, RowLevel.FIELD, field, clickedOptionKey, valueCompound(field, selectedSetName) );
                fieldRowInfo.setAllCellDetails( fieldTreeRow(selectedSetName, field) );
                
                if( clickedOptionKey && (field.multivalued || field instanceof SeLiteSettings.Field.Choice) ) {
                    var optionRowInfo= new RowInfo( module, selectedSetName, RowLevel.OPTION, field, clickedOptionKey, valueCompound(field, selectedSetName) );
                    optionRowInfo.setAllCellDetails( moduleRowsOrChildren[selectedSetName][field.name][ clickedOptionKey ] );
                }
            }
        }
    }
};

/** @return <treerow> element for given set and field, that
 *  - for single-valued non-choice field contains the field
 *  - for multi-valued or choice field it is the collapsible/expandable row for the whole field
 * */
var fieldTreeRow= function fieldTreeRow( setName, field ) {
    return !field.multivalued && !(field instanceof SeLiteSettings.Field.Choice)
        ? treeRowsOrChildren[field.module.name][setName][field.name]
        : treeRowsOrChildren[field.module.name][setName][field.name][SeLiteSettings.FIELD_MAIN_ROW];
};

/** Gather some information about the cell, the field, set and module. Validate the value, show an alert if validation fails. If there is a valid change of the field, show/hide 'Undefine' or 'Null' label and related 'properties'.
 <br>Only used after type events (setCellText, or blur other than ESC).
 * @param row is 0-based index among the expanded rows, not all rows.
 * @param string value new value (as typed)
 * @return object An anonymous object {
       module: instance of SeLiteSettings.Module,
        rowProperties: string,
        setName: string,
        field: ??,
        treeRow: ??,
        oldKey: mixed, previous value
        - string, the key as it was before this edit (or the fixed key for FixedMap) - for a multi-valued field
        - mixed previous value (including Javascript null/undefined) - for single-valued field
        validationPassed: boolean,
        valueChanged: boolean,
        parsed: mixed, the parsed value, string or number (after trimmed)
        fieldTreeRowsOrChildren: object, retrieved as 2nd level entry from moduleRowsOrChildren;
          serving as an associative array, with values being <treerow> or <treechildren> objects for the field {
            string value or option key => <treerow> object
            ...
            SeLiteSettings.FIELD_MAIN_ROW => <treerow> for the main (collapsible) level of this field
            SeLiteSettings.FIELD_TREECHILDREN => <treechildren>
            SeLiteSettings.NEW_VALUE_ROW => <treerow> for the new value to be added (not saved yet), optional
        }
 *  }
 * */
var preProcessEdit= function preProcessEdit( row, value ) {
    var tree= window.document.getElementById( 'settingsTree' );
    var rowProperties= tree.view.getRowProperties(row);

    var moduleName= propertiesPart( rowProperties, RowLevel.MODULE );
    var module= modules[moduleName];
    var setName= propertiesPart( rowProperties, RowLevel.SET );
    var fieldName= propertiesPart( rowProperties, RowLevel.FIELD );
    var field= module.fields[fieldName];

    var moduleRowsOrChildren= treeRowsOrChildren[moduleName];
    var fieldTreeRowsOrChildren= null; //Non-null only if field.multivalued==true
    var treeRow;
    var oldKey;
    var validationPassed= true;
    /** @var {boolean}*/ var valueChanged;
    field!==undefined || SeLiteMisc.fail( 'field ' +fieldName+ ' is undefined');
    var trimmed= field.trim(value);
    var parsed;
    if( !field.multivalued ) {
        if( !(field instanceof SeLiteSettings.Field.FixedMap) ) {
            treeRow= moduleRowsOrChildren[setName][fieldName];
            // Can't use treeRow.constructor.name here - because it's a native object.
            treeRow instanceof XULElement && treeRow.tagName==='treerow' || SeLiteMisc.fail( 'treeRow should be an instance of XULElement for a <treerow>.');
            oldKey= valueCompound( field, setName ).entry;
            valueChanged= value!==''+oldKey;
        }
        else {
            //@TODO low: cast value to the exact type, then use strict comparison ===
            //@TODO low: Check what if the whole field (.entry) is undefined. 
            oldKey= propertiesPart( rowProperties, RowLevel.OPTION );
            var oldValue= module.getFieldsOfSet( setName, true )[ field.name ].entry[ oldKey ];
            valueChanged= value!=oldValue;
        }
    }
    else {
        fieldTreeRowsOrChildren= moduleRowsOrChildren[setName][fieldName];
        fieldTreeRowsOrChildren instanceof SeLiteMisc.SortedObjectTarget || SeLiteMisc.fail( "fieldTreeRowsOrChildren should be an instance of SeLiteMisc.SortedObjectTarget, but it is " +fieldTreeRowsOrChildren.constructor.name );
        oldKey= propertiesPart( rowProperties, RowLevel.OPTION );
        oldKey!==null || SeLiteMisc.fail( 'oldKey for module ' +module.name+ ', set ' +setName+ ', field ' +field.name+ " must not be null.");
        valueChanged= value!==oldKey; // oldKey is a string, so this comparison is OK
        if( valueChanged ) {
            if( trimmed in fieldTreeRowsOrChildren ) {
                window.alert( "Values must be unique. Another entry for field " +field.name+ " already has same (trimmed) value " +trimmed );
                validationPassed= false;
            }
        }
        treeRow= fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW]
            ? fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW]
            : fieldTreeRowsOrChildren[oldKey];
    }
    if( validationPassed && valueChanged ) {
        parsed= field.parse(trimmed);
        validationPassed= field.validateKey(parsed) && (!field.customValidate || field.customValidate.call(null, parsed) );
        if( !validationPassed ) {
            window.alert('Field ' +field.name+ " can't accept "+ (
                trimmed.length>0
                    ? 'value ' +trimmed
                    : 'whitespace.'
            ) );
        }
    }
    if( !validationPassed ) {
        if( field.multivalued && fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW] ) { // This would be the first value for this (multivalued) field. We have no previous value to revert it to, so we remove this row.
            fieldTreeRowsOrChildren[SeLiteSettings.FIELD_TREECHILDREN].removeChild( fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW].parentNode );
            delete treeRowsOrChildren[module.name][setName][field.name][SeLiteSettings.NEW_VALUE_ROW];
        }
    }
    return SeLiteMisc.proxyVerifyFields( {
        module: module,
        rowProperties: rowProperties,
        setName: setName,
        field: field,
        fieldTreeRowsOrChildren: fieldTreeRowsOrChildren,
        treeRow: treeRow,
        oldKey: oldKey,
        validationPassed: validationPassed,
        valueChanged: valueChanged,
        parsed: parsed
    } );
};

/** This - nsITreeView.setCellText() - gets triggered only for string/number fields and for File fields; not for checkboxes.
 *  @param row is 0-based index among the expanded rows, not all rows.
 *  @param col I don't use it, because I use module definition to figure out the editable cell.
 *  @param string value new value
 *  @param object original The original TreeView
 * */
var setCellText= function setCellText( row, col, value, original) {
    //console.log('setCellText');
    newValueRow= undefined; // This is called before 'blur' event, so we validate here. We only leave it for window's onTreeBlur() if setCellText doesn't get called.
    var info= preProcessEdit( row, value );
    if( !info.validationPassed || !info.valueChanged ) {
        // If validation fails, I wanted to keep the field as being edited, but the following line didn't work here in Firefox 25.0. It could also interfere with window's onTreeBlur().
        //if( !info.validationPassed ) { window.document.getElementById( 'settingsTree' ).startEditing( row, col ); }
        return; // if validation failed, preProcessEdit() already showed an alert, and removed the tree row if the value was a newly added entry of a multi-valued field
    }
    original.setCellText( row, col, value );
    /** @var {object} Only used when info.field.multivalued and !(info.field instanceof SeLiteSettings.Field.FixedMap). If same as info.treeRow, then the new value stays where it was typed. If undefined, then append the new row at the end. */
    var rowAfterNewPosition;
    if( !info.field.multivalued ) {
        info.field.setValue( info.setName, info.parsed );
        // I don't need to call updateSpecial() here - if the field was SeLiteSettings.NULL, then the above setValue() replaced that
    }
    else
    if( !(info.field instanceof SeLiteSettings.Field.FixedMap) ) {
        for( var otherKey in info.fieldTreeRowsOrChildren ) {
            // Following check also excludes SeLiteSettings.NEW_VALUE_ROW, because we don't want to compare it to real values. 
            if( SeLiteSettings.reservedNames.indexOf(otherKey)<0
            && info.field.compareValues(otherKey, value)>=0 ) {
                rowAfterNewPosition= info.fieldTreeRowsOrChildren[otherKey];
                break;
            }
        }
        if( !rowAfterNewPosition && info.field [SeLiteSettings.NEW_VALUE_ROW] && Object.keys(info.fieldTreeRowsOrChildren).length===3 ) {
            // fieldTreeRowsOrChildren has 3 keys: SeLiteSettings.FIELD_MAIN_ROW, SeLiteSettings.FIELD_TREECHILDREN, SeLiteSettings.NEW_VALUE_ROW.
            // So there's no other existing value, and the row being edited is a new one (it didn't have a real value set yet)
            info.fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW]===info.treeRow && info.oldKey===SeLiteSettings.NEW_VALUE_ROW || SeLiteMisc.fail( "This assumes that if fieldTreeRowsOrChildren[SeLiteSettings.NEW_VALUE_ROW] is set, then that's the row we're just editing." );
            rowAfterNewPosition= info.treeRow;
        }
        if( rowAfterNewPosition===info.treeRow ) {
            info.fieldTreeRowsOrChildren[value]= info.treeRow;
            var propertiesPrefix= info.rowProperties.substr(0, /*length:*/info.rowProperties.length-info.oldKey.length); // That includes a trailing space
            info.treeRow.setAttribute( 'properties', propertiesPrefix+value );
        }
        if( info.oldKey!==SeLiteSettings.NEW_VALUE_ROW ) {
            info.field.removeValue( info.setName, info.oldKey );
        }
        else {
            updateSpecial( info.setName, info.field, +1 );
        }
        info.field.addValue( info.setName, info.parsed );
    }
    else {
        updateSpecial( info.setName, info.field, +1 ); // unset SeLiteSettings.VALUE_PRESENT on the field, if applicable
        var setNameDot= info.setName!==''
            ? info.setName+'.'
            : '';
        info.field.setPref( setNameDot+ info.field.name+ '.' +info.oldKey, value ); //@TODO low: Check this for Int/Decimal - may need to treat value
    }
    SeLiteSettings.savePrefFile(); //@TODO low importance Do we need this line?
    moduleSetFields[info.module.name][info.setName]= info.module.getFieldsOfSet( info.setName, true ); // not efficient, but robust: re-load the whole lot, rather than tweak it.
    
    // Now update GUI:
    if( info.field.multivalued && !(info.field instanceof SeLiteSettings.Field.FixedMap) && rowAfterNewPosition!==info.treeRow ) { // Repositioning - remove treeRow, create a new treeRow
        var treeChildren= info.fieldTreeRowsOrChildren[SeLiteSettings.FIELD_TREECHILDREN];
        treeChildren.removeChild( info.treeRow.parentNode );
        var treeItem= new RowInfo( info.module, info.setName, RowLevel.OPTION, info.field, /*key*/value, valueCompound(info.field, info.setName) ).generateTreeItem(); // That sets 'properties' and it adds an entry to treeRow[value] (which is same as fieldTreeRowsOrChildren[value] here).
        // Firefox 22.b04 and 24.0a1 doesn't handle parent.insertBefore(newItem, null), even though it should - https://developer.mozilla.org/en-US/docs/Web/API/Node.insertBefore
        if(true){//@TODO low: cleanup
            if( rowAfterNewPosition ) {
                treeChildren.insertBefore( treeItem, rowAfterNewPosition.parentNode );
            }
            else {
                treeChildren.appendChild( treeItem );
            }
        }
        else {
            treeChildren.insertBefore( treeItem,
            rowAfterNewPosition
                ? rowAfterNewPosition.parentNode
                : null );
        }
        treeItem.focus();
    }
        
    var fieldRow= fieldTreeRow(info.setName, info.field);
    //@TODO centralise - just like for click event:
    treeCell( fieldRow, Column.VALUE/*@TODO?!?!:TRUE (originally FIELD)*/ ).setAttribute( 'properties', '' ); // Clear it, in case it was SeLiteSettings.FIELD_NULL_OR_UNDEFINED (which has special CSS style)
    // Clear Null/Undefine etc.
    var fieldRowInfo= new RowInfo( info.module, info.setName, RowLevel.FIELD, info.field,
        /*key*/!(info.field instanceof SeLiteSettings.Field.FixedMap)
            ? value
            : undefined,
        valueCompound(info.field, info.setName) );
    fieldRowInfo.setAllCellDetails( fieldRow );
    
    if( info.field.multivalued || info.field instanceof SeLiteSettings.Field.FixedMap ) {
        var optionRow= treeRowsOrChildren[info.module.name][info.setName][info.field.name][info.oldKey];
        if( !optionRow ) debugger;
        var optionRowInfo= new RowInfo( info.module, info.setName, RowLevel.OPTION, info.field, /*key*/value, valueCompound(info.field, info.setName) );
        optionRowInfo.setAllCellDetails( optionRow );
    }
    if( info.field.multivalued && !(info.field instanceof SeLiteSettings.Field.FixedMap) ) {
        delete info.fieldTreeRowsOrChildren[info.oldKey];
    }
    return true;
};

var createTreeView= function createTreeView(original) {
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
        setCellText: function( row, col, value ) {
            // I have to pass original, rather than just original.setCellText as a parameter, because I couldn't invoke original.setCellText.call(null, parameters...).
            // It failed with: NS_NOINTERFACE: Component does not have requested interface [nsITreeView.setCellText]
            setCellText.call( null, row, col, value, original );
        },
        setCellValue: function(row, col, value) { return original.setCellValue(row, col, value); },
        setTree: function(tree) { return original.setTree(tree); },
        toggleOpenState: function(index) { return original.toggleOpenState(index); }
    };
};

/** Set/unset special value for the field in the preferences, if the change involves setting/unsetting a special value
 *  - that is, SeLiteSettings.VALUE_PRESENT or SeLiteSettings.NULL.
 *  Don't actually set/add/remove any actual value (other than a special value).
 *  Call this function before we set/add/remove the new value in preferences.
 *  @param setName string Name of the set; empty if the module doesn't allow multiple sets
 *  @param field Field instance
 *  @param int addOrRemove +1 if adding entry; -1 if removing it; any of 0/null/undefined if replacing or setting the whole field to null/undefined. It can be one of +1, -1 only if field.multivalued. If the field is an instance of SeLiteSettings.Field.FixedMap, then addOrRemove should be 0 when setting an *option* (value for fixedKey) of the field to null/undefined. Therefore you usually need 2 calls to this function when handling SeLiteSettings.Field.FixedMap - that keeps this function simple.
 *  @param {*} keyOrValue The new value to store, or (for Choice) the key for the new value to check.
 *  It can be anything (and is not used) if addOrRemove is +1 or -1, unless the field is an instance of SeLiteSettings.Field.FixedMap. Otherwise
 *  It should have been validated - this function doesn't validate keyOrValue.
 *  It can be null if it's a single-valued field.
 *  It can be undefined (then if it is multi-valued, the field is stored as VALUE_PRESENT).
 *  @param {string} [fixedKey] Only used, when setting an option (key) of SeLiteSettings.Field.FixedMap to null/undefined.
 *  But do not use when setting the whole value of a SeLiteSettings.Field.FixedMap field to undefined.
 * */
var updateSpecial= function updateSpecial( setName, field, addOrRemove, keyOrValue, fixedKey ) {
    !addOrRemove || field.multivalued || SeLiteMisc.fail("addOrRemove can be one of +1, -1 only if field.multivalued. addOrRemove is " +addOrRemove+ " and field.multivalued is " +field.multivalued);
    addOrRemove || keyOrValue!==null || !field.multivalued || field instanceof SeLiteSettings.Field.FixedMap
        || SeLiteMisc.fail("Field " +field.name+ " is multivalued, yet keyOrValue is null.");
    fixedKey===undefined || field instanceof SeLiteSettings.Field.FixedMap
        || SeLiteMisc.fail( 'fixedKey must be undefined, unless field is an instance of SeLiteSettings.Field.FixedMap.');
    var setNameDot= setName
        ? setName+'.'
        : setName;
    var compound= moduleSetFields[field.module.name][setName][field.name];
    try {
    if( addOrRemove ) {
        if( addOrRemove>0 ) {
            if( compound.entry!==undefined && Object.keys(compound.entry).length===0 && field.module.prefsBranch.prefHasUserValue(setNameDot+field.name) ) {
                field.module.prefsBranch.clearUserPref( setNameDot+field.name); // Clearing VALUE_PRESENT
            }
        }
        else {
            if( Object.keys(compound.entry).length===1 ) {
                field.module.prefsBranch.setCharPref( setNameDot+ field.name, SeLiteSettings.VALUE_PRESENT );
            }
        }
    }
    else {
        if( keyOrValue===null ) {
            if( fixedKey!==undefined && field instanceof SeLiteSettings.Field.FixedMap ) {
                field.module.prefsBranch.setCharPref( setNameDot+field.name+ '.' +fixedKey, SeLiteSettings.NULL );
            }
            else {
                if( field instanceof SeLiteSettings.Field.Choice && compound.entry!==undefined && Object.keys(compound.entry).length>0 ) {
                    !field.multivalued && Object.keys(compound.entry).length===1 || SeLiteMisc.fail();
                    field.module.prefsBranch.clearUserPref( setNameDot+field.name+ '.' +Object.keys(compound.entry)[0] );
                }
                if( field.module.prefsBranch.prefHasUserValue(setNameDot+field.name) && field.prefType()!==nsIPrefBranch.PREF_STRING ) {
                    field.module.prefsBranch.clearUserPref( setNameDot+field.name);
                }
                field.module.prefsBranch.setCharPref( setNameDot+field.name, SeLiteSettings.NULL );
            }
        }
        else
        if( keyOrValue===undefined ) {
            if( fixedKey!==undefined && field instanceof SeLiteSettings.Field.FixedMap ) {
                if( field.module.prefsBranch.prefHasUserValue(setNameDot+field.name+ '.' +fixedKey) ) {
                    field.module.prefsBranch.clearUserPref( setNameDot+field.name+ '.' +fixedKey );
                }
            }
            else {
                !field.multivalued || compound.entry!==undefined && Object.keys(compound.entry).length===0 || SeLiteMisc.fail("Multivalued field " +field.name+ " has one or more entries, therefore keyOrValue must not be undefined.");
                if( field.module.prefsBranch.prefHasUserValue(setNameDot+field.name) ) {
                    field.module.prefsBranch.clearUserPref(setNameDot+field.name);
                }
            }
        }
        else 
        if( field instanceof SeLiteSettings.Field.Choice && compound.entry===null ) {
            !field.multivalued || SeLiteMisc.fail();
            if( field.module.prefsBranch.prefHasUserValue(setNameDot+field.name) ) {
                field.module.prefsBranch.clearUserPref(setNameDot+field.name); // Clearing NULL
            }
        }
        // Otherwise, if the field had NULL, then I don't clear that preference here, because that preference gets set outside of this function
    }
    } catch(e) {
        console.log( 'updateSpecial() Module ' +field.module.name+ ', set ' +setName+ ', field: ' +field.name+ ' has compound: ' +typeof compound );
        SeLiteMisc.fail(e);
    }
};

/* @var allowSets bool Whether to show the column for selection of a set. If we're only showing one module and we're not showing fields per folder,
 * then this allowSets is same as module.allowSets.
 *  If we're showing more modules, then it's true if at least one of those modules has allowSets==true and we're not showing fields per folder.
 *  This will be set depending on the definition of module(s).
*/
var allowSets= false;
/** @var allowMultivaluedNonChoices bool Whether we allow multivalued non-choice (free text) fields.
 *  If allowMultivaluedNonChoices or allowSets, then we show 'Action' column.
 *  This will be set depending on the definition of module(s).
 */
var allowMultivaluedNonChoices= false;

/** @var {(string|null)} Null if we're showing configuration set(s) irrelevant of a folder. Otherwise it's 
 *  a string, absolute path to the folder we're applying the overall configuration.
 *  This will be set depending on how this file is invoked.
 * */
var targetFolder= null;
/** Shortcut function. Only valid once I set variable targetFolder.
 *  @return {bool}
 * */
var showingPerFolder= function showingPerFolder() { return targetFolder!==null; };

/** Create an object for a new <treechildren>. Add it to the parent.
 *  @return XULElement for the new <treechildren>
 * */
var createTreeChildren= function createTreeChildren( parent ) {
    if( !(parent instanceof XULElement)
    || parent.tagName!=='treeitem' && parent.tagName!=='tree' ) {
        throw new Error( 'createTreeChildren() requires parent to be an object for <treeitem> or <tree>.');
    }
    var treeChildren= window.document.createElementNS( XUL_NS, 'treechildren');
    if( parent.tagName!=='tree' ) {
        parent.setAttribute('container', 'true');
        parent.setAttribute('open', 'false');
    }
    parent.appendChild( treeChildren);
    return treeChildren;
};

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
    var params= window.document.location.search.substring(1);
    if( window.document.location.search ) {
        if( /register/.exec( params ) ) {
            var result= {};
            if( promptService.select(
                window,
                'How to register or update a module definition',
                'You are about to register or update a Javascript definition of your configuration module. How would you enter it?',
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
                    var urlText= window.prompt( "Please enter the full URL to your Javascript file." );
                    if( urlText ) {
                        url= nsIIOService.newURI( urlText, null, null);
                    }
                }
                if( url ) {
                    console.log('loading settings definition from ' +url.spec );
                    subScriptLoader.loadSubScript(
                        url.spec,
                        {
                            SeLiteSettings: SeLiteSettings,
                            SELITE_SETTINGS_FILE_URL: url.spec
                        },
                        'UTF-8'
                    );
                    window.location.search= '';
                }
            }
            return;
        }
        var match= /folder=([^&]*)/.exec( params );
        if( match ) {
            targetFolder= unescape( match[1] );
        }
        // I don't support more URL parameters (e.g. passing setName), since the URL could get longer than address bar of Firefox. Then it wouldn't be obvious that the screen filters down, and that may mislead the user.
        var match= /module=([a-zA-Z0-9_.-]+)/.exec( params );
        var moduleName= null;
        if( match ) {
            moduleName= unescape( match[1] );
            try {
                modules[ moduleName ]= SeLiteSettings.loadFromJavascript( moduleName, undefined, true/** Force reload, so that user's changes has an effect without restarting Firefox. */ );
            }
            catch(e) {
                window.alert( "Couldn't load JS definnition of the requested module: " +e+ ':\n' +e.stack );
            }
            SeLiteMisc.ensure( !targetFolder || modules[moduleName].associatesWithFolders, "You're using URL with folder=" +targetFolder+
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
                window.document.location= newLocation;
            }
        }
    }
    var allowModules= false; // true if we list all modules (if any); false if we just list one named in URL parameter 'module' (if any)
    if( SeLiteMisc.isEmptyObject(modules) ) {
        allowModules= true;
        var moduleNames= SeLiteSettings.moduleNamesFromPreferences( prefix );
        var exceptionDetails= {};
        for( var i=0; i<moduleNames.length; i++ ) {
            var module;
            try {
                module= SeLiteSettings.loadFromJavascript( moduleNames[i], undefined, true/** Force reload, so that user's changes take effect without restarting Firefox. */ );
            }
            catch(e) {
                exceptionDetails[ moduleNames[i] ]= ''+ e+ ':\n' +e.stack;
            }

            if( !showingPerFolder() || module.associatesWithFolders ) {
                modules[ moduleNames[i] ]= module;
            }
        }
        if( Object.keys(exceptionDetails).length>0 ) {
            var msg= "Couldn't load JS definnition of configuration module(s):\n";
            for( var moduleName in exceptionDetails ) {
                msg+= moduleName+ ': ' +exceptionDetails[moduleName]+ '\n\n';
            }
            window.alert( msg );
        }
    }
    var tree= window.document.createElementNS( XUL_NS, 'tree' );
    tree.setAttribute( 'id', 'settingsTree');
    tree.setAttribute( 'editable', ''+!showingPerFolder() );
    tree.setAttribute( 'seltype', 'single' );
    tree.setAttribute( 'hidecolumnpicker', 'true');
    tree.setAttribute( 'hidevscroll', 'false');
    tree.setAttribute( 'class', 'tree');
    tree.setAttribute( 'onblur', 'onTreeBlur()' );
    tree.setAttribute( 'flex', '1');
    var settingsBox= window.document.getElementById('SeSettingsBox');
    settingsBox.appendChild( tree );
    
    for( var moduleName in modules ) {
        var module= modules[moduleName];
        allowSets= allowSets || module.allowSets && !showingPerFolder();
        
        for( var fieldName in module.fields ) {
            var field= module.fields[fieldName];
            allowMultivaluedNonChoices= allowMultivaluedNonChoices || field.multivalued && field instanceof SeLiteSettings.Field.Choice;
        }
    }
    tree.appendChild( generateTreeColumns(allowModules, showingPerFolder()) );
    var topTreeChildren= createTreeChildren( tree );
    
    var setNameToExpand= null;
    if( allowModules ) {
        for( var moduleName in modules ) {
            var moduleTreeItem= new RowInfo( modules[moduleName], undefined, RowLevel.MODULE, undefined ).generateTreeItem();
            topTreeChildren.appendChild( moduleTreeItem );
            
            var moduleChildren= createTreeChildren( moduleTreeItem );
            generateSets( moduleChildren, modules[moduleName] );
        }
    }
    else
    if( !SeLiteMisc.isEmptyObject(modules) ) {
        for( var moduleName in modules ); // just get moduleName
        
        var moduleChildren;
        if( allowSets && modules[moduleName].allowSets ) {
            var moduleTreeItem= new RowInfo( modules[moduleName], undefined, RowLevel.MODULE, undefined ).generateTreeItem();
            topTreeChildren.appendChild( moduleTreeItem );
            moduleChildren= createTreeChildren( moduleTreeItem );
        }
        else {
            moduleChildren= topTreeChildren;
        }
        if( window.document.location.search ) {
            var match= /set=([a-zA-Z0-9_.-]+)/.exec( params );
            if( match ) {
                setNameToExpand= unescape( match[1] );
            }
        }
        generateSets( moduleChildren, modules[moduleName] );
        tree.view.toggleOpenState(0); // expand the module, because it's the only one shown
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
var chooseJavascriptFile= function chooseJavascriptFile() {
	var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	filePicker.init(window, "Select a Javascript file with definition of your module(s)", nsIFilePicker.modeOpen);
    filePicker.appendFilter( 'Javascript', '*.js');
    filePicker.appendFilters( nsIFilePicker.filterAll);
	var result= filePicker.show();
	if( result===nsIFilePicker.returnOK || result===nsIFilePicker.returnReplace ) {
		return filePicker.file;
	}
    return null;
};
/*
var seLiteSettingsMenuItem= window.document.createElementNS( XUL_NS, 'menuitem' );
seLiteSettingsMenuItem.setAttribute( 'label', 'SeLiteSettings module(s)' );
seLiteSettingsMenuItem.setAttribute( 'oncommand', 'window.editor.showInBrowser("chrome://selite-settings/content/tree.xul")' );
seLiteSettingsMenuItem.setAttribute( 'accesskey', 'S' );
var optionsPopup= window.document.getElementById('options-popup');
optionsPopup.appendChild(seLiteSettingsMenuItem);
/**/
}