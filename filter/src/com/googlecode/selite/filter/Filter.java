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

public abstract class Filter {
    /** It processes the input, available through run.sequenceManager().input(), filtering it, writing/modifying
     *  any accepted parts to run.sequenceManager().output().
        @return Number of passed/transformed/generated characters for the unmatcheable area, as they are added to run.sequenceManager().output().
        0 is a valid value - if the filter deems the whole input sequence to be removed.
     *  Not sure: If the task didn't consume any characters from the unmatcheable area, then the returned value should be same as
     *  run.maxMatchLength() except when at the end of the input file. Otherwise (if the task consumed one or more characters
     *  from the unmatcheable area) the returned value will be less than run.maxMatchLength().
     *  Return a negative value if there are no changes by this filter or the filter is not applicable - in that case
     *  the filter doesn't append anything to run.sequenceManager().output(). See also #scansOnly(Run).
     */
    protected abstract int process( App app, Run run, int pastMatcheable );
    
    public final int processAndCheck( App app, Run run, int pastMatcheable ) {
        int result= process( app, run, pastMatcheable );
        if( result>=0 ) {
            //@TODO move this? assert !( result.crossedUnmatcheable && run.sequenceManager().allWasRead() ) : "If it consumed any characters from unmatcheable (buffer) area, it shouldn't reach the end of file yet - becausde then the unmatcheable area is empty.";
            assert result<=run.sequenceManager().output.length();
            // Do not: assert result<=pastMatcheable - because a Filter may have enlarged the output
        }
        return result;
    }
    
    /** @return Whether this filters scans the input only, without transforming/deleting/adding anything to the output.
     *  Filter.process(App,Run,int) returns a negative if and and only if scansOnly(Run) returns true.
     */
    protected boolean scansOnly( Run run ) { return false; }
    
    /** Process given filter(s). Return the last value of pastMatcheable - i.e. the last non-negative
     *  value from processAndCheck() of the filter(s). If there was no such non-negative value,
     *  then it returns the last (negative) value.
     *  @param filters Iterable list/structure of Filter instance(s). If null or empty, then this returns -1.
     */
    protected static int processMultiple( Iterable<Filter> filters, App app, Run run, int pastMatcheable ) {
        if( filters==null ) {
            return -1;
        }
        boolean someFilterModifies= false;
        int result= -1;
        for( Filter filter: filters ) {
            //@TODO What if the last filter returns processResult==null!  Then we need to "unswap". Or have a method boolean Filter.scansOnly(),
            // then use that scansOnly() in Filter.processAndCheck(..), too.
            if( result>=0 ) {
                run.sequenceManager().swap( run );
            }
            
            // The entry state is not within a comment, neither within a quote.
            result= filter.processAndCheck( app, run, pastMatcheable );
            
            boolean scansOnly= filter.scansOnly(run);
            assert scansOnly==( result<0 );
            someFilterModifies= someFilterModifies || !scansOnly;
            
            if( result>=0 ) {
                pastMatcheable= result;
            }
        }
        // There may be several filters, some of them scanning and some not. Last value of result may be negative, even if someFilterModifies==true.
        // That's why I can't just return value of result.
        assert someFilterModifies || result<0;
        return someFilterModifies
            ? pastMatcheable
            : result;
    }
    
    public int maxMatchLength( App app, Run run ) {
        int result= run.get(App.MAX_MATCH_LENGTH);
        assert result>0; // This is required by FilterComments and by common sense
        return result;
    }
    
    public void initialise( App app, Run run ) {}
}