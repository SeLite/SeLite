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
var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
function onTreeDblClick(event) {
    console.error( 'onTreeDblClick');
    var tree= event.currentTarget;
    tree.stopEditing();
    tree.focus(); // otherwise Firefox command despatcher won't route the following command properly
    goDoCommand('cmd_selenium_exec_command');
}

function onTreeClick( event ) {
    console.error( 'onTreeClick');
    //  editor.treeView.tree.currentIndex may be different to the clicked row. See notes on 'Complex' sequence in ide-extension.js: 'onblur' handler gets triggerred before 'onclick'
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
    
    // The clicked row has already been selected as the current command/comment. Start editing cell in-place.
    // For comments, start editing in-place 'command' column, no matter what column was clicked.
    if( true || TODO_cleanup || editor.treeView.currentCommand.type==='command' && (column===tree.columns[1] || column===tree.columns[2])
    ||  editor.treeView.currentCommand.type==='comment'
    ) {
        var column= columnObject.value;
        if( editor.treeView.currentCommand.type==='comment' ) { // Since it's a comment, we're editing its first cell, no matter which cell was clicked.
            column= tree.columns[0];
            // In the following I've tried to temporarily disable comment's overflow, but there seems not to be a way (then I'd have to re-enable it afterwards).
            //document.getElementById('command').removeAttribute('overflow');
            //treeBoxObject.invalidateRange( rowObject.value, rowObject.value+1 );
        }
        
        var editingCommandAction= editor.treeView.currentCommand.type==='command' && column===tree.columns[0];
        if( editingCommandAction ) {
        //@TODO keep indentation; make replacing the command easy: highlight the whole command (excluding any leading spaces)
        //@TODO autocomplete
            tree.inputField.setAttribute( 'type', "autocomplete" );

                /*var commands = [];

                var nonWaitActions = ['open', 'selectWindow', 'chooseCancelOnNextConfirmation', 'answerOnNextPrompt', 'close', 'setContext', 'setTimeout', 'selectFrame'];
                debugger;
                for (func in window.editor.seleniumAPI.Selenium.prototype) {
                    //this.log.debug("func=" + func);
                    var r;
                    if (func.match(/^do[A-Z]/)) {
                        var action = func.substr(2,1).toLowerCase() + func.substr(3);
                        commands.push(action);
                        if (!action.match(/^waitFor/) && nonWaitActions.indexOf(action) < 0) {
                            commands.push(action + "AndWait");
                        }
                    } else if (func.match(/^assert.+/)) {
                        commands.push(func);
                        commands.push("verify" + func.substr(6));
                    } else if ((r = func.match(/^(get|is)(.+)$/))) {
                        var base = r[2];
                        commands.push("assert" + base);
                        commands.push("verify" + base);
                        commands.push("store" + base);
                        commands.push("waitFor" + base);
                        var r2;
                        if ((r = func.match(/^is(.*)Present$/))) {
                            base = r[1];
                            commands.push("assert" + base + "NotPresent");
                            commands.push("verify" + base + "NotPresent");
                            commands.push("waitFor" + base + "NotPresent");
                        } else {
                            commands.push("assertNot" + base);
                            commands.push("verifyNot" + base);
                            commands.push("waitForNot" + base);
                        }
                    }
                }
                debugger;
                commands.push("pause");
                commands.push("store");
                commands.push("echo");
                commands.push("break");

                commands.sort();

                //var tree= document.getElementById('commands');
                if( !tree.inputField.getAttribute('id') ) {
                    tree.inputField.setAttribute('id', 'treeTextbox' );
                }
                Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console.error( 'inputField id: ' +tree.inputField.getAttribute('id') );
                var searchParam= window.editor.getAutoCompleteSearchParam( tree.inputField.getAttribute('id') );
                tree.inputField.setAttribute( 'autocompletesearchparam', searchParam ); // equivalent to 'searchParam' property, which was already set by window.editor.getAutoCompleteSearchParam() above.
                Editor.GENERIC_AUTOCOMPLETE.setCandidates( XulUtils.toXPCOMString(searchParam),
                                                           XulUtils.toXPCOMArray(commands));

            var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
            var goodAttributes= document.getElementById('commandAction1').attributes;
            var sickAttributes= tree.inputField.attributes;

            // Compare attributes
            var attributeSets= [goodAttributes, sickAttributes];
            var setNames= ['good', 'sick'];
            for( var i=0; i<2; i++ ) {
                var sourceName= setNames[i];
                var targetName= setNames[1-i];
                var source= attributeSets[i];
                var target= attributeSets[1-i];

                for( var j=0; j<source.length; j++ ) {
                    var sourceAttr= source[j];
                    var targetAttr= undefined;
                    for( var k=0; k<target.length; k++ ) {
                        if( target[k].name===sourceAttr.name ) {
                            targetAttr= target[k];
                            break;
                        }
                    }
                    if( !targetAttr || sourceAttr.value!==targetAttr.value && i===0 ) {
                        console.error( sourceAttr.name+ ' ' +sourceName+ ': ' +sourceAttr.value+ ', ' +targetName+ ': '
                            +(targetAttr
                                ? targetAttr.value
                                : 'missing'
                             )
                        );
                    }                                
                }
            }*/
        }
        else {
            tree.inputField.setAttribute( 'type', "" ); // Clear it, in case it was previously set to "autocomplete" from the above
        }
        tree.startEditing( rowObject.value, column );

        // The above call to startEditing() calls setTimeout(), which puts a callback function in the execution queue. That callback function focuses and selects the tree.inputField. The following puts another code in the queue, which simulates a click at tree.inputField, so that the user can start typing where she clicked. See also chrome://global/content/bindings/tree.xml#tree -> startEditing
        if( !editingCommandAction ) {
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
}

function onInPlaceEditInput( newValue ) {
    console.error( 'onInput');
    var tree= document.getElementById('commands');
    var idKey= tree.editingColumn===tree.columns[0] // What field of the command/comment to update in details area
        ? 'Action'
        : (tree.editingColumn===tree.columns[1]
            ? 'Target'
            : 'Value'
        );
    document.getElementById( 'command'+idKey ).value= newValue; //@TODO if we use the following, then I may eliminate this line and the above
    
    // When editing in-place, if there's an autocomplete hint, then there's 'select' event for the tree after each 'input' event for tree.inputField. Hence here I have to update the command in the object model. If there's no autocomplete hint, then there's no 'select' event.
    if( true ) {//@TODO How will I revert the changes in on blur? Also, how will I then mark test case as unmodified? See notes.txt
        // OR: override tree's onselect; don't call selectCommand() if tree.isEditing.
        var key= tree.editingColumn===tree.columns[0] // What field of the command/comment to pass to window.editor.treeView.updateCurrentCommand()
            ? 'command'
            : ( tree.editingColumn===tree.columns[1]
                ? 'target'
                : 'value'
            );
        var decodedValue= tree.editingColumn===tree.columns[0]
            ? newValue
            : window.editor.treeView.decodeText(newValue);
        window.editor.treeView.updateCurrentCommand( key, decodedValue); // This updates the command in the test case object
        //window.editor.treeView.selectCommand(); // This updates the Command/Target/Value details area
    }
    //editor.treeView.seLiteTreePreviousIndex= editor.treeView.tree.currentIndex;
}

// See notes for setCellText() in ide-extension.js
function onInPlaceEditBlur() {
    console.error( 'onBlur');
    // tree.editingColumn is already null. tree.inputField.value is already empty. Hence:
    window.editor.treeView.selectCommand();
}