"use strict";
Components.utils.import('resource://gre/modules/devtools/Console.jsm', {});
Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js" );


function onTreeClick( event ) {
    // event.target is treechildren; event.currentTarget is tree; event.relatedTarget is null
    // @TODO if event.clientY is too close to the bottom of the tree, then return. Otherwise the following selected a cell in a neighbour row!
    var tree= event.currentTarget;
    var row= { value: -1 }; // value will be 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
    var column= { value: null }; // value is instance of TreeColumn. See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeColumn                
    var treeBoxObject= tree.boxObject;
    treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    treeBoxObject.getCellAt(event.clientX, event.clientY, row, column, {}/*unused, but needed*/ );
    
    // The clicked row has already been selected as the current command/comment.
    // For commands, only allow edit-in-place for 'target' and 'value' columns. That allows us to still execute the command by double-clicking at the command name itself.
    // For comments, only allow edit-in-place for 'command' column, and do it no matter what column was clicked.
    if( editor.treeView.currentCommand.type==='command' && (column.value===tree.columns[1] || column.value===tree.columns[2])
    ||  editor.treeView.currentCommand.type==='comment'
    ) {
        if( editor.treeView.currentCommand.type==='comment' ) {
            column.value= tree.columns[0];
            //@TODO temporarily disable overflow?!
        }
        tree.startEditing( row.value, column.value );

        // The above call to startEditing() calls setTimeout(), which puts a callback function in the execution queue. That callback function focuses and selects the tree.inputField. The following puts another code in the queue, which simulates a click at tree.inputField, so that the user can start typing where she clicked. See also chrome://global/content/bindings/tree.xml#tree -> startEditing
        window.setTimeout( function() {
            if( editor.treeView.currentCommand.type==='comment' ) {
                //@TODO If the user clicked at a long comment (that overflew to target/value column), we focus at the last visible character in the editable area.
                // I.e. if event.X is past the tree.inputField (i.e. past 'command' column), then use tree.inputField's right coordinate
            }
            var range= document.caretPositionFromPoint(event.clientX, event.clientY);
            tree.inputField.setSelectionRange( range.offset, range.offset );
            //treeBoxObject.invalidateScrollbar(); This doesn't help
        }, 0 );
   }
}