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

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.File;
import java.io.Reader;

public final class CharSequenceContinuous extends CharReader implements CharSequence {
    private StringBuilder builder;
    
    private final int maxLengthToBuffer;
    
    /** It's a shortcut to builder().length().
     */
    private int length= 0;
    
    StringBuilder builder() { return builder; }
    
    void reset( CharSequence sequence ) {
        builder= new StringBuilder( sequence );
        length= builder.length();
    }
    
    /** @param fileName It must not be cached between stages of processing, since its length may change.
     * @TODO remove all parameters?
     */
    CharSequenceContinuous( File givenFile, Run run ) {
        super( givenFile );
        File file= givenFile;
        // @TODO this must be at least 2xmaxLengthToBuffer. Assert that.
        maxLengthToBuffer= 2000000; //run.sequenceHeap()/2/16; //@TODO make the ratio configurable; pass this to the parent constructor as char buffer size limit
        builder= new StringBuilder( maxLengthToBuffer );
        ensureBuffer();
    }
    
    /**@param advanceFromLastStart
     * @param run
     @TODO remove all parameters?
     * @return Whether it read and appended at least 1 character.
     */
    boolean advance( int advanceFromLastStart, Run run ) {
        //assert advanceFromLastStart>=0;
        //builder.delete( 0, advanceFromLastStart );
        //length= builder.length();
        return ensureBuffer();
    }
    
    /** This pre-fetches more characters (if any needed) into this.sequence,
     *  so that sequence contains at least maxLengthToBuffer
     *  characters. If the input file doesn't contain enough characters,
     *  then it reads whatever it can.
     *  @return Whether it read and appended at least 1 character.
     */
    private boolean ensureBuffer() {
        int lengthToRead= maxLengthToBuffer-length;
        if( lengthToRead>0 ) {
            length+= readAppend( builder, lengthToRead );
            assert length==builder.length();
        }
        assert length>=maxLengthToBuffer|| allWasRead(); //@TODO "Redo this if we support blocking streams; use nio";
        return lengthToRead>0;
    }
    
    int maxLengthToBuffer() {
        return maxLengthToBuffer;
    }
    
    public char charAt( int index ) { return builder.charAt(index); }
    
    /** This returns length of the unprocessed bufferred part of the sequence, in characters (not bytes).
     */
    public int length() { return length; }
    
    public CharSequence subSequence( int start, int end ) {
        return builder.subSequence( start, end );
    }
    
    public String toString() {
        return builder.toString();
    }
}
