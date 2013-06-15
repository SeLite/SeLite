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
import java.util.regex.MatchResult;
import java.io.Reader;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.io.FileNotFoundException;
import java.io.FileWriter;
import java.util.SortedMap;
import java.util.TreeMap;
// @TODO BIG Important: CharSequenceManagerInFile - pipe the filters through, and have a sequence/buffer for each, if feasible
// and if all buffers fit in memory. Then we'd need to read the input file and write the output only once.

//@TODO Make it understand in-quotation and in-comments mode, so that
// it the sequence never starts mid-comment (before comments are removed) or mid-quoted
// Behaviour-wise That will only affect CharSequenceManagerInFile.
// In order to test it I need
// -- enforce small heap, and/or
// -- have an very SQL dump (that won't fit whole in heap) with SQL comments and SQL string literals
// - and I need to have a subsequence longer than heap (easiest: at the very beginning), that doesn't contain any match for a chosen pattern,
//   and its last character of it that fits in the heap is either within SQL comment, or within an SQL string literal.
//   Then there will be a match after that subsequence (after the end of the comment or string literal, as chosen).
//   CharSequenceManager must skip the comment/strign literal.
// Also: SQL comments in C style /* ... */

/** This helps to process regular expressions across a continuous
 *  input stream which may or may not be loaded fully in memory.
 */
public abstract class CharSequenceManager {
    /** Not public - not to be subclassed outside the package.
     */
    CharSequenceManager( String givenInputFileName, String givenOutputFileName, Run run ) {
        inputFileName= givenInputFileName;
        outputFileName= givenOutputFileName;
        openInput( run );
    }
    protected final String inputFileName;
    protected final String outputFileName;
    private FileWriter writer;
    
    /** This is null or not, depending on the implementation (subclass).
     */
    protected FileWriter writer() { return writer; }
    
    protected StringBuffer output= new StringBuffer();
    
    public static enum StreamSequence {
        /** All instances with parameter beforeMain=false must proceed
         *  any and all instances with beforeMain=true. That's because Run.run() depends on it. */
        SEQUENCE(false);
        
        StreamSequence( boolean beforeMain) {
            this.beforeMain= beforeMain;
        }
        /** Whether the contents goes before the main stream. */
        private final boolean beforeMain;
        boolean beforeMain() { return beforeMain; }
    }
    
    private SortedMap<StreamSequence, StringBuffer> streams= new TreeMap<StreamSequence, StringBuffer>();
    
    SortedMap<StreamSequence, StringBuffer> streams() { return streams; }
    
    /** Get a StringBuffer for the given sequence, that gets generated before or after the main stream
     * (depending on sequence.beforeMain). These streams are kept in memory until the whole input is fully processed.
     * @TODO flush/serialise them to file(s). In the meantime don't use for memory-extensive contents.
     * Not thread-safe - must be called from synchronised blocks if across multiple threads.
     */
    protected StringBuffer stream(StreamSequence sequence ) {
        StringBuffer stream= streams.get(sequence);
        if( stream==null ) {
            stream= new StringBuffer();
            streams.put( sequence, stream );
        }
        return stream;
    }
    
    protected abstract void openInput( Run run );
    
    /** @return output buffer. It gets automatically flushed on calls to advance(int) and swap().
     *  It may get reassigned on calls to swap() and write(int), therefore do not cache its result
     *  across calls to swap() or write(int).
     *  It returns StringBuffer, so that clients can use it with
     *  methods of java.util.regex.Matcher.
     */
    public final StringBuffer output() { return output; }
    
    /** Its already-processed parts get discarded (and therefore its indexes change)
     *  on call to advance(int).
     *  It gets reassigned on calls to swap(), therefore do not cache its result
     *  across calls to swap().
        <br/>Implementation detail: 
     *  - for CharSequenceReplaceInMemory, this is
     *  -- StringBuilder at the first stage
     *  -- StringBuffer in subsequent stages (set to previous this.output),
     *  - for CharSequenceReplaceInFile it is CharSequenceContinuous.
     */
    public abstract CharSequence input();
    
    // @TODO remove this and its implememntations
    public abstract int maxLengthToBuffer();
    
    public abstract boolean allWasRead();
    
    public abstract boolean inMemory(); //@TODO Consider replacing it and its usage by overloading the other methods as they need. Add a parameter 'boolean finalRun' to swap() method?
    
    /**Advance the input buffer, write and clear output buffer.
     * @param advanceFromLastStart Must be positive.
     * @return Whether it read and appended at least 1 character.
     */
    protected abstract boolean advanceInput( int advanceFromLastStart, Run run );
    
    /** It rewinds the input. Used mostly when reading application-specific
     *  Field<XXX> values. Only used at the beginning of the current stage
     *  before generating any output.
     */
    public abstract void rewindInput( Run run );
    
    /** It searches for an arbitrary pattern.
     *  Use this instead with patterns that should only match once or a few
     *  times, and that may be located anywhere in the input.
     *  For such cases use it instead of Pattern.matcher( input() ),
     *  which may run out of memory for very large input.
     *  It leaves input() advanced - therefore only use before you
     *  generated any output, and rewindInput() before using input() again.
     *  This should be used only after FilterComments was applied.
     *  // It assumes the input is not within an SQL string literal.
     *  It matches the pattern whether it's a part of SQL string literal or not.
     *  @TODO
     *  1. change Run - so that it goes through all applicable Filter-s and it collects any applicable Field-s that need parsing
     *  2. create a class FieldExtractor similar to FilterReplace - with Pattern pattern(), int maxMatchedLength(), String match().
     *  3. Or make it a subclass of Filter.
     *  4. change the following to have 1 parameter - FieldExtractor.
     *  5. process all such extractors at once
     *  @param pattern should not consume/skip a very long sequence,
     *  otherwise it may run out of memory.
     *  @return MatchResult instance on success relative to this.input()
     *  at the time this method returns; it becomes inconsistent
     *  if this.input() is modified later. Return null if no such match.
     */
    public abstract MatchResult find( Pattern pattern, int maxMatchedLength, Run run );
    
    /** This 
     *  1. saves the output of the previous stage
     *  2. reloads the output of the previous stage as in input of the new stage
     *  2. 'rewinds' the input to start at its beginning
     */
    protected abstract void swap( Run run );
    
    /** It saves the final output. It also prepends/appends any entries from
     *  streams() in their appropriate order.
     */
    protected abstract void save( Run run );
    
    final void openWriter( String fileName ) {
        try {
            writer= new FileWriter( fileName );
        }
        catch( IOException e ) {
            throw new RuntimeException(e);
        }
    }
    
    /** This flushes and closes the output stream.
     */
    final void closeWriter() {
        try {
            writer.close();
        }
        catch( IOException e ) {
            throw new RuntimeException(e);
        }
        writer= null;
    }
    
    /** It writes (sub)sequence of output, its first lengthToWrite characters  (if any), and it clears the respective subsequence in output.
     *  It may set this.output to a new instance.
     *  Only to be used by subclasses.
     */
    final void write( int lengthToWrite ) {
        try {
            writer.append( output, 0, lengthToWrite );
            output.delete( 0, lengthToWrite );
        }
        catch( IOException e ) {
            throw new RuntimeException(e);
        }
    }
    
    /** It writes a completely processed (sub)sequence of the output.
     *  To be used by client (Run).
     */
    abstract void writeComplete( int lengthToWrite );
}