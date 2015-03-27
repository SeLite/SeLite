/*
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

XulUtils.TreeViewHelper.prototype.isEditable= TreeView.prototype.isEditable= function isEditable( row, col ) { return true;};
/** There are a few basic scenarios/sequences:
 * 
 *  A) Simple sequence: edit, focus out
 *    1. click at a cell to edit-in-place
 *    2. finish editing by pressing Enter, or by moving focus out (but not to another cell). When that triggers setCellText(), editor.treeView.currentCommand is still the command that has just been edited in-place. setCellText() calls updateCurrentCommand(), which updates the test case. Then I call selectCommand(), which updates the command details area.
 *    
 *  B) Simple sequence: edit, edit another cell of the same command (or comment)
 *    1. click at a cell to edit-in-place
 *    2. finish editing by clicking at another cell of the same command/comment (in the same row). That calls setCellText() before tree's onClick().
 *  
 *  C) Simple sequence: start editing without a click:
 *    1. select a command (without starting to edit in-place, e.g. by right click)
 *    2. hit Enter (to edit the comment, or Target, in-place), edit the cell
 *    3. finish editing in any other way than cancelling (i.e. by hiting Enter, TAB, clicking somewhere else)
 *  
 *  D) Navigating to another cell by TAB/Shift+TAB - 'healthy' event sequence:
 *    1. you're editing in-place
 *    2. you hit TAB or Shift+TAB
 *    3. tree's onkeypress (tree's "editing" attribute is still "true"), setCellText.
 *  
 *  E) Navigating to another cell by TAB/Shift+TAB - 'strange' event sequence:
 *    1. you're editing in-place
 *    2. you hit TAB or Shift+TAB
 *    3. setCellText, input onblur, tree's onblur, tree's onkeypress (tree's "editing" attribute is ""). This sequence made cell identification difficult in onkeypress handler. That's why setCellText stores details of the currently edited cell, which are used by seLiteTreeOnKeyPress(). This sequence is also handled specially by onInPlaceEditBlur().
 *      
 *  F) Complex (like a concurrent race)
 *    1. click at a cell to edit-in-place
 *    2. finish editing by clicking at another cell (regardless of whether it's possible to edit that other cell in-place, or not). That triggers:
 *    2.1 tree's onSelect(), which calls editor.treeView.selectCommand(), so now editor.treeView.currentCommand is the command from the newly selected cell!
 *    2.2 setCellText()
 *    2.3 onBlur - which has to call selectCommand() again because of sequence G)
 *    2.4 tree's onClick() in handlers.js
 *    However, setCellText() is also called from other scenarios, which don't involve this concurrent race. So, setCellText() checks whether editor.treeView.currentCommand is the same as the command for the row for its event. If they are different, that means that onSelect() has already selected the newly clicked command, but setCellText() is called with a row for the previously edited command; so then I update the previously edited command in the test case, instead of calling updateCurrentCommand(). Also, I don't update the command details area - I don't call selectCommand() - because it already shows the newly edited command.
 *    
 *    If in step 2. you edit a command's Command column, and it has autocomplete hint(s) for your changes, then see note 4. in ovIDEorSidebar.xul on extra 'select' events.
 *    
 *  G) Medium Complex: Edit, modify, cancel (no change)
 *    1. edit a cell
 *    2. stop editing (and revert any modifications) by pressing ESC. That doesn't trigger setCellText(), but only onBlur. So we need an onBlur handler to revert any changes in Command details area (i.e. one of wide inputs Command, Target or Value) that were made by previous typing (as was captured by a sequence of onInput events) - that's done in onInPlaceEditBlur().
 *    
 *  We have an onInput handler, so that we update Command details area (wide inputs Command, Target or Value) as the user types in the cell (rather than updating it only after 'committing' the change by e.g. ENTER). However, all event sequences that accept the change (i.e. except for ones where the user hits ESC) trigger setCellText() first, and only then they trigger onBlur().
 * */
XulUtils.TreeViewHelper.prototype.setCellText= TreeView.prototype.setCellText= function setCellText( row, col, value, original) {
    var tree= document.getElementById('commands');
    TreeView.lastEditingRow= row;
    TreeView.lastEditingColumn= col;
    
    //original is undefined, so I don't call original.setCellText( row, col, value );
    var key= col===tree.columns[0] // What field of the command/comment to pass to window.editor.treeView.updateCurrentCommand()
        ? 'command'
        : (col===tree.columns[1]
            ? 'target'
            : 'value'
        );
    var command= window.editor.treeView.getCommand( row );
    
    // What field of the command/comment to update directly in command object. See also TreeView.UpdateCommandAction.prototype -> execute()
    var directKey= col===tree.columns[0]
        ? (command.type==='command'
            ? 'command'
            : 'comment'
        )
        : key;
    var decodedValue= col===tree.columns[0]
        ? value
        : window.editor.treeView.decodeText(value);
    
    if( this.tree.currentIndex===row ) { // Handling one of the three simple sequences A), B) or C) (see above)
        editor.treeView.currentCommand===command || SeLiteMisc.fail( "SeLite Hands-on GUI setCellText: editor.treeView.currentCommand!==command" );
        
        if( command[directKey]!==decodedValue ) { // Update only on change. Otherwise the test case would show up as modified.
            window.editor.treeView.updateCurrentCommand( key, decodedValue);
        }
        window.editor.treeView.selectCommand();
    }
    else { // Handling the complex sequence F) (see above)
        if( command[ directKey ]!==decodedValue ) {
            command[ directKey ]= decodedValue;
            window.editor.treeView.testCase.setModified();
        }
    }
    return true;
};

