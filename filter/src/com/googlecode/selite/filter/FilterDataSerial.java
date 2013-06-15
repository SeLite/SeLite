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

import java.util.regex.Pattern;
import java.util.regex.Matcher;

/** Before you apply this filter, you must apply FilterComments first. That's because
 *  an SQL comment can contain apostrophe(s). If there was a valid SQL comment with an odd
 *  number of apostrophes, it would break regex used here.
 */
public final class FilterDataSerial extends FilterReplace {
    private FilterDataSerial() {}
    
    /** I don't use Pattern.MULTILINE, because I only register a match starting exactly at my given index,
     *  not any further in the input.
     *  @TODO Doc: This assumes that Postgres sequence names are in the auto-generated format 'table-name_column-name_seq'
     *  and that the primary key column name doesn't contain an underscore _.
     * @TODO MySQL way (if using a dump which contains data only, not the schema - i.e. ALTER TABLE xxx AUTO_INCREMENT = 123;
     */
    private final Pattern pattern= Pattern.compile(
        "   SELECT \\s++ pg_catalog\\.setval\\( '([a-zA-Z0-9_]+) _ [a-zA-Z0-9]+ _seq' \\s*+,\\s*+ ([0-9]++) \\s*+ (?: ,\\s*+ (true|false) )? \\); \n"+
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
    
    protected String replacement(Matcher matcher, Run run) {
        if( matcher.start(1)>0 ) {
            run.sequenceManager().stream(CharSequenceManager.StreamSequence.SEQUENCE).
                append( "UPDATE sqlite_sequence SET seq=" ).append( matcher.group(2) ).
                append( matcher.start(3)>0 && matcher.group(3).equals("false")
                    ? "-1"
                    : ""
                ).append( " WHERE name='" ).append( matcher.group(1) ).append( "';" );
        }
        return "$4";
    }
    
    public static FilterDataSerial instance= new FilterDataSerial();
}