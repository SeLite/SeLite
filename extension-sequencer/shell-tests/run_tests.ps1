# This script is simplified just to run all tests. For full functionality (i.e. running a selected test etc.) use run_tests.sh on Unix.
# You'll need to install Gecko Console Redirector as per https://developer.mozilla.org/en-US/docs/Mozilla/Command_Line_Options#-console. Put it on PATH.
$script_dir = [System.IO.Directory]::GetCurrentDirectory()
$script_dir= 'E:\selite\extension-sequencer\shell-tests'
cd $script_dir

# get-content somefile.txt | where { $_ -match "expression"}

# for sed there is:
# get-content somefile.txt | %{$_ -replace "expression","replace"}
# to call it from normal cmd, just @powershell -Command "get-content..." it. The only caveat is that you must escape quotations marks: ... -Command "get-content ... \"expression\",..." 

# For using sed see also http://sed.sourceforge.net/sedfaq3.html#s3.1.2
#REM Use sed -i "s/regex/replacement/", don't use sed -i '' "s/regex/replacement/"
#REM since that generates a confusing error: sed: can't read s/regex/replacement/

#REM If 'value' is not set, then this comments out the line that has the field. For 'extension' see setup_versions(). This adds ".." around value of $value. It expects SeLiteExtensionSequencerManifest.js to have any commas at the beginning of a line that defines an entry, e.g.: ,minVersion: "0.10".
function change_or_comment_out( $extension, $field, $value='') {
    if( $field -ne "preActivate" ) {
        if( $value -ne '' ) {
            # This and other calls to (get-content path\to\inputFile) | % -replace ... | Out-File path\to\inputFile must have get-content in parenthesis (...). Otherwise it wipes the file.
            # Using get-content without parenthesis and piping to Set-Content -Path same-file failed: it wiped out the file.
            # Don't use Out-File without -Encoding, that generates UTF-16. Don't use Out-File -Encoding "UTF8" since that adds a BOM byte at the beginning.
            (get-content ('extensions\' +$extension+ '\chrome\content\SeLiteExtensionSequencerManifest.js') ) | %{$_ -replace ( '(//)?(,?\s*' +$field+ ':)\s*[''"]?[0-9.]*[''"]?' ), ('$2 '+'"' +$value+ '"') } | Out-File -Encoding "ascii" extensions\$extension\chrome\content\SeLiteExtensionSequencerManifest.js
        }
        else {
            # comment out the line
            
            # TODO simplify here and in .sh, as per the commands below (for preActivate)
            
            #sed -i -r 's/(\/\/)?(,\s*$field:\s*['\"]?[0-9.]*['\"]?)/\/\/\2/' extensions/$extension/chrome/content/SeLiteExtensionSequencerManifest.js
            (get-content ('extensions\' +$extension+ '\chrome\content\SeLiteExtensionSequencerManifest.js' ) ) | %{$_ -replace ( '(//)?(,?\s*' +$field+ ':\s*[''"]?[0-9.]*[''"]?)' ), '//$2' } | Out-File -Encoding "ascii" extensions\$extension\chrome\content\SeLiteExtensionSequencerManifest.js
        }
    }
    else {
        if( $value -ne '' ) {
            # uncomment the line (if commented out)
            #sed -i -r "s/(\/\/)?(,\s*$field:.*)/\2/" extensions/$extension/chrome/content/SeLiteExtensionSequencerManifest.js
            (get-content ('extensions\' +$extension+ '\chrome\content\SeLiteExtensionSequencerManifest.js' ) ) | %{$_ -replace ( '(//)?(,?\s*' +$field+ ':.*)' ), '$2' } | Out-File -Encoding "ascii" extensions\$extension\chrome\content\SeLiteExtensionSequencerManifest.js
        }
        else {
            # comment out the line
            #sed -i -r "s/(\/\/)?(,\s*$field:.*)/\/\/\2/" extensions/$extension/chrome/content/SeLiteExtensionSequencerManifest.js
            (get-content ('extensions\' +$extension+ '\chrome\content\SeLiteExtensionSequencerManifest.js' ) ) | %{$_ -replace ( '(//)?(,?\s*' +$field+ ':.*)' ), '//$2' } | Out-File  -Encoding "ascii" extensions\$extension\chrome\content\SeLiteExtensionSequencerManifest.js
        }
    }
}
#change_or_comment_out 'journey' 'preActivate' 'true'
#change_or_comment_out 'journey' 'preActivate'

function setup_versions( $extension, $version='', $minVersion='', $compatibleVersion='', $oldestCompatibleVersion='', $preActivate='' ) {
    #Param( $extension, $version='', $minVersion='', $compatibleVersion='', $oldestCompatibleVersion='', $preActivate='' )
    if( $extension -eq '' ) {
        echo Pass at least parameter/variable extension
        #exit
    }
    if( $version -ne '' ) {
        #sed -i -r "s/<em:version>[0-9.]+<\/em:version>/<em:version>$version<\/em:version>/" extensions/$extension/install.rdf
        (get-content ('extensions\' +$extension+ '\install.rdf' ) ) | %{$_ -replace '<em:version>[0-9.]+</em:version>', ('<em:version>' +$version+ '</em:version>') } | Out-File  -Encoding "ascii" extensions\$extension\install.rdf
    }
    
    change_or_comment_out $extension 'minVersion' $minVersion
    change_or_comment_out $extension 'compatibleVersion' $compatibleVersion
    change_or_comment_out $extension 'oldestCompatibleVersion' $oldestCompatibleVersion
    change_or_comment_out $extension 'preActivate' $preActivate
}

function run( $output, $outputSorted ) {
    # For some reason Console Redirector needs a full path to firefox.exe, or it has to be in C:\Program Files (x86)\Mozilla Firefox\ - it doesn't use PATH.
    & 'Console Redirector.exe' "E:\SW\Mozilla Firefox 32.0.3\firefox.exe" -P SeLiteExtensionSequencerTest -no-remote -chrome chrome://selite-extension-sequencer/content/extensions/checkAndQuit.xul?registerAndPreActivate 2>$null >$output
    
    # Different to run_tests.sh: I save the output from Mozilla and then I sort it via sort.exe. Only then I filter using Select-String. Filtering out before sorting works in powershell.exe when it runs a script. But when I filtered before sorting with piping on powershell side and I run the commands from an unsaved window in Windows PowerShell ISE, its piping split any lines longer than 172 characters into chunks...
    $outputSortedPartiallyFiltered= [System.IO.Path]::GetTempFileName()
    sort.exe $output >$outputSortedPartiallyFiltered
    
    # In addition to filtering out console.(log|info|warning), I filter out 'console.error:', too. That's because console.error is special: somehow, a string passed to console.error() is printed on a separate line. It's also prefixed by two spaces - hence those spaces in expected_outputs/*.html
    # The filter removes 'Searching for Gecko runtime', which comes from Console Redirector.exe.
    # Different to run_tests.sh: I sort here, rather than in function run_against 
    (get-content $outputSortedPartiallyFiltered) | Select-String -notMatch -pattern 'console.(log|info|warning|error):|@(chrome|resource)://' | Select-String -SimpleMatch -notMatch -pattern 'Problem(s) with add-on(s) for Firefox and Selenium IDE' | Select-String -notMatch -pattern 'Searching for Gecko runtime' | Out-File  -Encoding "ascii" $outputSortedPartiallyFiltered

    # Powershell (or maybe my Select-String filters) leaves empty lines in. I've tried to remove them with  | where {$_ -ne ''}, or with | Select-String -SimpleMatch -notMatch -pattern '`r|`n', but both failed.
    $content= [string]::Join( "`n", (get-content $outputSortedPartiallyFiltered) )
    $content= [regex]::Replace( $content, "(`n|`r)+", "`n", "Singleline" )
    $content= [regex]::Replace( $content, "^(`n|`r)|(`n|`r)$", "" )
    echo $content | Out-File  -Encoding "ascii" $outputSorted
    rm $outputSortedPartiallyFiltered
}

# It expects parameters:
#- $expectedOutput a file path of the expected output relative to shell-tests/
#- $testNumber number of this test. Pass it without any leading zero (otherwise it's treated as octal).
#- $description a test description (which will be printed out on failure)
function run_against( $expectedOutput, $testNumber, $description ) {
    # Firefox Browser Console goes to stdout, not to stderr. I remove Browser Console messages other than errors.
    # I remove stack traces, since those change with implementation. Hence don't have any stack traces in expected output files either.
    # I have to sort the expected and the actual output before I compare them, because some plugins can be processed in random order.
    $output= [System.IO.Path]::GetTempFileName()
    $outputSorted= [System.IO.Path]::GetTempFileName()
    
    #run | Out-File  -Encoding "ascii" $output
    run $output $outputSorted
    
    $expectedOutputSorted= [System.IO.Path]::GetTempFileName()
    get-content $expectedOutput | sort-object | Select-String -SimpleMatch -notMatch -pattern 'Non-matching-pattern, so that when run in PowerShell ISE, it splits lines longer than 171 characters. Otherwise $expectedOutputSorted differed to $outputSorted if there were lines over 171 characters.' | where {$_ -ne ''} | Out-File  -Encoding "ascii" $expectedOutputSorted
    $content= [string]::Join( "`n", (get-content $expectedOutputSorted) )
    $content= [regex]::Replace( $content, "(`n|`r)+", "`n", "Singleline" )
    $content= [regex]::Replace( $content, "^(`n|`r)|(`n|`r)$", "" )
    echo $content | Out-File  -Encoding "ascii" $expectedOutputSorted
    
    $difference= [System.IO.Path]::GetTempFileName()
    # Side note: compare-object compares the lines regardless of the order. E.g. it deems the following to be equal: compare-object (echo alpha betta) (echo betta alpha). However, I still need sort.exe in function run, in case there are lines over 171 characters.
    compare-object $(get-content $expectedOutputSorted) $(get-content $outputSorted) | Out-File  -Encoding "ascii" $difference
    # I don't use fc.exe, since that generates a line for equal files, too.
    if( (get-childitem $difference).length -ne 0 ) {
        echo ('Test #' +$testNumber+ '"' +$description+ '" failed. Difference between the expected (<) and the actual (>) output (after those were sorted alphabetically):')
        cat $difference
        echo '' #Generate an empty line. Don't use just echo on its own, since that asks for an input through a popup.
        echo 'The actual output:'
        cat $output
    }
    echo ('output file ' +$output+ ', outputSorted ' +$outputSorted+ ', expectedOutputSorted ' +$expectedOutputSorted+ ', difference' +$difference )
    ECHO todo: Remove temp files
    #rm $output, $outputSorted, $expectedOutputSorted, $difference
}

# see tests.html
# don't enclose minVersion, compatibleVersion, oldestCompatibleVersion in "..", since setup_versions() -> change_or_comment_out() does it

function reset_versions() {
    #setup_versions 'rail' '0.10' '' '' '' ''
    setup_versions -extension 'rail' -version '0.10'
    setup_versions -extension 'train' -version '0.10'
    setup_versions -extension 'journey' -version '0.10'
}

#reset_versions
#run_against 'expected_outputs\blank.html' 1 'Default'

setup_versions -extension 'train' -version '0.05'
setup_versions -extension 'journey' -minVersion '0.10'
run_against 'expected_outputs\02_train_low_version.html' 2 'Train low version. This test occasionally fails, so re-run on failure.'

#reset_versions
#setup_versions -extension 'train' -oldestCompatibleVersion '0.05'
#setup_versions -extension 'journey' -compatibleVersion '0.05'
#run_against( 'expected_outputs\blank.html', 3, 'compatibleVersion = oldestCompatibleVersion' )

#reset_versions
#setup_versions -extension 'train' -oldestCompatibleVersion '0.10'
#setup_versions -extension 'journey' -compatibleVersion '0.05'
#run_against( 'expected_outputs\blank.html', 4, 'compatibleVersion < oldestCompatibleVersion' )

#reset_versions
#setup_versions -extension 'train' -oldestCompatibleVersion '0.05'
#setup_versions -extension 'journey' -compatibleVersion '0.10'
#run_against( 'expected_outputs\05_train_low_oldestCompatibleVersion.html', 5, 'Journey compatibleVersion > Train oldestCompatibleVersion' )

#reset_versions
#setup_versions -extension 'journey' -preActivate 'true'
#run_against( 'expected_outputs\06_journey_preActivate_fails.html', 6, 'Journey preActivate fails' )

#reset_versions
#setup_versions -extension 'train' -preActivate 'true'
#run_against( 'expected_outputs\07_train_preActivate_fails.html', 7, 'Train preActivate fails' )

#reset_versions
#setup_versions -extension 'rail' -preActivate 'true'
#run_against( 'expected_outputs\08_rail_preActivate_fails.html', 8, 'Rail preActivate fails' )
