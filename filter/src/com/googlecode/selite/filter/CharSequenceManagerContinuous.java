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
import java.io.Writer;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.regex.MatchResult;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class CharSequenceManagerContinuous extends CharSequenceManager {
    private CharSequenceContinuous input;
    
    CharSequenceManagerContinuous( String givenInputFileName, String givenOutputFileName, Run run ) {
        super( givenInputFileName, givenOutputFileName, run );
    }
    
    CharSequenceManagerContinuous( CharSequenceManagerInMemory inMemory, Run run ) {
        super( inMemory.inputFileName, inMemory.outputFileName, run );
        throw new Error("Implement me");
    }
    
    public CharSequence input() { return input; }
    
    private void setInput( Run run ) {
        input= new CharSequenceContinuous( new File(inputFileName), run );
    }
    
    protected void openInput( Run run ) {
        setInput( run );
        openWriter( outputFileName );
    }
   
    public int maxLengthToBuffer() {
        return input.maxLengthToBuffer();
    }
    
    public boolean allWasRead() {
        return input.allWasRead();
    }
    
    public boolean inMemory() {
        return false;
    }
    
    /**@param advanceFromLastStart 
     * @param run
     * @return Whether it read and appended at least 1 character.
     */
    protected boolean advanceInput( int advanceFromLastStart, Run run ) {
        assert advanceFromLastStart>=0; //@TODO check or get rid of this
        return input.advance( advanceFromLastStart, run );
    }
    
    public void rewindInput( Run run ) {
        input.close();
        setInput( run );
    }
    
    public MatchResult find( Pattern pattern, int maxMatchedLength, Run run ) {
        //@TODO assert false : "TODO 1st: refactor to use a new class Extractor, M:N to Filter";
        //@TODO assert false : "TODO 2nd: collect all extractor(s) from fields of all Filters, and search for them in parallel, reading the file max. once.";
        //@TODO Then refactor this to CharSequenceManager, or to Extractor
        if( maxMatchedLength<=0 || maxMatchedLength>input.maxLengthToBuffer() ) {
            throw new IllegalArgumentException( "maxMatchedLength should be positive and not higher than maximum character buffer." );
        }
        while( true ) {
            Matcher matcher= pattern.matcher( input );
            if( matcher.find() ) {
                return matcher;
            }
            if( input.allWasRead() ) {
                return null;
            }
            // @TODO:
            input.advance( Math.max(input.builder().length()-maxMatchedLength, 0), run );
        }
    }

    void writeComplete( int lengthToWrite ) {
        write( lengthToWrite );
    } 
    
    protected void swap( Run run ) {
        input.reset( output );
        output= new StringBuffer();
    }
    
    protected void save( Run run ) {
        input.close();
        write( output.length() );
        for( StreamSequence sequence:streams().keySet() ) {
            assert !sequence.beforeMain() : "TODO";
        }
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
