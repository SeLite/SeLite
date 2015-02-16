"use strict";
Components.utils.import('resource://gre/modules/devtools/Console.jsm', {});
Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js" );


function onTreeClick( event ) {
    // event.target is treechildren; event.currentTarget is tree; event.relatedTarget is null
    var tree= event.currentTarget;
    var row= { value: -1 }; // value will be 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
    var column= { value: null }; // value is instance of TreeColumn. See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeColumn                
    var treeBoxObject= tree.boxObject;
    treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    treeBoxObject.getCellAt(event.clientX, event.clientY, row, column, {}/*unused, but needed*/ );
    
    // Only allow edit-in-place for 'target' and 'value'. That allows us to still execute the command by double-clicking at the command name itself
    if( column.value===tree.columns[1] || column.value===tree.columns[2] ) {
        tree.startEditing( row.value, column.value ); //tree.columns[1]

       // The above call to startEditing() calls setTimeout(), which puts a callback function in the execution queue. That callback function focuses and selects the tree.inputField. The following puts another code in the queue, which simulates a click at tree.inputField, so that the user can start typing where she clicked. See also chrome://global/content/bindings/tree.xml#tree -> startEditing
       window.setTimeout( function() {
           var range= document.caretPositionFromPoint(event.clientX, event.clientY);
           tree.inputField.setSelectionRange( range.offset, range.offset );
       }, 0 );
   }
}

