/* Copyright 2005 Shinya Kasatani
 * Copyright 2013, 2014 Peter Kehl
 * Based on Selenium code of ide/main/src/content/testCase.js
 *
 * This is needed for SelBlocksGlobal to work until Selenium accepts https://code.google.com/p/selenium/issues/detail?id=5495
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
// Anonymous function keeps 'global' and local variables out of global scope
( function(global) {
// Se IDE loads this file twice, and with a different scope object! See http://code.google.com/p/selenium/issues/detail?id=6697
if( !Favorites.interceptedByRunAllFavorites ) {
    Favorites.interceptedByRunAllFavorites= true;
    
    var runAllFavorites= function runAllFavorites() {
        var testSuitePlayDone= function testSuitePlayDone() {
            //@TODO
            editor.app.removeObserver(testSuitePlayDone);
        };
        editor.app.addObserver( {testSuitePlayDone: testSuitePlayDone} );
    }
}
} )( this );