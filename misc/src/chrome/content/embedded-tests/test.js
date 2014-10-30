/*  Copyright 2014 Peter Kehl
    This file is part of SeLite Misc.

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

Object.keys(indexed).length===6 || SeLiteMisc.fail( 'by name, breed - bad number of entries.');
recordsLoop: for( var i=0; i<records.length; i++ ) {
    var items= indexed[ SeLiteMisc.compoundIndexValue(records[i], fieldNames) ];
    for( var j=0; j<items.length; j++ ) {//@TODO low: for(..of..)
        if( items[j]===records[i] ) {
            continue recordsLoop;
        }
    }
    SeLiteMisc.fail( 'by name, breed - the result doesnt contain original entry at 0-based index ' +i );
}
//------

function GrandParent() {}

function Parent() {
  GrandParent.call( this );
}
Parent.prototype= Object.create(GrandParent.prototype);
Parent.prototype.constructor= Parent;

function Child() {
  Parent.call( this );
}
Child.prototype= Object.create(Parent.prototype);
Child.prototype.constructor= Child;

var child= new Child();
SeLiteMisc.ensure( SeLiteMisc.isInstance(child, Child) );
SeLiteMisc.ensure( SeLiteMisc.isInstance(child, 'Child') );
SeLiteMisc.ensure( SeLiteMisc.isInstance(child, Parent) );
SeLiteMisc.ensure( SeLiteMisc.isInstance(child, 'Parent') );
SeLiteMisc.ensure( SeLiteMisc.isInstance(child, GrandParent) );
SeLiteMisc.ensure( SeLiteMisc.isInstance(child, 'GrandParent') );
//--------

var object= {};
SeLiteMisc.objectFillIn( object, ['name', 'job'], ['Joe', 'painter']  /*valuesFromProperObject:false, dontSetMissingOnes: false*/ );
object.name==='Joe' && object.job==='painter' || SeLiteMisc.fail();
object= {};
SeLiteMisc.objectFillIn( object, ['name', 'job', 'pet'], ['Joe', 'painter'], /*aluesFromProperObject*/false, /*dontSetMissingOnes*/true );
object.name==='Joe' && object.job==='painter' && object.pet===undefined || SeLiteMisc.fail();

function objectFillInFromArgumentsWithMissingOnes( name, job, pet ) {
    return SeLiteMisc.objectFillIn( {}, ['name', 'job', 'pet'], arguments, /*valuesFromProperObject*/false /*dontSetMissingOnes: false*/ );
}
objectFillInFromArgumentsWithMissingOnes( 'Joe' ).job===undefined || SeLiteMisc.fail();

function objectFillInFromArgumentsWithoutMissingOnes( name, job, pet ) {
    return SeLiteMisc.objectFillIn( {}, ['name', 'job', 'pet'], arguments, /*valuesFromProperObject*/false, /*dontSetMissingOnes*/true );
}
!('job' in objectFillInFromArgumentsWithoutMissingOnes('Joe') ) || SeLiteMisc.fail();

var objectProxyOnRead= SeLiteMisc.proxyVerifyFieldsOnRead( {
        i: 1
    }
);
objectProxyOnRead.i;
objectProxyOnRead.i= 2;

var wasCaught= false;
try {
    objectProxyOnRead.unsetField; // @TODO This calls SeLiteMisc.fail() which adds a log message, even though I catch the exception below.
}
catch(e) {
    wasCaught= true;
}
wasCaught || SeLiteMisc.fail();

var objectProxy= SeLiteMisc.proxyVerifyFields( {
        i: 1
    },
    ['i']
);
objectProxy.i;
objectProxy.i= 2;

wasCaught= false;
try {
    objectProxy.unsetFieldOne= 3;
}
catch(e) {
    wasCaught= true;
}
wasCaught || SeLiteMisc.fail();

wasCaught= false;
try {
    objectProxy.unsetFieldTwo;
}
catch(e) {
    wasCaught= true;
}
wasCaught || SeLiteMisc.fail();

/** @class */
var FilledIn= function FilledIn( name, job, pet ) {
    SeLiteMisc.objectFillIn( this, ['name', 'job', 'pet'], arguments, /*valuesFromProperObject*/false, /*dontSetMissingOnes is false, so this does set missing ones*/false );
};
FilledIn= SeLiteMisc.proxyVerifyFields( FilledIn, {}, {}, ['name', 'job', 'pet'] );
var filledInInstance= new FilledIn( 'John' );
'job' in filledInInstance && filledInInstance.job===undefined || SeLiteMisc.fail();
filledInInstance.pet= 'cat';

//document.write('h');
//document.innerHTML= 'all fine';
var testSuccessful= true;
document.write( 'oo');