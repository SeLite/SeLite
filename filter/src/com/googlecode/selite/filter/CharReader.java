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
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.Reader;
import java.io.IOException;
import java.nio.CharBuffer;

class CharReader {
    /** This is a shortcut to result of buffer.array().
     */
    private final char array[];
    
    /** This is a 'low level' character buffer.
     */
    private final CharBuffer buffer;
    private final Reader reader;
    private boolean allWasRead= false;
    
    CharReader( Reader givenReader ) {
        reader= givenReader;
        buffer= CharBuffer.allocate( 1024*1024 );// @TODO customize
        array= buffer.array();
    }
    
    CharReader( File file ) {
        this( createReader(file) );
    }
    
    /** @return True if all character(s) were loaded from the file.
     *  It may be false even though though there are no more characters in the file
     *  - that would happen only if the last call to readAppend(Appendable,int)
     *  requested the number of characters exactly equal to the number of remaining characters
     *  in the file. Then allWasRead() still returns false and only after a next call to readAppend(Appendable,int) 
     *  it returns true.
     */
    boolean allWasRead() { return allWasRead; }
    
    private static Reader createReader( File givenFile ) {
        try {
            return new BufferedReader( new FileReader(givenFile) );
        }
        catch( FileNotFoundException e) {
            throw new RuntimeException(e);
        }
    }
    
    /** This re-uses an existing buffer of given 'previous'.
     *  Therefore it needs to be synchronized if used in a different Thread.
     *
    CharReader( CharReader previous, int sliceProcessedLength ) {
        reader= previous.reader;
        buffer= previous.buffer;
        array= previous.array;
    }*/
    
    /** It reads from inputReader and appends to this.input until
     *  the total appended length becomes equal to lengthToRead, or until all contents is read.
     *  It reads at least 1 character, if there is any - i.e. don't call with lengthToRead=0.
     *  It will not read more than lengthToRead number of characters.
     *  Do not call if allWasRead() is true.
     *  @param target Defined as Appendable, because we want to use this with either
     *  StringBuilder (from CharSequenceManagerInFile) or with StringBuilder/StringBuffer (from CharSequenceManagerInMemory).
     *  @param lengthToRead Positive number of character(s) to read, at least 1.
     *  @return the actual number of characters read (negative if nothing read - then we've reached the end)
     */
    final int readAppend( Appendable target, final int lengthToRead ) {
        assert !allWasRead;
        assert lengthToRead>0;
        // @TODO See File.getTotalSpace etc - to check whether there is enough space on the partition
        // @TODO User-specified file encoding?
        try {
            int sliceLength;
            int lengthActuallyRead= 0;
            // @TODO This will block. Try using nio
            while( ( sliceLength=reader.read(array, 0, Math.min(array.length,lengthToRead-lengthActuallyRead) ) )>=0 ) {
                target.append( buffer, 0, sliceLength );
                lengthActuallyRead+= sliceLength;
                assert sliceLength!=0 : "Reader.read(char[],int,int) should have blocked until there is some input. See its Javadoc";
                if( lengthToRead<=lengthActuallyRead ) {
                    break;
                }
            }
            if( sliceLength<0 ) {
                allWasRead= true;
            }
            assert lengthToRead==lengthActuallyRead || allWasRead;
            return lengthActuallyRead;
        }
        catch( IOException e ) { 
            throw new RuntimeException(e);
        }
    }
    
    final void close() {
        try {
            reader.close();
        }
        catch( IOException e ) {
            throw new RuntimeException(e);
        }
    }
}
