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
 * 
 * Based on Selenium code of ide/main/src/content/testCase.js
 *
 * This, and related code in html.js, makes Selenium IDE accept HTML from native clipboard, regardless of its souce (potentially another Selenium IDE instance, or a file), as far as it fits the format.
 * */
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
        
        TreeView.prototype.getCommandsFromClipboard= function getCommandsFromClipboard() {
            var formatter= this.editor.app.getClipboardFormat().getFormatter();
            if( formatter.parseCommandsAndHeader ) {
                var trans = this._createTransferable();
                trans.addDataFlavor("text/unicode");
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