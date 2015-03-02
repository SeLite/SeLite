/*  Copyright 2013 Peter Kehl
    See ../web/index.html
*/
// Do not load this file through Selenium IDE menu Options > Options... > General > Selenium core extensions, since that may get loaded before SeLite add-ons (which use ExtensionSequencer). Load this file through BootstrapLoader. @TODO Document this in Wiki.
//"not using strict";
/* Do not have "use strict"; if you want to set any new global variables/functions that you want to be visible from Selenese.
 * Any such functions define using: XXX= function(params...) { ... };
 * instead of: function XXX(params...) { ... };
 * because the second form will have no global effect.
*/
Components.utils.import('chrome://selite-db-objects/content/Db.js');
Selenium.prototype.doHello= function doHello(one, two) { LOG.error( typeof one); }//.LOG.warn('hello');};
Selenium.prototype.getBufo= function getBufo(one) {
    debugger;
    //The following works when one is an object
    return 'getBufo: Parameter one is a ' +(typeof one);
};

Selenium.prototype.doBye= function doBye(one, two) { LOG.error('bye!'); alert( this); }//.LOG.warn('hello');};

var hello= 'hi';
var bofo= 'hu'; 
/*
var charities= new SeLiteData.Table( {
    db: null,//@TODO
    name: 'charities',
    columns: ['id', 'name', 'course', 'lastAmount', 'totalAmount', 'enabled']
});

var charitiesAll= charities.formula();

var charitiesById= new SeLiteData.RecordSetFormula( {
    fetchMatching: {
        'name': ':id'
    },
    parameterNames: ['id']
    //,debugQuery: true
}, charitiesAll );
*/