/*  Copyright 2013 Peter Kehl
    See ../../license.html
*/
//"not using strict";
/* Do not have "use strict"; if you want to set any new global variables/functions that you want to be visible from Selenese.
 * Any such functions define using: XXX= function(params...) { ... };
 * instead of: function XXX(params...) { ... };
 * because the second form will have no global effect.
*/
//cuckoo3=function() { return 'Selenium:' +typeof Selenium; }
cuckoo6= function () { return 'doHello:' +Selenium.prototype.doHello; }; 
cuckoo7= function () { return 'doHello:' +Selenium.prototype.doHello; };

//alert( Selenium );
Selenium.prototype.doHello= function(one, two) { alert( this); }//.LOG.warn('hello');};
Selenium.prototype.getBufo= function(one, two) { return null;}; 

Selenium.prototype.doBye= function(one, two) { LOG.error('bye!'); alert( this); }//.LOG.warn('hello');};

var hello= 'hi';
var bofo= 'hu'; 

var charities= new SeLiteData.Table( {
    db: null,//@TODO
    name: 'charities',
    columns: ['id', 'name', 'course', 'lastAmount', 'totalAmount', 'enabled']
});

var charitiesAll= new SeLiteData.RecordSetFormula( {
    table: charities,
    columns: new SeLiteData.Settable().
        set( charities.name, DbRecordSetFormula.ALL_FIELDS )
} );

var charitiesById= new SeLiteData.RecordSetFormula( {
    fetchMatching: {
        'name': ':id'
    },
    parameterNames: ['id']
    //,debugQuery: true
}, charitiesAll );
