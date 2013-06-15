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

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.MatchResult;
import java.util.regex.Pattern;

public final class CharSequenceManagerInMemory extends CharSequenceManager {
    CharSequence input;
    
    CharSequenceManagerInMemory( String givenInputFileName, String givenOutputFileName, Run run ) {
        super( givenInputFileName, givenOutputFileName, run );
    }
    
    public int maxLengthToBuffer() {
        return Integer.MAX_VALUE;
    }
    
    public boolean allWasRead() {
        return true;
    }
    
    public boolean inMemory() {
        return true;
    }
    
    /** This may return StringBuilder, StringBuffer or String.
     */
    public CharSequence input() { return input; }
    
    protected void openInput( Run run ) {
        File file= new File(inputFileName);
        CharReader reader= new CharReader( file );
        input= new StringBuilder();
        while( !reader.allWasRead() )
            reader.readAppend( (Appendable)input, Integer.MAX_VALUE );
        reader.close();
    }
    
    /** It sets this.input to String which is a subsequence of previous this.input.
     *  @return Whether it read and appended at least 1 character.
     */
    protected boolean advanceInput( int advanceFromLastStart, Run run ) {
        assert advanceFromLastStart>0;
        input= input.subSequence(  advanceFromLastStart, input.length() );
        assert false : "TODO check the assertion in Run.main()";
        return false;
    }
    
    public void rewindInput( Run run ) {}
    
    public MatchResult find( Pattern pattern, int maxMatchedLength, Run run ) {
        Matcher matcher= pattern.matcher( input );
        if( matcher.find() ) {
            return matcher;
        }
        return null;
    }
    
    void writeComplete( int lengthToWrite ) {} 
    
    protected void swap( Run run ) {
        input= output;
        output= new StringBuffer();
    }
    
    protected void save( Run run ) {
        openWriter( outputFileName );
        for( StreamSequence sequence:streams().keySet() ) {
            assert !sequence.beforeMain() : "TODO";
        }
        write( output.length() );
        for( Map.Entry<StreamSequence, StringBuffer> entry:streams().entrySet() ) {
            if( !entry.getKey().beforeMain() ) {
                try {
                    writer().append( entry.getValue() );
                }
                catch( IOException e) {
                    throw new RuntimeException(e);
                }
            }
        }
        closeWriter();
    }
}
