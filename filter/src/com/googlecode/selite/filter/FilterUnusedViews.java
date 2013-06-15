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

/** Before you apply this filter, you must apply FilterComments first. That's because
 *  an SQL comment can contain apostrophe(s). If there was a valid SQL comment with an odd
 *  number of apostrophes, it would break regex used here.
 */
public final class FilterUnusedViews extends FilterReplace {
    private FilterUnusedViews() {}
    
    public static FilterUnusedViews instance= new FilterUnusedViews();
    
    public Pattern pattern( App app, Run run ) {
        return Pattern.compile(
            "(?: \n" +
            "    CREATE\\s+VIEW \n"+
            "   |ALTER\\s+TABLE \n"+
            " )\\s+ \n"+
            app.getAppValue( App.REMOVED_VIEW_NAMES_PATTERN, run)+ "\n"+
            "[^;]* ; \n" +
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
    }
    
    public String replacement(Matcher matcher, Run run) {
        return "$1";
        
    }
}