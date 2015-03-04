/*
 * Copyright 2005 Shinya Kasatani
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";

function onTreeClick( event ) {
    editor.treeView.seLiteTreePreviousIndex= editor.treeView.tree.currentIndex;
    // event.target is treechildren; event.currentTarget is tree; event.relatedTarget is null
    // @TODO if event.clientY is too close to the bottom of the tree, then return. Otherwise the following selected a cell in a neighbour row!
    var tree= event.currentTarget;
    if( tree.getAttribute('editing') || event.button!==0/*Clicked other than main button*/) {
        return;
    }
    var rowObject= { value: -1 }; // value will be 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
    var columnObject= { value: null }; // value is instance of TreeColumn. See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeColumn                
    var treeBoxObject= tree.boxObject;
    treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    treeBoxObject.getCellAt(event.clientX, event.clientY, rowObject, columnObject, {}/*unused, but needed*/ );
    var column= columnObject.value;
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

function onInPlaceEditInputOrBlur( newValue ) {
    //Components.utils.import('resource://gre/modules/devtools/Console.jsm', {}).console.error
    var tree= document.getElementById('commands');
    var key= tree.editingColumn===tree.columns[0] // What field of the command/comment to update
        ? 'command'
        : (tree.editingColumn===tree.columns[1]
            ? 'target'
            : 'value'
        );
    var decodedValue= tree.editingColumn===tree.columns[0]
        ? newValue
        : window.editor.treeView.decodeText(newValue);
    
    window.editor.treeView.updateCurrentCommand( key, decodedValue);
    window.editor.treeView.selectCommand();
}