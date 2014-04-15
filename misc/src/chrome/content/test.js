/*  Copyright 2014 Peter Kehl
    This file is part of SeLite Misc.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

var console= Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
Components.utils.import( 'chrome://selite-misc/content/SeLiteMisc.js' );

var records= [
    {name: 'Elaine', breed: 'husky', age:2},
    {name: 'Roxy', breed: 'husky', age:2},
    {name: 'Doory', breed: 'collee', age:1},
    {name: 'Doory', breed: 'collee', age:3},
    {name: 'Panda', breed: 'collee', age:16},
    {name: 'Joe', breed: 'german shepherd', age:1},
    {name: 'Joe', breed: 'husky', age: 3}
];
var fieldNames= ['name', 'breed', 'age'];
var indexed= SeLiteMisc.collectByColumn( records, fieldNames, true );
Object.keys(indexed).length===records.length || SeLiteMisc.fail( 'by name, breed and age - bad number of entries' );
for( var i=0; i<records.length; i++ ) {
    indexed[ SeLiteMisc.compoundIndexValue(records[i], fieldNames) ]===records[i] || SeLiteMisc.fail( 'bad' );
}

var fieldNames= ['name', 'breed'];
var indexed= SeLiteMisc.collectByColumn( records, fieldNames, false );
console.warn( SeLiteMisc.objectToString(indexed, 3) );
Object.keys(indexed).length===6 || SeLiteMisc.fail( 'by name, breed - bad number of entries.');
recordsLoop: for( var i=0; i<records.length; i++ ) {
    var items= indexed[ SeLiteMisc.compoundIndexValue(records[i], fieldNames) ];
    for( var j=0; j<items.length; j++ ) {//@TODO for(..of..)
        if( items[j]===records[i] ) {
            continue recordsLoop;
        }
    }
    SeLiteMisc.fail( 'by name, breed - the result doesnt contain original entry at 0-based index ' +i );
}
