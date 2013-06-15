/*  Copyright 2012, 2013 Peter Kehl
    This file is part of SeLite Filter.

    SeLite Filter is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SeLite Filter is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SeLite Filter.  If not, see <http://www.gnu.org/licenses/>.
*/
package com.googlecode.selite.filter;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Map;
import java.util.HashMap;

/** Before you apply this filter, you must apply FilterComments first. That's because
 *  an SQL comment can contain apostrophe(s). If there was a valid SQL comment with an odd
 *  number of apostrophes, it would break regex used here.
 */
public final class FilterSchemaCleanup extends FilterGroup {
    private static final class Postgres extends FilterReplacePreserveLiterals {
        protected String jobPattern( App app, Run run ) {
            return
            //@TODO Postgres: change 'ALTER TABLE ONLY .. ADD CONSTRAINT .. PRIMARY KEY(..)' to generate 'PRIMARY KEY' at the end of the type for that column in CREATE TABLE.
            //@TODO Postgres generates views in format CREATE VIEW name AS (SELECT ...) UNION (SELECT ...) ... and those brackets don't work in SQlite
            "  (?: SET \\s++ | COMMENT \\s++ ON | ALTER \\s++ | CREATE \\s++ SEQUENCE \\s++ | CREATE \\s++ VIEW \\s++ | REVOKE | GRANT ) [^;]++ ; \n"+
            "| (?: ::(?:character \\s++ varying|text|bigint|smallint|integer|numeric|\"unknown\"|double \\s+ precision|date) )" +
            "| USING \\s++ btree\n";
        }
        protected String replacement(Matcher matcher, Run run) {
            return "$1";
        }
    }
    
    private static final class MysqlTableOptions extends FilterRemover {
        protected FixedStartResult processFixedStart( CharSequence input, int i, int pastMatcheable ) {
            Matcher matcher= pattern.matcher(input);
            matcher.region( i, input.length() );
            if( matcher.find() ) {
                if( matcher.end()<=pastMatcheable ) {
                    return new FixedStartResult( matcher.start(1), matcher.end(1),  matcher.end() );
                }
            }
            return null;
        }
        // This pattern must be left-anchored by ^ - for processFixedStart()
        private final Pattern pattern= Pattern.compile(
            // For MySQL dumps - removing anything between "CREATE TABLE xxx (... )" and the trailing semicolon ";"
            " ^  CREATE \\s++ TABLE [^(]++ \n" +
            "    \\( \n"+
            "      (?: \n" +
            "         [^()'] \n"+
            "       |   ' [^']*+ ' \n"+
            "       | \\( (?: [^)'] | ' [^']*+ ')++ \\) \n"+ // Assuming there are no string literals between any () within CREATE TABLE SQL
            "      )++ \n" +
            "    \\)" +
            " ( (?: [^;'] | '[^']*+' )++ ) ; ",
            Pattern.COMMENTS
        );
    }
    
    private static final class MysqlMain extends FilterReplacePreserveLiterals {
        protected String jobPattern( App app, Run run ) {
            return
            "  (?:             COMMENT \\s++ ON | ALTER \\s++ | CREATE \\s++ SEQUENCE \\s++ | CREATE \\s++ VIEW \\s++ | REVOKE | GRANT ) [^;]++ ; \n"+
            "| (?: ::(?:character \\s++ varying|text|bigint|smallint|integer|numeric|\"unknown\"|double \\s+ precision|date) )" +
            "| USING \\s++ btree\n"+
            // For MySQL dumps. PRIMARY KEY is after the list of culumns, and it may be the last entry in the table declaration, therefore I remove the comma before it, not after it.
            "| ,?+ \\s++ PRIMARY \\s++ KEY \\s++ \\( [^,)]++ \\) \n"+
            // For MySQL dumps.
            "| ,?+ \\s++ (?: UNIQUE \\s++)? KEY \\s++ [^(]++ \\( [^)]++ \\) \n";
        }
        protected String replacement(Matcher matcher, Run run) {
            return "$1";
        }
    }
    
    public static FilterSchemaCleanup instance= new FilterSchemaCleanup();
    private FilterSchemaCleanup() {
        super(
            new Db[]{
                Db.POSTGRES,
                Db.MYSQL
            },
            new Filter[][]{
                {new Postgres()},
                {new MysqlMain(), new MysqlTableOptions()}
            } );
    }
}