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
        
        // For indentation - https://code.google.com/p/selenium/issues/detail?id=6903:
        
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
        var newCommandOrCommentIndentation= function newCommandOrCommentIndentation( testCase, currentIndex ) {
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
        
        var insertCommandOrComment= function insertCommandOrComment( treeView, insertComment ) {
            if (treeView.tree.currentIndex >= 0) {
                var currentIndex = treeView.tree.currentIndex;
                var indentation= newCommandOrCommentIndentation( treeView.testCase, currentIndex );
                treeView.insertAt( currentIndex,
                    insertComment
                        ? new Comment(indentation)
                        : new Command(indentation)
                );
                treeView.selection.select(currentIndex);
                
                var action=document.getElementById('commandAction');
                action.focus();
                if( indentation ) {
                    action.setSelectionRange( indentation.length, indentation.length );
                }
            }
        };
        
        TreeView.prototype.insertCommand= function insertCommand() {
            insertCommandOrComment( this, false );
        };
        TreeView.prototype.insertComment= function insertComment() {
            insertCommandOrComment( this, true );
        };
        
        /** This handles indentation for commands generated via Firefox context menu (right click on the tested webpage) or in Selenium IDE recording mode.
         *  In some situations (either the very first command in the test case, or after a change of window) the original addCommand() calls itself recursively, so that it adds two or more extra command(s) before the actual given command. However, we want to indent them all.
         *  There's no easy workaround, so I just duplicate the original addCommand(), modified to support indentation and refactored the related part.
         * */
Editor.prototype.addCommand = function (command, target, value, window, insertBeforeLastCommand) {debugger;
  this.log.debug("addCommand: command=" + command + ", target=" + target + ", value=" + value + " window.name=" + window.name);
  if (command != 'open' &&
      command != 'selectWindow' &&
      command != 'selectFrame') {
    if (this.getTestCase().commands.length == 0) {
      var top = this._getTopWindow(window);
      this.log.debug("top=" + top);
      var path = this.getPathAndUpdateBaseURL(top)[0];
      this.addCommand("open", path, '', top);
      this.recordTitle(top);
    }
    if (!this.safeLastWindow.isSameWindow(window)) {
      if (this.safeLastWindow.isSameTopWindow(window)) {
        // frame
        var destPath = this.safeLastWindow.createPath(window);
        var srcPath = this.safeLastWindow.getPath();
        this.log.debug("selectFrame: srcPath.length=" + srcPath.length + ", destPath.length=" + destPath.length);
        var branch = 0;
        var i;
        for (i = 0; ; i++) {
          if (i >= destPath.length || i >= srcPath.length) {
            break;
          }
          if (destPath[i] == srcPath[i]) {
            branch = i;
          }
        }
        this.log.debug("branch=" + branch);
        if (branch == 0 && srcPath.size > 1) {
          // go to root
          this.addCommand('selectFrame', 'relative=top', '', window);
        } else {
          for (i = srcPath.length - 1; i > branch; i--) {
            this.addCommand('selectFrame', 'relative=up', '', window);
          }
        }
        for (i = branch + 1; i < destPath.length; i++) {
          this.addCommand('selectFrame', destPath[i].name, '', window);
        }
      } else {
        // popup
        var windowName = window.name;
        if (windowName == '') {
          this.addCommand('selectWindow', 'null', '', window);
        } else {
          this.addCommand('selectWindow', "name=" + windowName, '', window);
        }
      }
    }
  }
  //resultBox.inputField.scrollTop = resultBox.inputField.scrollHeight - resultBox.inputField.clientHeight;
  this.clearLastCommand();
  this.safeLastWindow.setWindow(window);
  
  if (insertBeforeLastCommand && this.view.getRecordIndex() > 0) {
    var index = this.view.getRecordIndex() - 1;
  }
  else {
    var index= this.view.getRecordIndex();
  }
  var indentation= newCommandOrCommentIndentation( this.getTestCase(), index );
  
  var command = new Command( indentation+command, target, value);
  // bind to the href attribute instead of to window.document.location, which
  // is an object reference
  command.lastURL = window.document.location.href;
  this.getTestCase().commands.splice(index, 0, command);
  this.view.rowInserted(index);

  if( !( insertBeforeLastCommand && this.view.getRecordIndex() > 0 ) ) {
    //this.lastCommandIndex = this.getTestCase().commands.length;
    this.lastCommandIndex = index; //Samit: Revert patch for issue 419 as it disables recording in the middle of a test script
    this.timeoutID = setTimeout("editor.clearLastCommand()", 300);
  }
};
// 'editor' is an instance of either StandaloneEditor or SidebarEditor. Those classes don't refer to Editor.prototype, but they have copies of all functions from Editor.prototype (copied via objectExtend()).
        SidebarEditor.prototype.addCommand= StandaloneEditor.prototype.addCommand= Editor.prototype.addCommand;
// end of addCommand()
        
        // Append 'Indent' and 'Unindent'. It can't be done through XBL (see dev-tech-xul.mozilla.narkive.com/D4u2AkVT/binding-menus-using-xbl-doesn-t-work)
        var treeContextMenu= document.getElementById('treeContextMenu');
        treeContextMenu.appendChild( document.createElement('menuseparator') );

        var indent= document.createElement("menuitem");
        indent.setAttribute('label', 'Indent (right)');
        indent.setAttribute('command', 'cmd_indent');
        indent.setAttribute('accesskey', 'R');
        indent.setAttribute('key', 'indent-key');
        treeContextMenu.appendChild(indent);
        
        var unindent= document.createElement("menuitem");
        unindent.setAttribute('label', 'Unindent (left)');
        unindent.setAttribute('command', 'cmd_unindent');
        unindent.setAttribute('accesskey', 'L');
        unindent.setAttribute('key', 'unindent-key');
        treeContextMenu.appendChild(unindent);
   }
    SeLiteExtensionSequencer.coreExtensionsLoadedTimes['SeLiteClipboardAndIndent']= loadedTimes+1;   
})();
