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
    
    // Only allow edit-in-place for 'target' and 'value'. That allows us to still execute the command by double-clicking at the command name itself
    if( column.value===tree.columns[1] || column.value===tree.columns[2] ) {
       if( true ) {
            tree.startEditing( row.value, column.value ); //tree.columns[1]

            // The above call to startEditing() calls setTimeout(), which puts a callback function in the execution queue. That callback function focuses and selects the tree.inputField. The following puts another code in the queue, which simulates a click at tree.inputField, so that the user can start typing where she clicked. See also chrome://global/content/bindings/tree.xml#tree -> startEditing
            window.setTimeout( function() {
                var range= document.caretPositionFromPoint(event.clientX, event.clientY);
                tree.inputField.setSelectionRange( range.offset, range.offset );
                //treeBoxObject.invalidateScrollbar(); This doesn't help
            }, 0 );
       }       
       
       if( false ) {
           // Based on chrome://global/content/bindings/tree.xml#tree -> startEditing:
            // Beyond this point, we are going to edit the cell.
            if (tree._editingColumn)
              tree.stopEditing();

            var input = tree.inputField;

            treeBoxObject.ensureCellIsVisible(row.value, column.value);// this doesn't caluse the problem

            // Get the coordinates of the text inside the cell.
            var textx = {}, texty = {}, textwidth = {}, textheight = {};
            treeBoxObject.getCoordsForCellItem(row.value, column.value, "text",
                                                  textx, texty, textwidth, textheight);

            // Get the coordinates of the cell itself.
            var cellx = {}, cellwidth = {};
            treeBoxObject.getCoordsForCellItem(row.value, column.value, "cell",
                                              cellx, {}, cellwidth, {});

            // Calculate the top offset of the textbox.
            var style = window.getComputedStyle(input, "");
            var topadj = parseInt(style.borderTopWidth) + parseInt(style.paddingTop);
            input.top = texty.value - topadj;

            // The leftside of the textbox is aligned to the left side of the text
            // in LTR mode, and left side of the cell in RTL mode.
            var left, widthdiff;
            if (style.direction == "rtl") {
              left = cellx.value;
              widthdiff = cellx.value + cellwidth.value - textx.value - textwidth.value;
            } else {
              left = textx.value;
              widthdiff = textx.value - cellx.value;
            }

            input.left = left;
            input.height = textheight.value + topadj +
                           parseInt(style.borderBottomWidth) +
                           parseInt(style.paddingBottom);
            input.width = cellwidth.value - widthdiff;
            input.hidden = false;

            input.value = tree.view.getCellText(row.value, column.value);
            var selectText = function selectText() {
              input.select(); // this doesn't caluse the problem
              input.inputField.focus(); // this doesn't caluse the problem
            }
            setTimeout(selectText, 0);

            tree._editingRow = row.value;
            tree._editingColumn = column.value;

            tree.setAttribute("editing", "true");
        }
   }
   else {
       //window.editor.treeView.selectCommand();
   }
   //event.preventDefault();
   //event.stopPropagation();
}