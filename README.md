Work in progress: Migrating to WebExtensions (new API by Mozilla).

Develop this on Linux/Mac OS. Otherwise, if cloning to filesystems that don't support symlinks, beware that add-ons share shared/old_addon_versions.js via a symlink.

[SeLite](http://selite.github.io/) (Selenium+SQLite) automates database-driven navigation of web applications. It
* allows database-driven operation
* serves for functional testing, with test data isolated from the tested application
* serves for non-testing purposes, such as automated administration or data mining.
* improves productivity of Selenium.

SeLite enables
* high reuse by sharing functions across scripts
* enhanced expressive syntax
* test database (isolated from the application data)
* automatic detection of webserver errors/warnings
* custom fine-grain configuration schemas.

SeLite also contains [SelBlocks Global](https://selite.github.io/SelBlocksGlobal). However, SelBlocks Global's code is in a [separate repository](https://github.com/SeLite/SelBlocksGlobal).

See its extensive [documentation](http://selite.github.io/) for benefits and installation.