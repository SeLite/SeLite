/*
 *   Copyright 2015 Peter Kehl
* This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.*/
"use strict";

(function() {
    phpMyFAQ.uiMap= new UIMap();
    
    phpMyFAQ.uiMap.addPageset({
        name: 'allPages',
        description: 'all phpMyFAQ pages',
        pathRegexp: '.*'
    });
    phpMyFAQ.uiMap.addElement('allPages', {
       name: 'userOwnMenu' ,
       description: "<ul> containing a dropdown menu and a span with name of the currently logged user. Not visible if the user's menu is collapsed. Not clickable.",
       locator: "//a[ @class='dropdown-toggle' ]/../self::li/ul[ @class='dropdown-menu' ]"
    });
    phpMyFAQ.uiMap.addElement('allPages', {
       name: 'userOwnMenuToggle' ,
       description: '<a> that toggles user own dropdown menu to expand/collapse',
       locator: Object.keys(phpMyFAQ.uiMap.pagesets.allPages.uiElements.userOwnMenu.defaultLocators)[0]+ '/../self::li/a[ @class="dropdown-toggle" ]'
    });
    var userOwnMenuItems= {
        // Non-admin pages only:
            // Shown whether logged on or not:
            'Advanced search': '?action=search',
            'All categories': '?action=show',
            'Add new FAQ': '?action=add',
            'Add question': '?action=ask',
            'Open questions': '?action=open',
            // Only shown when not logged on:
            'Sign up': '?action=register',
            'Login': '?action=login',
            // Only shown when logged on, and if applicable:
            'User Control Panel': '?action=ucp',
            'Administration': '/admin/index.php',
        // Admin pages only:
            'Change Password': 'index.php?action=passwd',
        // Both non-admin and admin pages:
            'Logout': '?action=logout' // This covers both 'Logout' on admin pages: 'index.php?action=logout' and on non-admin pages: '?action=logout'.
    };
    phpMyFAQ.uiMap.addElement('allPages', {
       name: 'userOwnMenuItem' ,
       description: "<a> for the user's own menu item. Most are for non-admin pages only.",
       args: [
            {name: 'item',
             description: 'Item label/text',
             defaultValues: Object.keys(userOwnMenuItems)
            }
       ],
       getLocator: function getLocator(args) {
           // Use contains(@href, '...') rather than @href='...', so that it covers both 'Logout' URLs (see above).
           return Object.keys(phpMyFAQ.uiMap.pagesets.allPages.uiElements.userOwnMenu.defaultLocators)[0]+ '/li/a[ contains(@href, "' +userOwnMenuItems[args.item]+ '") ]';
       }
    });
    phpMyFAQ.uiMap.addElement('allPages', {
       name: 'userOwnMenuLoggedInName' ,
       description: "<span> in user's own menu that contains the current user's name",
       args: [
            {name: 'displayName',
             description: "User's display name. Matched as a substring of the content of <span>. Optional - if not set, then this matches any user's name.",
             defaultValues: ['']
            }
       ],
       getLocator: function getLocator(args) {
           return Object.keys(phpMyFAQ.uiMap.pagesets.allPages.uiElements.userOwnMenu.defaultLocators)[0]+ '/preceding::a/span'+ (
               args.displayName!==undefined && args.displayName!==''
               ? '[ contains(., ' +(''+args.displayName).quoteForXPath()+ ') ]'
               : ''
           );
       }
    } );
    phpMyFAQ.uiMap.addElement('allPages', {
        name: 'bootstrapMenuToggle',
        description: '<button> for the Bootstrap menu toggle button. Visible in mobile mode only.',
        locator: "//button[ @class='navbar-toggle' ]"
    } );
    
    // --------
    phpMyFAQ.uiMap.addPageset({
        name: 'nonAdminPages',
        description: 'Non-admin phpMyFAQ pages',
        pathRegexp: '(?!admin/).*'
    });
    phpMyFAQ.uiMap.addElement('nonAdminPages', {
        name: 'bootstrapMenu',
        description: '<div> for the Bootstrap menu. Only use through phpMyFAQ.bootstrapMenuLocator() to detect whether the menu is expanded; do not use to access menu items etc.',
        locator: "//div[ @id='pmf-navbar-collapse' ]"
    } );
    
    phpMyFAQ.uiMap.addPageset({
        name: 'adminPages',
        description: 'Admin pages of  phpMyFAQ',
        pathRegexp: 'admin/'
    });
    
    /** object {
     *    string sectionName: object {
     *        topLevel: string URL,
     *        secondLevel: object {
     *          string itemName: string URL,
     *          ...
     *        }
     *    },
     *    ...
     * }
     * */
    var adminNavigation= {
        Dashboard: {
            topLevel: 'index.php',
            secondLevel: {}
        },
        Users: {
            topLevel: 'index.php?action=user',
            secondLevel: {
                'Users': '?action=user',
                'Change Password': '?action=passwd'
            }
        },
        Content: {
            topLevel: 'index.php?action=content',
            secondLevel: {
                'FAQ Categories': '?action=category',
                'Add new FAQ': '?action=editentry',
                'Edit existing FAQs': '?action=view',
                'Search for FAQs': '?action=searchfaqs',
                'Comments': '?action=comments',
                'Open questions': '?action=question',
                'FAQ Glossary': '?action=glossary',
                'FAQ News': '?action=news',
                'FAQ Attachments': '?action=attachments',
                'Tags': '?action=tags'
            }
        },
        Statistics: {
            topLevel: 'index.php?action=statistics',
            secondLevel: {
                'Rating Statistics': '?action=statistics',
                'View Sessions': '?action=viewsessions',
                'View Adminlog': '?action=adminlog',
                'Search Statistics': '?action=searchstats',
                'Reports': '?action=reports'
            }
        },
        Exports: {
            topLevel: 'index.php?action=export',
            secondLevel: {}
        },
        Backup: {
            topLevel: 'index.php?action=backup',
            secondLevel: {}
        },
        Configuration: {
            topLevel: 'index.php?action=config',
            secondLevel: {
                'Edit configuration': '?action=config',
                'System Information': '?action=system',
                'FAQ Multi-sites': '?action=instances',
                'Stop Words': '?action=stopwordsconfig',
                'Interface Translation': '?action=translist'
            }
        }
    };
    /** Assumptions:
     *  - top level items have URLs starting with 'index.php'
     *  - second level items have URLs starting with '?action='
     *  */
    phpMyFAQ.uiMap.addElement('adminPages', {
        name: 'topNavigation',
        description: 'Link to top level navigation entry.',
        getLocator: function(args) {
            // I could set a 'local variable', as per chrome://selenium-ide/content/selenium-core/scripts/ui-doc.html > UI-Element Shorthand > _*, but it could make this less clear.
            return '//ul[ @id="side-menu" ]/li/a[ @href="' +adminNavigation[ args.section ].topLevel+ '" ]';
        },
        args: [
            {
                name: 'section',
                description: 'Name of the section',
                required: true,
                defaultValues: Object.keys( adminNavigation )
            }
        ],
        testcase1: {
            args: { section: 'Users' },
            xhtml:
            '<ul class="nav" id="side-menu">\
                <li class="sidebar-userinfo">\
                    <div class="userpanel">\
                        <small>Logged in as </small><br/>\
                        Pete                    </div>\
                </li>\
                <li class="active">\
                    <a href="index.php">\
                        <i class="fa fa-dashboard fa-fw"></i> Dashboard                    </a>\
                </li>\
                <li>\
                    <a href="index.php?action=user" expected-result="1">\
                        <i class="fa fa-users"></i> Users                        <span class="fa arrow"></span></a>\
                    \
                    <ul class="nav nav-second-level collapse ">\
                        <li><a href="?action=category">FAQ Categories</a></li>\
<li><a href="?action=editentry">Add new FAQ record</a></li>\
<li><a href="?action=view">Edit existing FAQs</a></li>\
<li><a href="?action=question">Open questions</a></li>\
<li><a href="?action=system">System Information</a></li>\
                    </ul>\
                </li>\
                <li>\
                    <a href="index.php?action=content">\
                        <i class="fa fa-edit fa-fw"></i> Content                        <span class="fa arrow"></span></a>\
                    \
                    <ul class="nav nav-second-level collapse ">\
                        <li><a href="?action=category">FAQ Categories</a></li>\
<li><a href="?action=editentry">Add new FAQ record</a></li>\
<li><a href="?action=view">Edit existing FAQs</a></li>\
<li><a href="?action=question">Open questions</a></li>\
<li><a href="?action=system">System Information</a></li>\
                    </ul>\
                </li>\
                <li>\
                    <a href="index.php?action=statistics">\
                        <i class="fa fa-tasks fa-fw"></i> Statistics                        <span class="fa arrow"></span></a>\
                    \
                    <ul class="nav nav-second-level collapse ">\
                        <li><a href="?action=category">FAQ Categories</a></li>\
<li><a href="?action=editentry">Add new FAQ record</a></li>\
<li><a href="?action=view">Edit existing FAQs</a></li>\
<li><a href="?action=question">Open questions</a></li>\
<li><a href="?action=system">System Information</a></li>\
                    </ul>\
                </li>\
                <li>\
                    <a href="index.php?action=export">\
                        <i class="fa fa-book fa-fw"></i> Exports                    </a>\
                </li>\
                <li>\
                    <a href="index.php?action=backup">\
                        <i class="fa fa-download fa-fw"></i> Backup                    </a>\
                    <ul class="nav nav-second-level collapse">\
                        <li><a href="?action=category">FAQ Categories</a></li>\
<li><a href="?action=editentry">Add new FAQ record</a></li>\
<li><a href="?action=view">Edit existing FAQs</a></li>\
<li><a href="?action=question">Open questions</a></li>\
<li><a href="?action=system">System Information</a></li>\
                    </ul>\
                </li>\
                <li>\
                    <a href="index.php?action=config">\
                        <i class="fa fa-wrench fa-fw"></i> Configuration                        <span class="fa arrow"></span></a>\
                    \
                    <ul class="nav nav-second-level collapse ">\
                        <li><a href="?action=category">FAQ Categories</a></li>\
<li><a href="?action=editentry">Add new FAQ record</a></li>\
<li><a href="?action=view">Edit existing FAQs</a></li>\
<li><a href="?action=question">Open questions</a></li>\
<li><a href="?action=system">System Information</a></li>\
                    </ul>\
                </li>\
\
                <li class="sidebar-adminlog">\
                    <div>\
                        <b class="fa fa-info-circle fa-fw"></b> Admin worklog<br/>\
                        <span id="saving_data_indicator"></span>\
                    </div>\
                </li>\
                <li class="sidebar-sessioninfo">\
                    <div>\
                        <b class="fa fa-clock-o fa-fw"></b> Session expires in:\
                        <span id="sessioncounter">00:29:14</span>\
                    </div>\
                </li>\
            </ul>'
        }
    });
    // the following is for development, so that when Bootstrap re-loads this file automatically, it re-runs the test.
    phpMyFAQ.uiMap.pagesets.adminPages.uiElements.topNavigation.test();//@TODO remove once https://code.google.com/p/selenium/issues/detail?id=8429 gets fixed
    
    phpMyFAQ.uiMap.addElement('adminPages', {
        name: 'secondNavigation',
        description: 'Link to second level navigation entry.',
        getLocator: function(args) {
            // Use exact match by @href='...', rather than contains(@href, '...'), because URLs for some parts end up with same substring (e.g. Statistics and Rating Statistics).
            return '//ul[ @id="side-menu" ]/li/a[ @href="' +adminNavigation[ args.section ].topLevel+ '" ]/following-sibling::ul/li/a[ @href="' +adminNavigation[ args.section ].secondLevel[ args.item ]+ '" ]';
        },
        args: [
            {
                name: 'section',
                description: 'Name of the section',
                required: true,
                defaultValues: Object.keys( adminNavigation )
            },
            {
                name: 'item',
                description: 'Name of the second level item',
                required: true,
                defaultValues: SeLiteMisc.collectFromDepth( SeLiteMisc.collectByColumnFromDeep(adminNavigation, ['secondLevel'], 1), 1, undefined, true )
            }
        ],
        testcase1: {
            args: { section: 'Users', item:'Change Password' },
            xhtml: '<ul class="nav" id="side-menu">\
                <li class="sidebar-userinfo">\
                    <div class="userpanel">\
                        <small>Logged in as </small><br/>\
                        Pete                    </div>\
                </li>\
                <li>\
                    <a href="index.php">\
                        <i class="fa fa-dashboard fa-fw"></i> Dashboard                    </a>\
                </li>\
                <li class="active">\
                    <a href="index.php?action=user">\
                        <i class="fa fa-users"></i> Users                        <span class="fa arrow"></span></a>\
                    \
                    <ul class="nav nav-second-level collapse in">\
                        <li class="active"><a href="?action=user">Users</a></li>\
<li><a href="?action=passwd" expected-result="1">Change Password</a></li>\
                    </ul>\
                </li>\
                <li>\
                    <a href="index.php?action=content">\
                        <i class="fa fa-edit fa-fw"></i> Content                        <span class="fa arrow"></span></a>\
                    \
                    <ul class="nav nav-second-level collapse ">\
                        <li class="active"><a href="?action=user">Users</a></li>\
<li><a href="?action=passwd">Change Password</a></li>\
                    </ul>\
                </li>\
                <li>\
                    <a href="index.php?action=statistics">\
                        <i class="fa fa-tasks fa-fw"></i> Statistics                        <span class="fa arrow"></span></a>\
                    \
                    <ul class="nav nav-second-level collapse ">\
                        <li class="active"><a href="?action=user">Users</a></li>\
<li><a href="?action=passwd">Change Password</a></li>\
                    </ul>\
                </li>\
                <li>\
                    <a href="index.php?action=export">\
                        <i class="fa fa-book fa-fw"></i> Exports                    </a>\
                </li>\
                <li>\
                    <a href="index.php?action=backup">\
                        <i class="fa fa-download fa-fw"></i> Backup                    </a>\
                    <ul class="nav nav-second-level collapse">\
                        <li class="active"><a href="?action=user">Users</a></li>\
<li><a href="?action=passwd">Change Password</a></li>\
                    </ul>\
                </li>\
1                <li>\
                    <a href="index.php?action=config">\
                        <i class="fa fa-wrench fa-fw"></i> Configuration                        <span class="fa arrow"></span></a>\
                    \
                    <ul class="nav nav-second-level collapse ">\
                        <li class="active"><a href="?action=user">Users</a></li>\
<li><a href="?action=passwd">Change Password</a></li>\
                    </ul>\
                </li>\
\
                <li class="sidebar-adminlog">\
                    <div>\
                        <b class="fa fa-info-circle fa-fw"></b> Admin worklog<br/>\
                        <span id="saving_data_indicator"></span>\
                    </div>\
                </li>\
                <li class="sidebar-sessioninfo">\
                    <div>\
                        <b class="fa fa-clock-o fa-fw"></b> Session expires in:\
                        <span id="sessioncounter">00:29:41</span>\
                    </div>\
                </li>\
            </ul>'
        }
    });
    phpMyFAQ.uiMap.pagesets.adminPages.uiElements.secondNavigation.test();//@TODO remove once https://code.google.com/p/selenium/issues/detail?id=8429 gets fixed
    phpMyFAQ.uiMap.addElement('adminPages', {
        name: 'bootstrapMenu',
        description: '<span> for the Bootstrap menu. Only use through phpMyFAQ.bootstrapMenuLocator() to detect whether the menu is expanded; do not use to access menu items etc.',
        locator: "//ul[ @id='side-menu' ]"
    } );
    
    /** @return {string} Locator of bootstrapMenuLocator, depending on current URL. It works for both admin and non-admin pages. Only use it to detect whether the bootstrap menu is expanded; do not use to access menu items etc.
     * */
    phpMyFAQ.bootstrapMenuLocator= function bootstrapMenuLocator() {
        return SeLiteSettings.appPath().startsWith( '/admin/' )
            ? 'ui=adminPages::bootstrapMenu()'
            : 'ui=nonAdminPages::bootstrapMenu()';
    };

})();