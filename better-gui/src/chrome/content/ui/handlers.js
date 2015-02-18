"use strict";
Components.utils.import('resource://gre/modules/devtools/Console.jsm', {});
Components.utils.import( "chrome://selite-misc/content/SeLiteMisc.js" );

var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
function onTreeClick( event ) {
    editor.treeView.seLiteTreePreviousIndex= editor.treeView.tree.currentIndex;
    // event.target is treechildren; event.currentTarget is tree; event.relatedTarget is null
    // @TODO if event.clientY is too close to the bottom of the tree, then return. Otherwise the following selected a cell in a neighbour row!
    var tree= event.currentTarget;
    if( tree.getAttribute('editing') ) {
        return;
    }
    var rowObject= { value: -1 }; // value will be 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
    var columnObject= { value: null }; // value is instance of TreeColumn. See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeColumn                
    var treeBoxObject= tree.boxObject;
    treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    treeBoxObject.getCellAt(event.clientX, event.clientY, rowObject, columnObject, {}/*unused, but needed*/ );
    var column= columnObject.value;
    console.error( 'onTreeClick row ' +rowObject.value );
    console.error( 'editor.treeView.currentCommand: ' +editor.treeView.currentCommand['command']+ ' | ' +editor.treeView.currentCommand['target'] +' | ' +editor.treeView.currentCommand['value']);
    // The clicked row has already been selected as the current command/comment.
    // For commands, only allow edit-in-place for 'target' and 'value' columns. That allows us to still execute the command by double-clicking at the command name itself.
    // For comments, only allow edit-in-place for 'command' column, and do it no matter what column was clicked.
    if( editor.treeView.currentCommand.type==='command' && (column===tree.columns[1] || column===tree.columns[2])
    ||  editor.treeView.currentCommand.type==='comment'
    ) {
        if( editor.treeView.currentCommand.type==='comment' ) {
            column= tree.columns[0];
            // In the following I've tried to temporarily disable comment's overflow, but there seems not to be a way (then I'd have to re-enable it afterwards).
            //document.getElementById('command').removeAttribute('overflow');
            //treeBoxObject.invalidateRange( rowObject.value, rowObject.value+1 );
        }
        tree.startEditing( rowObject.value, column );

        // The above call to startEditing() calls setTimeout(), which puts a callback function in the execution queue. That callback function focuses and selects the tree.inputField. The following puts another code in the queue, which simulates a click at tree.inputField, so that the user can start typing where she clicked. See also chrome://global/content/bindings/tree.xml#tree -> startEditing
        window.setTimeout( function() {
            // If the user clicked at a long comment (that overflew to target/value column), we put the caret after the last character in the editable area.
            // I tried to put it after the last *visible* character, but I couldn't find a way. E.g. document.caretPositionFromPoint( window.left+tree.inputField.left+tree.inputField.width-20, event.clientY) returned null.
            var caretCharacterIndex= editor.treeView.currentCommand.type==='command' || columnObject.value===tree.columns[0]
                ? document.caretPositionFromPoint( event.clientX, event.clientY).offset
                : tree.inputField.value.length;
            tree.inputField.setSelectionRange( caretCharacterIndex, caretCharacterIndex );
        }, 0 );
   }
}