/* Used via SeLite Settings */
var appDb= new SeLiteSettings.Field.SQLite('appDb');
var testDb= new SeLiteSettings.Field.SQLite('testDb');
var appWebroot= new SeLiteSettings.Field.String('appWebroot', false, '');
var maxNumberOfRuns= new SeLiteSettings.Field.Int('maxNumberOfRuns', false, 20);

var module= new SeLiteSettings.Module( 'extensions.selite-db-objects.basic',
    [appDb, testDb, appWebroot, maxNumberOfRuns],
    true,
    'default',
    true,
    '~/selite/settings/test_settings_module.js'
);

module= SeLiteSettings.register( module );
