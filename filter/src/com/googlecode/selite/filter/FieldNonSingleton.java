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

public abstract class FieldNonSingleton<T> extends Field<T>{
    
    /** The name needs to be unique among an actual subclass of FieldNonSingleton.
     */
    protected FieldNonSingleton( Class<T> givenClass, String givenName ) {
        super( givenClass, givenName );
    }
    
    public final boolean equals( Object other ) {
        return other instanceof FieldNonSingleton && getClass()==other.getClass() && name().equals( ((FieldNonSingleton)other).name() );
    }
    
    public final int hashCode() {
        return getClass().getName().hashCode()+name().hashCode();
    }
}