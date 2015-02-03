/* Copyright 2015 Peter Kehl
    This file is part of SeLite Clipboard And Indent.
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

(function() { // Anonymous function to make the variables local
    Components.utils.import( "chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js" );
    var loadedTimes= SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteClipboardAndIndent'] || 0;
    if( !loadedTimes ) {
        // Ideally, I would change behaviour of isCommandEnabled() so that it allows cmd_paste even if self.clipboard==null. However, isCommandEnabled() is out of easy reach outside of original constructor of TreeView (and I don't want to replace the whole TreeView constructor just for that). Therefore, I
        // - leave original isCommandEnabled untouched
        // - change initialize() to set this.clipboard to non-null
        // - replace paste() to work regardless of this.clipboard.
        var originalTreeViewInitialize= TreeView.prototype.initialize;
        TreeView.prototype.initialize= function initialize( editor, document, tree ) {
            originalTreeViewInitialize.call( this, editor, document, tree );
            this.clipboard= [];
        };
    /*}
    else {*/
        TreeView.prototype.getCommandsFromClipboard= function getCommandsFromClipboard() {
            var formatter= this.editor.app.getClipboardFormat().getFormatter();
            if( formatter.parseCommandsAndHeader ) {
                var trans = this._createTransferable();
                //var str = this._createClipboardString();
                trans.addDataFlavor("text/unicode");
                //var text = this.editor.app.getClipboardFormat().getSourceForCommands(commands); // That returns format's getFormatter().formatCommands(commands)
                //str.data = text;
                //trans.setTransferData("text/unicode", str, text.length * 2);
                var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"].
                    getService(Components.interfaces.nsIClipboard);
                clipboard.getData(trans, Components.interfaces.nsIClipboard.kGlobalClipboard);
                var str= {};
                var strLength= {};
                trans.getTransferData( "text/unicode", str, strLength );
                if( str ) {
                    var text= str.value.QueryInterface( Components.interfaces.nsISupportsString ).data;
                    var commands= formatter.parseCommandsAndHeader( text ).commands;
                    if( commands.length ) {
                        return commands;
                    }
                }
            }
            // not reading from a real clipboard...
            return this.clipboard;
        };

        TreeView.prototype.paste= function paste() {
            if (!this.treebox.focused) return;
            var commands = this.getCommandsFromClipboard();
            if (commands) {
                var currentIndex = this.tree.currentIndex;
                if (this.selection.getRangeCount() == 0) {
                    currentIndex = this.rowCount;
                }
                this.executeAction(new TreeView.PasteCommandAction(this, currentIndex, commands));
            }
        };
    }
    SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteClipboardAndIndent']= loadedTimes+1;
})();