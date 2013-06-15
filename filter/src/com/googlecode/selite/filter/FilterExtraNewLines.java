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

/**  Before you apply this filter, you must apply FilterComments first.
 *   See docs of FilterUnusedInserts for explanation.
 */
public final class FilterExtraNewLines extends FilterReplace {
    private FilterExtraNewLines() {}
    
    // Leave up to two consecutive new lines.
    private static final Pattern pattern= Pattern.compile(
        "( (?: \\r?\\n ){2}+ \n"+
        ") \n" +
        "(?: \\r?\\n )++ \n" +
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
        Pattern.COMMENTS
    );
    
    protected Pattern pattern( App app, Run run ) { return pattern; }
    
    protected String replacement(Matcher matcher, Run run) {
        return "$1$2";
    }
    
    public static final FilterExtraNewLines instance= new FilterExtraNewLines();
    
}