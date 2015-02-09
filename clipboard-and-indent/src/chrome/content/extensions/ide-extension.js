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
 * Based on Selenium code of ide/main/src/content/treeView.js and ide/main/src/content/testCase.js
 *
 * This, and related code in html.js, makes Selenium IDE accept HTML from native clipboard, regardless of its souce (potentially another Selenium IDE instance, or a file), as far as it fits the format.
 * */
"use strict";

(function() { // Anonymous function to make the variables local
    Components.utils.import( "chrome://selite-extension-sequencer/content/SeLiteExtensionSequencer.js" );
    var loadedTimes= SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteClipboardAndIndent'] || 0;
    if( !loadedTimes ) {
        // For clipboard:
        
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
        
        // For indentation:
        
        /** The body is identical to original getDefinition(), but this adds trimLeft() for indented commands. */
        Command.prototype.getDefinition = function getDefinition() {
                if (this.command == null) return null;
                var commandName = this.command.trimLeft().replace(/AndWait$/, '');
                var api = Command.loadAPI();
                var r = /^(assert|verify|store|waitFor)(.*)$/.exec(commandName);
                if (r) {
                        var suffix = r[2];
                        var prefix = "";
                        if ((r = /^(.*)NotPresent$/.exec(suffix)) != null) {
                                suffix = r[1] + "Present";
                                prefix = "!";
                        } else if ((r = /^Not(.*)$/.exec(suffix)) != null) {
                                suffix = r[1];
                                prefix = "!";
                        }
                        var booleanAccessor = api[prefix + "is" + suffix];
                        if (booleanAccessor) {
                                return booleanAccessor;
                        }
                        var accessor = api[prefix + "get" + suffix];
                        if (accessor) {
                                return accessor;
                        }
                }
                return api[commandName];
        };
        
        var indentedText= /^(\s+)(.*)/;
        // Opening commands, which indent the next new commands/comments to the right:
        var openingCommands= ['if', 'elseIf', 'else', 'while', 'for', 'foreach', 'forXml', 'forJson', 'function', 'try', 'catch', 'finally'];
        var newCommandOrCommentIndentation= function newCommandOrCommentIndentation( currentIndex, testCase ) {
            if( currentIndex>0 ) {
                var previousCommand= testCase.commands[currentIndex-1];
                var previousCommandText= previousCommand.command
                    ? previousCommand.command
                    : previousCommand.comment;
                var match= indentedText.exec( previousCommandText );
                var indentation= '';
                if( match ) {
                    indentation= match[1];
                }
                var commandItself= match
                    ? match[2]
                    : previousCommandText;
                if( previousCommand.command && openingCommands.indexOf(commandItself)>=0 ) {
                    indentation+= '  ';
                }
                return indentation;
            }
            return '';
        };
        
        TreeView.prototype.insertCommand= function insertCommand() {
            if (this.tree.currentIndex >= 0) {
                var currentIndex = this.tree.currentIndex;
                this.insertAt(this.tree.currentIndex, new Command( newCommandOrCommentIndentation(currentIndex, this.testCase) ) );
                this.selection.select(currentIndex);
            }
        };
        TreeView.prototype.insertComment= function insertComment() {
            if (this.tree.currentIndex >= 0) {
                var currentIndex = this.tree.currentIndex;
                this.insertAt(this.tree.currentIndex, new Comment( newCommandOrCommentIndentation(currentIndex, this.testCase) ) );
                this.selection.select(currentIndex);
            }
        };

    }
    SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteClipboardAndIndent']= loadedTimes+1;   
})();