( function() {
    // Adjust top 'Edit' menu and context menu: Inject 'key' attribute for menu items that insert new command/comment.
    var menusToUpdate= [ document.getElementById('treeContextMenu'), document.getElementById('menu_edit') ];
    for( var i=0; i<2; i++ ) { //@TODO var(..of..) once NetBeans like it
        //I've tried XPath and it didn't work:
        //var nsResolver = document.createNSResolver( treeContextMenu.ownerDocument == null ? treeContextMenu.documentElement : treeContextMenu.ownerDocument.documentElement ); // From https://developer.mozilla.org/en/docs/Introduction_to_using_XPath_in_JavaScript#Implementing_a_Default_Namespace_Resolver
        //var insertCommandMenuItem= window.document.evaluate( '//menuitem', treeContextMenu, nsResolver, XPathResult.ANY_UNORDERED_NODE_TYPE, null ).singleNodeValue;
        var menuItems= menusToUpdate[i].getElementsByTagName('menuitem');
        for( var j=0; j<menuItems.length; j++ ) {//@TODO for(..of..) once NetBeans like it
            var item= menuItems[j];
            if( item.getAttribute('accesskey')==='I' ) {
                item.setAttribute('key', 'insert-command-key');
            }
            if( item.getAttribute('accesskey')==='M' ) {
                item.setAttribute('key', 'insert-comment-key');
            }
        }
    }
    
    var originalInitialize= TreeView.prototype.initialize;
    TreeView.prototype.initialize= function initialize(editor, document, tree) {
        originalInitialize.call( this, editor, document, tree );
        var controllers= this.tree.controllers;
        var originalController= controllers.getControllerAt( controllers.getControllerCount()-1 );
        controllers.removeController( originalController );
        
        var self= this;
        // Add handling for 'cmd_insert_command' and 'cmd_insert_comment', by head override of controller object that was registered through appendController() in Selenium's chrome/content/treeView.js. Otherwise I couldn't register shortcut keys with those two commands, even though they were listed in Selenium's chrome/content/selenium-ide-common.xul >> <commandset id="seleniumIDECommands">
        // For that I set head override of three handler functions. I can't replace functions in originalController itself (since object originalController is protected).
        var newController= {
            supportsCommand: function supportsCommand(cmd ) {
                return cmd==='cmd_insert_command' || cmd==='cmd_insert_comment' || originalController.supportsCommand.call(originalController, cmd);
            },

            isCommandEnabled: function isCommandEnabled(cmd ) {
                return cmd==='cmd_insert_command' || cmd==='cmd_insert_comment' || originalController.isCommandEnabled.call(originalController, cmd);
            },
            
            doCommand: function doCommand(cmd ) {
                if( cmd==='cmd_insert_command' || cmd==='cmd_insert_comment' ) {
                    var indentationLength= self.insertCommandBase( cmd==='cmd_insert_comment' );
                    self.tree.startEditing( self.tree.currentIndex, self.tree.columns[0] );
                    if( indentationLength ) {
                        window.setTimeout( TreeView.putCaretAfterLeadingSpaces, 0 );
                    }
                }
                else {
                    originalController.doCommand.call(originalController, cmd);
                }
            },
            onEvent: originalController.onEvent
        };        
        controllers.appendController( newController );
    };
    
    var indentedText= /^(\s+)(.*)/;
    // 1. Keep indentation: put the caret right of any leading spaces
    // 2. make replacing the command easy: highlight the whole command or comment (excluding any leading spaces)
    TreeView.putCaretAfterLeadingSpaces= function putCaretAfterLeadingSpaces() {
        var tree= document.getElementById('commands');
        var match= indentedText.exec( tree.inputField.value );
        var selectionStart= match
            ? match[1].length
            : 0;
        tree.inputField.setSelectionRange( selectionStart, tree.inputField.value.length );
    };
    
    /** 1. When editing-in place Command's Target (but not for comments), on hitting TAB make it shift focus to Value. Also, in reverse: when editing Value, on hitting Shift+TAB shift focus to Target.
     *  2. When user selected a command, i.e. it's highlighted (but it's not being edited it in-place), then on hitting Enter key start editing it.
 * */
    // This function is set up and/or extended by both Clipboard and Indent, and Hands-on GUI. See also another override of this at hands-on-gui/src/chrome/content/extensions/ide-extension.js
    var originalSeLiteTreeOnKeyPress= TreeView.seLiteTreeOnKeyPress;
    TreeView.seLiteTreeOnKeyPress= function seLiteTreeOnKeyPress( event ) {
        if( originalSeLiteTreeOnKeyPress ) {
            originalSeLiteTreeOnKeyPress.call( null, event );
        }
        
        if( event.keyCode===KeyEvent.DOM_VK_TAB ) {
            var tree= event.currentTarget;
            
            if( tree.getAttribute('editing')==='true' || TreeView.lastEditingRow!==undefined ) { // For sequence D) and E) above
                var editingColumn= tree.getAttribute('editing')==='true'
                    ? tree.editingColumn
                    : TreeView.lastEditingColumn;
                var editingRow= tree.getAttribute('editing')==='true'
                    ? tree.editingRow
                    : TreeView.lastEditingRow;
                // Get index of tree.editingColumn in tree.columns[]. We can't use tree.columns.indexOf() since tree.columns is not a real array.
                for( var editingColumnIndex=0; editingColumnIndex<3; editingColumnIndex++ ) {
                    if( tree.columns[editingColumnIndex]===editingColumn ) {
                        break;
                    }
                }
                editingColumnIndex<3 || SeLiteMisc.fail( 'editingColumnIndex should be less than 3, but it is: ' +editingColumnIndex );
                // Whether we're re-focusing on the next or previous column in the same row (this only applies to Commands, not to Comments)
                if( editor.treeView.currentCommand.type==='command'
                    && ( !event.shiftKey && editingColumnIndex<2
                       || event.shiftKey && editingColumnIndex>0
                       )
                ) {
                    event.preventDefault();
                    var otherColumn= tree.columns[ editingColumnIndex+
                        (!event.shiftKey
                         ? +1
                         : -1
                        )
                    ];
                    tree.stopEditing(/*shouldAccept:*/true );
                    tree.inputField.setAttribute( 'type',
                        editor.treeView.currentCommand.type==='command' && otherColumn===tree.columns[0]
                        ? "autocomplete"
                        : '' // Clear it, in case it was previously set to "autocomplete" previously
                    );
                    tree.startEditing( editingRow, otherColumn );
                    if( otherColumn===tree.columns[0] ) {
                        window.setTimeout( TreeView.putCaretAfterLeadingSpaces, 0 );
                    }
                }
                else // We're re-focusing to a different row: the previous or next row, if any; otherwise keep default behavious of handling TAB
                if( !event.shiftKey && tree.currentIndex+1<window.editor.treeView.testCase.commands.length
                  || event.shiftKey && tree.currentIndex>0
                ) {
                    event.preventDefault();
                    var otherRow= editingRow+
                        (!event.shiftKey
                         ? +1
                         : -1
                        );
                    var otherColumn= tree.columns[
                        event.shiftKey && window.editor.treeView.getCommand( otherRow ).type==='command'
                        ? 2
                        : 0
                    ];
                    tree.stopEditing(/*shouldAccept:*/true );
                    tree.view.selection.select( otherRow ); //This invokes tree's 'select' handler, so then IDE updates the detailed edit area of the command.
                    tree.inputField.setAttribute( 'type',
                        window.editor.treeView.getCommand( otherRow ).type==='command' && otherColumn===tree.columns[0]
                        ? "autocomplete"
                        : '' // Clear it, in case it was previously set to "autocomplete" previously
                    );
                    tree.startEditing( otherRow, otherColumn );
                    if( otherColumn===tree.columns[0] ) {
                        window.setTimeout( TreeView.putCaretAfterLeadingSpaces, 0 );
                    }
                }
            }
        }
        else
        if( event.keyCode===KeyEvent.DOM_VK_RETURN ) {
            var tree= event.currentTarget;
            
            if( tree.getAttribute('editing')!=='true' && tree.currentIndex>=0 ) {
                var commandOrComment= window.editor.treeView.getCommand( tree.currentIndex );
                tree.inputField.setAttribute( 'type',
                    commandOrComment.type==='command'
                    ? 'autocomplete'
                    : ''
                );
                tree.startEditing( tree.currentIndex, tree.columns.getColumnAt(0) );
                window.setTimeout( TreeView.putCaretAfterLeadingSpaces, 0 );
            }
        }
        TreeView.lastEditingRow= TreeView.lastEditingColumn= undefined;
    };
} ) ();