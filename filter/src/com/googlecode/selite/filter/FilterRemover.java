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

/** This removes lines starting with '--', but only if they are not in SQL string values (between apostrophes).
 *  Some string values (e.g. encryption certificates) do start with '--' on new line, and this preserves them.
 *  @TODO Remove also C-like comments that start with '/*'
 */
public abstract class FilterRemover extends Filter {
    /** Used as a result of FilterRemover.processFixedStart(). Fields here are described
     *  in context of/relative to respective parameters to FilterRemover.processFixedStart().
     */
    protected static final class FixedStartResult {
        /** 0-based index of character just past the last character to append to the output (i.e. character at this index is excluded).
         */
        final int appendUpTo;
        
        /** New value of lastUnincludedIndex. @TODO rename to something better - like unincludedIndex, recentUnincludedIndex
         */
        final int lastUnincludedIndex;
        
        /** 0-based index of the last already processed character. It must be lower than input.length().
         */
        final int index;
        
        public FixedStartResult( int appendUpTo, int lastUnincludedIndex, int index ) {
            this.appendUpTo= appendUpTo;
            this.lastUnincludedIndex= lastUnincludedIndex;
            this.index= index;
        }
        
        public boolean equals( Object other ) {
            return other instanceof FixedStartResult && equals( (FixedStartResult)other );
        }
        
        public int hashCode() { return index * 5000 + appendUpTo; }
        
        private boolean equals( FixedStartResult other ) {
            return other.appendUpTo==appendUpTo && other.lastUnincludedIndex==lastUnincludedIndex && other.index==index;// && other.debugRun==debugRun;
        }
    }
    
    /**This detects whether any subsequence starting right from given index is to be removed or not; if yes, then how long it is.
     * @param index Where to start searching from, 0-based index, inclusive.
     * @return null if nothing matched (from given index); non-null if there is a match to be removed; see FilterRemover.FixedStartResult.
     */
    protected abstract FixedStartResult processFixedStart( CharSequence input, int index, int pastMatcheable );
    
    /** @return true If and only if this is called before FilterBackslashQuote - i.e. return true only in FilterComments.
     */
    protected boolean backslashEscapes() {
        return false;
    }
    
    /** @param pastMatcheable 0-based index of first character (if any) past matcheable range. If we are at the end of input, then it's equal to input.length().
     */
    protected final int process( App app, Run run, final int pastMatcheable ) {
        final CharSequence input= run.sequenceManager().input();
        final StringBuffer output= run.sequenceManager().output();
        final int length=input.length();
        assert pastMatcheable>=0 && pastMatcheable<=length;
        assert pastMatcheable>0 || length==0;
        //assert (pastMatcheable==length) == run.sequenceManager().allWasRead(); //@TODO This stopped to work in rev. 143, if you use Schema.DATA (or any Schema that uses continuous sequence manager).
        
        int lastUnincludedIndex= 0; // 0-based index into input, which is just past last included character. TODO: Rename to firstUnincludedIndex?
        int processedLength= -1; // See Filter.ProcessResult#processedLength. Only valid if we encountered an apostrophe or a comment that crossed the unmatcheable boundary.
        int openingApostrophe= -1; // Index of the opening apostrophe (if any) within the matcheable range, that doesn't have its closing apostrophe within the matcheable range
        int i=0;
        int lastStop= 0; //@TODO remove
        outer:
        for( ; i<pastMatcheable; i++ ) {
            assert processedLength<0;
            final char c= input.charAt(i);
            if( c=='\'' ) {
                openingApostrophe= i;
                while( ++i<length ) {
                    // This is for FilterComments, which extends FilterRemover, and it's run before FilterBackslashQuote,
                    // therefore here it must handle MySQL-like escape of quote, i.e. 'blah \' blah'
                    char d= input.charAt(i);
                    if( d=='\\' && backslashEscapes() ) {
                        if( i+1<length ) {
                            i++; // Skip the escape \ and also the escaped character - which may be ' or \ again.
                        }
                    }
                    else
                    if( d=='\'' ) {
                        if( i<pastMatcheable ) {
                            openingApostrophe= -1;
                        }
                        continue outer;
                    }
                }
                if( !run.sequenceManager().allWasRead() ) {
                    throw new IllegalStateException( "Matcheable range of the subsequence contains an opening apostrophe with no matching closing apostrophe in the same subsequence." );
                }
                break outer; // We reached the end of input, and there's no closing apostrophe. OK.
            }
            else {
                if( i-lastStop>=10000 ) {
                    lastStop= i;
                }
                FixedStartResult subResult= processFixedStart( input, i, pastMatcheable );
                if( subResult!=null ) {
                    assert i<=subResult.appendUpTo && subResult.appendUpTo<=length;
                    output.append( input, lastUnincludedIndex, subResult.appendUpTo );
                    
                    // A matched string can go go past matcheable range. But the end of it should be within the length of input
                    // - that's what (non)matcheable area is for.
                    assert i<subResult.index && subResult.index<=length;
                    assert i<=subResult.lastUnincludedIndex && subResult.lastUnincludedIndex<=length;
                    if( subResult.index==length ) {
                        if( !run.sequenceManager().allWasRead() ) {
                            throw new IllegalStateException( "Matcheable range of the subsequence contains a match which goes past the end of subsequence and past its unmatcheable area." );
                        }
                    }
                    assert processedLength<0;
                    assert lastUnincludedIndex<subResult.lastUnincludedIndex;
                    
                    if( i>=subResult.index ) {
                        throw new IllegalStateException(
                            i==subResult.index
                                ? "A match must not be empty."
                                : "A match was sick - it would shift the search backwards."
                        );
                    }
                    i= subResult.index;
                    if( i<=pastMatcheable ) { // @TODO Doc whether this should be <=
                        // The whole match is within the matcheable range. So let's continue from its end - there may be more matches.
                        lastUnincludedIndex= subResult.lastUnincludedIndex;
                    }
                    else {
                        lastUnincludedIndex= subResult.appendUpTo;
                        processedLength= output.length();
                        assert processedLength>=0;
                        break;
                    }
                }
                else {
                    // If I didn't use patterns with anchored bounds and with ^ in them:
                    // No match, so we won't search for a match in this matcheable area anymore here. However, we need to process any apostrophes.
                    //knownToHaveNoMoreMatches= true;
                }
            }
        }
        if( openingApostrophe>=0 ) {
            assert processedLength<0;
            //@TODO Docs here and below/above - processedLength must be set to appropriate output position, not the input length/position
            // Add the contents up to (excluding) the opening apostrophe
            assert openingApostrophe>=lastUnincludedIndex;
            processedLength= output.length()+openingApostrophe-lastUnincludedIndex;
            assert i>=pastMatcheable;
        }
        else
        if( processedLength<0 ) {
            assert pastMatcheable>=lastUnincludedIndex;
            processedLength= output.length()+pastMatcheable-lastUnincludedIndex;
        }
        assert processedLength>=0; // Ths is the length added to output. It may be 0 if all the matcheable contents was matched to be removed.
        output.append( input, lastUnincludedIndex, length);
        assert openingApostrophe!=0 || run.sequenceManager().allWasRead() : "Extend the unmatcheable buffer and heap.";
        return /*crossedUnmatcheable: 
            i>pastMatcheable && !run.sequenceManager().allWasRead()*/
            run.sequenceManager().allWasRead() // @TODO error here?
                ? output.length()
                : processedLength;
    }
}