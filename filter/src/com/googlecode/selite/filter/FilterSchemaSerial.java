/*  Copyright 2013 Peter Kehl
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

/** This replaces serial/autoincremented/sequence-based columns of integer family with SQLite autoincrement primary column.
 *  There can be max. one such column per table, otherwise SQLite refuses it. It changes the column type to SQLite integer (64bit),
 *  potentially enlarging its range as to what was in the original schema.
 *  <br/>Before you apply this filter, you must apply FilterComments first. That's because
 *  an SQL comment can contain apostrophe(s). If there was a valid SQL comment with an odd
 *  number of apostrophes, it would break regex used here.
 *  <br/>This must be applied before FilterSchemaCleanup, because FilterSchemaSerial.MysqlStartValue must be applied before
 *  FilterSchemaCleanup.MysqlTableOptions delete the needed parts.
 */
public final class FilterSchemaSerial extends FilterGroup {
    private final static class Shared extends FilterReplace {
        Shared() {}

        private static Pattern pattern;

        public void initialise( App app, Run run ) {
            switch( run.get(Run.DB) ) {
                case POSTGRES:
                    pattern= Pattern.compile(
                    //@TODO Postgres generates views in format CREATE VIEW name AS (SELECT ...) UNION (SELECT ...) ... and those brackets don't work in SQlite
                        // Postgres sequences. It will fail if a table uses more than 1 sequence.
                        "( (?: smallint|integer|bigint|serial|bigserial) \\s++\n" +
                        "  DEFAULT \\s++ nextval \\s*+ \\( [^)]+ \\) \n"+
                        ") \n"+
                        "| \n" +
                        "( #preserve SQL string constants:\n" +
                        "  ' \n" +
                        "    (?> \n" +
                        "        [^'] \n" +
                        "      | \n" +
                        "        '' \n" +
                        "    )*+ \n" +
                        "  (?> ' | \\z ) # The last quote is optional at the end of the file - then SQL is incorrect. \n" +
                        ")",
                        Pattern.COMMENTS );
                    break;
                case MYSQL:
                    pattern= Pattern.compile(
                        // MySQL AUTO_INCREMENT. This filter has to be run *after* FilterSchemaCleanup. Otherwise FilterSchemaCleanup would
                        // remove "PRIMARY KEY" from "INTEGER PRIMARY KEY AUTOINCREMENT" that we generate in FilterSerialReplace.
                        "(  (?: integer|int|smallint|tinyint|mediumint|bigint ) (?: \\( [0-9]++ \\) )?+ \\s++ (?: NOT \\s++ NULL \\s++)?+ AUTO_INCREMENT \n"+
                        ") \n" +
                        "| \n" +
                        "( #preserve SQL string constants:\n" +
                        "  ' \n" +
                        "    (?> \n" +
                        "        [^'] \n" +
                        "      | \n" +
                        "        '' \n" +
                        "    )*+ \n" +
                        "  (?> ' | \\z ) # The last quote is optional at the end of the file - then SQL is incorrect. \n" +
                        ")",
                        Pattern.COMMENTS );
                    break;
                default:
                    throw new Error("TODO");
            }
        }

        public static FilterSchemaSerial instance= new FilterSchemaSerial();

        protected Pattern pattern( App app, Run run ) { return pattern; }

        protected String replacement(Matcher matcher, Run run) {
            return matcher.start(1)>=0
                 ? "INTEGER PRIMARY KEY AUTOINCREMENT"
                 : "$2";
        }
    }
    
    private static final class MysqlStartValue extends FilterReplace {
        // This pattern must be left-anchored by ^ - for processFixedStart()
        private final Pattern pattern= Pattern.compile(
            // For MySQL dumps - matching AUTO_INCREMENT=xxx within "CREATE TABLE xxx (... ) ... AUTO_INCREMENT=xxx ...;"
            "( \n" +
            " CREATE \\s++ TABLE \\s++ `? ([a-zA-Z_0-9]++) `? \\s*+ \n" +
            "    \\( \n"+
            "      (?: \n" +
            "         [^()'] \n"+
            "       |   ' [^']*+ ' \n"+
            "       | \\( (?: [^)'] | ' [^']*+ ')++ \\) \n"+ // Assuming there are no string literals between any () within CREATE TABLE SQL
            "      )++ \n" +
            "    \\) \n" +
            " (?: \n" +
            "      (?! \\s++ AUTO_INCREMENT \\s*+ =) [^;'] \n"+
            "    | '[^']*+' \n"+
            " )*+ \n"+
            " \\s++ AUTO_INCREMENT \\s*+ = \\s*+ ([0-9]++) \n" +
            " (?: \n" +
            "      (?! \\s++ AUTO_INCREMENT \\s*+ =) [^;'] \n"+
            "    | '[^']*+' \n"+
            " )*+ \n"+
            "; \n" +
            ")",
            Pattern.COMMENTS
        );
        
        protected Pattern pattern(App app, Run run) { return pattern; }
        
        protected String replacement(Matcher matcher, Run run) {
            if( matcher.start(3)>0 ) {
                assert matcher.start(2)>0 : "No table name matched!";
                run.sequenceManager().stream(CharSequenceManager.StreamSequence.SEQUENCE).
                    append( "UPDATE sqlite_sequence SET seq=" ).append( matcher.group(3) ).
                    append( "-1 WHERE name='" ).append( matcher.group(2) ).append( "';" );
            }
            return "$1"; // @TODO Consider changing FilterReplace to allow scanning-only implementations (i.e. process(App,Run,int) would always return null)
        }
    }
    
    private static final Shared shared= new Shared();
    private static final MysqlStartValue mysqlStartValue= new MysqlStartValue();
    
    private FilterSchemaSerial() {
            super(
                new Db[] {
                    Db.POSTGRES,
                    Db.MYSQL
                },
                new Filter[][] {
                    {shared},
                    {shared, mysqlStartValue}
                }
            );
    }
    
    static FilterSchemaSerial instance= new FilterSchemaSerial();
}