/*
 * Copyright 2005 Shinya Kasatani
 * Copyright 2015 Peter Kehl
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
function onTreeDblClick(event) {
    var tree= event.currentTarget;
    tree.stopEditing();
    tree.focus(); // otherwise Firefox command despatcher won't route the following command properly
    goDoCommand('cmd_selenium_exec_command');
}

var indentedText= /^(\s+)(.*)/;

function onTreeClick( event ) {
    //  editor.treeView.tree.currentIndex may be different to the clicked row. See 'Complex' sequence F) in ide-extension.js: 'onblur' handler gets triggerred before 'onclick'
    // event.target is treechildren; event.currentTarget is tree; event.relatedTarget is null
    // @TODO if event.clientY is too close to the bottom of the tree, then return. Otherwise the following selected a cell in a neighbour row!
    var tree= event.currentTarget;
    if( tree.getAttribute('editing')==='true' || event.button!==0/*Clicked other than main button*/) {
        return;
    }
    window.editor.treeView.selectCommand(); // because of our override of tree's onselect in ovIDEorSidebar.xul
    
    var rowObject= { value: -1 }; // value will be 0-based row index, within the set of *visible* rows only (it skips the collapsed rows)
    var columnObject= { value: null }; // value is instance of TreeColumn. See https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeColumn                
    var treeBoxObject= tree.boxObject;
    treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    treeBoxObject.getCellAt(event.clientX, event.clientY, rowObject, columnObject, {}/*unused, but needed*/ );
    
    // The clicked row has already been selected as the current command/comment. Start editing cell in-place.
    // For comments, start editing in-place 'command' column, no matter what column was clicked.
    var column= columnObject.value;
    if( editor.treeView.currentCommand.type==='comment' ) { // Since it's a comment, we're editing its first cell, no matter which cell was clicked.
        column= tree.columns[0];
        // In the following I've tried to temporarily disable comment's overflow, but there seems not to be a way (then I'd have to re-enable it afterwards).
        //document.getElementById('command').removeAttribute('overflow');
        //treeBoxObject.invalidateRange( rowObject.value, rowObject.value+1 );
    }

    tree.inputField.setAttribute( 'type',
        editor.treeView.currentCommand.type==='command' && column===tree.columns[0]
        ? "autocomplete"
        : '' // Clear it, in case it was previously set to "autocomplete" by the previously
    );
    tree.startEditing( rowObject.value, column );

    // The above call to startEditing() calls setTimeout(), which puts a callback function in the execution queue. That callback function focuses and selects the tree.inputField. So, if there is any code here that needs to be run after tree.inputField gets selected, it is queued by the following.
    window.setTimeout(
        column===tree.columns[0]
        ? TreeView.putCaretAfterLeadingSpaces
        : putCaretWhereClickedOrAtTheEnd.bind( null, event ),
    0 );
}

// Simulate a click at tree.inputField, so that the user can start typing where she clicked. See also chrome://global/content/bindings/tree.xml#tree -> startEditing
// If the user clicked at a long comment (that overflew to target/value column), we put the caret after the last character in the editable area.
// I tried to put it after the last *visible* character, but I couldn't find a way. E.g. document.caretPositionFromPoint( window.left+tree.inputField.left+tree.inputField.width-20, event.clientY) returned null.
function putCaretWhereClickedOrAtTheEnd( event ) {
    var tree= document.getElementById('commands');
    var caretCharacterIndex= editor.treeView.currentCommand.type==='command' || columnObject.value===tree.columns[0]
        ? document.caretPositionFromPoint( event.clientX, event.clientY).offset
        : tree.inputField.value.length;
    tree.inputField.setSelectionRange( caretCharacterIndex, caretCharacterIndex );
}

function onInPlaceEditInput( input ) {
    var tree= document.getElementById('commands');
    var idKey= tree.editingColumn===tree.columns[0] // What field of the command/comment to update in details area
        ? 'Action'
        : (tree.editingColumn===tree.columns[1]
            ? 'Target'
            : 'Value'
        );
    var indexOfReplacementSign= input.value.indexOf('>>'); // This happens when clipboard-and-indent/src/components/SeleniumIDEGenericAutoCompleteSearch.js decreases indentation for endXXX or for closing commands. That works in Clipboard-and-indent for auto-complete in the detailed editing area; however, in-place editing doesn't handle it well, so the following assists it
    if( indexOfReplacementSign>0 ) {
        input.value= input.value.substr( indexOfReplacementSign+2 );
    }
    document.getElementById( 'command'+idKey ).value= input.value;
}

function onInPlaceEditBlur( event ) {
    var tree= document.getElementById('commands');
    if( tree.getAttribute('editing')!=="true" ) {
        // This gets sometimes called on TAB/Shift+TAB, before 'keypress' event. That caused a race conflict with seLiteTreeOnKeyPress() in ide-extension.js
        // This happens for *some* blur events (e.g. for 4th and further row).
        event.preventDefault();
        return;
    }
    // See notes for setCellText() in ide-extension.js.
    // tree.editingColumn is already null. tree.inputField.value is already empty. Hence:
    window.editor.treeView.selectCommand();
}