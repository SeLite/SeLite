"use strict";

XulUtils.TreeViewHelper.prototype.isEditable= TreeView.prototype.isEditable= function isEditable( row, col ) { return true;};

/** There are a few basic scenarios/sequences:
 * 
 *  - No change
 *    1. click at a cell to edit-in-place
 *    2. stop editing (and revert any modifications) by pressing ESC. That doesn't trigger setCellText().
 *    
 *  - Simple sequence: edit, focus out
 *    1. click at a cell to edit-in-place
 *    2. finish editing by pressing Enter, or by moving focus out, but not to another cell. When that triggers setCellText(), editor.treeView.currentCommand is still the command that has just been edited in place. setCellText() calls updateCurrentCommand(), which updates the test case. Then I call selectCommand(), which updates the command details area.
 *    
 *  - Simple sequence: edit, edit another cell of the same command (or comment)
 *    1. click at a cell to edit-in-place
 *    2. finish editing by clicking at another cell of the same command/comment (in the same row). That calls setCellText() before tree's onClick().
 *    
 *  - Complex (like a concurrent race)
 *    1. click at a cell to edit-in-place
 *    2. finish editing by clicking at another cell (regardless of whether it's possible to edit that other cell in-place, or not). That triggers:
 *    2.1 tree's onSelect(), which calls editor.treeView.selectCommand(), so now editor.treeView.currentCommand is the command from the newly selected cell!
 *    2.2 setCellText()
 *    2.3 tree's onClick() in handlers.js
 *    Therefore, in onClick() I save this.tree.currentIndex in this.seLiteTreePreviousIndex, which I then compare to current this.tree.currentIndex in setCellText(). If they are different, that means that onSelect() has already selected the newly clicked command. Then I update the previously edited command in the test case, instead of calling updateCurrentCommand(). Also, I don't update the command details area - I don't call selectCommand() - because it already shows the newly edited command.
 * */
XulUtils.TreeViewHelper.prototype.setCellText= TreeView.prototype.setCellText= function setCellText( row, col, value, original) {
    //original is undefined, so I don't call original.setCellText( row, col, value );
    var tree= document.getElementById('commands');
    var key= col===tree.columns[0] // What field of the command/comment to update
        ? 'command'
        : (col===tree.columns[1]
            ? 'target'
            : 'value'
        );
    var decodedValue= col===tree.columns[0]
        ? value
        : window.editor.treeView.decodeText(value);
        
    if( this.tree.currentIndex===this.seLiteTreePreviousIndex ) { // Handling one of the two simple sequences (see above)
        window.editor.treeView.updateCurrentCommand( key, decodedValue);
        window.editor.treeView.selectCommand();
    }
    else { // Handling the complex sequence
        // See TreeView.UpdateCommandAction.prototype -> execute()
        if( col===tree.columns[0] ) {
            key= 'comment';
        }
        window.editor.treeView.getCommand( this.seLiteTreePreviousIndex )[ key ]= decodedValue;
    }
    return true;
};