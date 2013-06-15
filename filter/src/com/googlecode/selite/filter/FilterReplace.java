/*  Copyright 2012 Peter Kehl
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
public abstract class FilterReplace extends Filter {
    /** It must not depend on end of file (\z). The longest possible match should be not longer than maxMatchLength().
     *  It' not called before #initialise(App,Run).
     */
    protected abstract Pattern pattern( App app, Run run );
    
    /** @return Replacement pattern that has back-references to groups captured by pattern returned from pattern(), e.g. "$1".
     */
    protected abstract String replacement(Matcher matcher, Run run);
    
    private static final int processedGroups[]= new int[] { 0 };
    
    public int process( App app, Run run, int pastMatcheable ) {
        final CharSequence input= run.sequenceManager().input();
        final StringBuffer output= run.sequenceManager().output();
        final Matcher matcher= pattern( app, run ).matcher( input );
        
        // End of last match  by this pattern; exclusive - i.e. index of the first character after the last character of the last match
        int lastMatchEnd= 0;
        boolean matchedAny= false; // Whether there was at least one match in the whole input
        boolean matchedMatcheable= false;
        
        // @TODO?? if( matcher.end()>pastMatcheable) then shorten processedLength up to (exclusive of) matcher.start()
        while( matcher.find() ) {
            matchedAny= true;
            if( matcher.end()<=pastMatcheable ) {
                matchedMatcheable= true;
                //output.append( input, lastMatchEnd, matcher.start() );
                matcher.appendReplacement( output, replacement(matcher, run) );
                lastMatchEnd= matcher.end();
                
                //assert output.length()+matcher.end(1)-matcher.start(1)<=pastMatcheable;// TODO Only valid for filters that have replacement() return "$1"
                //assert output.length()<=pastMatcheable; //@TODO Not valid since FilterDataCleanup processes Postgres sequences
            }
            else {
                break;
            }
        }
        assert !matchedAny || matchedMatcheable || matcher.start()>0 : "Expand non-matcheable buffer and heap.";
        assert lastMatchEnd<=pastMatcheable;
        assert matchedAny || output.length()==0;
        int processedLength= matchedAny
            ? (matchedMatcheable
                    ? output.length() // Not valid at the end of input - see below
                    : Math.min( matcher.start(), pastMatcheable ) //@TODO Does this work if the last match was within matcheable, or past it?
              )
            : pastMatcheable;
        //assert processedLength<=pastMatcheable; //@TODO Not valid since FilterDataCleanup processes Postgres sequences
        // Append the rest of input - past the processed range.
        //output.append( input, lastMatchEnd, input.length() );
        matcher.appendTail(output);
        if( run.sequenceManager().allWasRead() ) {
            processedLength= output.length();
        }
        else {
            // If the processedLength range would open a quote (i.e. if it has an odd number of apostrophes), then
            // reduce it so that it closes the quote(s) that it opens - i.e. it will have an even number of apostrophes.
            // This is called after we applied FilterComments, so there are no SQL comments that could introduce an odd number of apostrophes
            boolean withinQuotes= false;
            int lastQuoteIndex= -1;
            for( int i=0; i<processedLength; i++ ) {
                if( output.charAt(i)=='\'') {
                    withinQuotes= !withinQuotes;
                    lastQuoteIndex= i;
                }
            }
            if( withinQuotes ) {
                if( lastQuoteIndex==0 && !run.sequenceManager().allWasRead() ) {
                    // The first and only quote in the matcheable area is at index 0. That would cause an infinite loop of tasks.
                    throw new IllegalStateException( "Expand maxMatchLength (and the heap respectively)." );
                }
                if( lastQuoteIndex>0 ) {
                    processedLength= lastQuoteIndex;
                }
            }
        }
            /* crossedUnmatcheable: matchedAny && !matchedMatcheable,*/
        return  processedLength;
    }
}