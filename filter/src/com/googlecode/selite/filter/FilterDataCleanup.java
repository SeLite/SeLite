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

import java.util.regex.Pattern;
import java.util.regex.Matcher;

/** Before you apply this filter, you must apply FilterComments first. That's because
 *  an SQL comment can contain apostrophe(s). If there was a valid SQL comment with an odd
 *  number of apostrophes, it would break regex used here.
 */
public final class FilterDataCleanup extends FilterReplace {
    private FilterDataCleanup() {}
    
    /** I don't use Pattern.MULTILINE, because I only register a match starting exactly at my given index,
     *  not any further in the input.
     *  @TODO Doc: This assumes that Postgres sequence names are in the auto-generated format 'table-name_column-name_seq'
     *  and that the primary key column name doesn't contain an underscore _.
     */
    private static Pattern pattern= Pattern.compile(
        // Postgres: @TODO Apply (?<=\\s|;) to other rules, too. Even make it more robust, so that it doesn't match on column name 'SET'
        // - introduce a match at the beginning of an SQL command (which are separated by ;)
        "(?<=\\s|;)SET [^;]++ ; \n" +
        // MySQL:
        "|\n"+
        "   (?:UN)?LOCK \\s++ [^;]++; \n"+
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
    
    protected Pattern pattern(App app, Run run) { return pattern; }
    
    protected String replacement(Matcher matcher, Run run) {//@TODO Move this to the end of the file
        return "$1";
    }
    
    public static FilterDataCleanup instance= new FilterDataCleanup();
}