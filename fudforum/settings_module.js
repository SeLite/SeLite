"use strict";

var webroot= new SeLiteSettings.Field.String('webRoot', /*multivalued:*/false, 'http://localhost/fudforum/', /*requireAndPopulate:*/true);
//var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', false, 20);

var roles= new SeLiteSettings.Field.FixedMap.String( 'roles', ['admin', 'editor', 'contributor'],
    {admin: 'pkehl', editor: 'johns', contributor: 'lmurphy'},
    /*requireAndPopulate*/true
);

new SeLiteSettings.Module( 'extensions.selite.fudforum',
    [webroot/*, maxNumberOfRuns*/, roles],
    true,
    'default',
    true,
    SELITE_SETTINGS_FILE_URL, // This will be passed by SeLite
    new SeLiteSettings.TestDbKeeper.Columns( {
        users: {
            key: 'login', // This is the logical/matching column, rather then a primary key
            columns: ['login', 'passwd']
        }
    })
);
