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

import java.io.FileWriter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Instances of subclasses must work well even if the output is
 *  processed through them again (as new input) one or several times.
 */
public abstract class FilterReplacePreserveLiterals extends FilterReplace {
    /** @overrides FilterReplace.pattern(App,Run)
     */
    protected final Pattern pattern( App app, Run run ) {
        return Pattern.compile(
            jobPattern(app, run) +
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
    }
    
    /** @return Regular expression pattern, which
     * - will be used with | (pattern to preserve string literals)
     * - works with Pattern.COMMENTS (i.e. whitespaces in it are ignored, except for within [], use "\\s" etc. to match whitespaces.
     */
    protected abstract String jobPattern( App app, Run run );
    
    /** @return Replacement pattern that has back-references to groups captured by pattern returned from pattern(), e.g. "$1".
     *  It must also include the last capturing group, added by FilterReplacePreserveLiterals.pattern() itself. E.g.
     *  if jobPattern() generates regex with 3 capturing groups, then replacement(Matcher) must end with "$4" so that string literals
     *  are preserved. Anything before that last $xx should be as per FilterReplace#replacement(Matcher).
     */
    protected abstract String replacement(Matcher matcher, Run run);
}
