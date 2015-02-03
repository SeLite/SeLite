#!/bin/bash
#change dir to where this script is located:
cd "$( dirname "${BASH_SOURCE[0]}" )"

# Create folder "xpi", if it doesn't exist already
mkdir xpi 1>/dev/null 2>&1
rm -f xpi/*

cd auto-check/src
zip -r ../../xpi/auto-check.xpi *

cd ../../bootstrap/src
zip -r ../../xpi/bootstrap.xpi *

cd ../../commands/src
zip -r ../../xpi/commands.xpi *

cd ../../clipboard-and-indent/src
zip -r ../../xpi/clipboard-and-indent.xpi *

cd ../../extension-sequencer/src
zip -r ../../xpi/extension-sequencer.xpi *

cd ../../db-objects/src
zip -r ../../xpi/db-objects.xpi *

cd ../../misc/src
zip -r ../../xpi/misc.xpi *

#cd ../../selblocks-global/src
#zip -r ../../xpi/selblocks-global.xpi *

cd ../../sqlite-connection-manager/src
zip -r ../../xpi/sqlite-connection-manager.xpi *

cd ../../testcase-debug-context/src
zip -r ../../xpi/testcase-debug-context.xpi *

cd ../../settings/src
zip -r ../../xpi/settings.xpi *

cd ../../exit-confirmation-checker/src
zip -r ../../xpi/exit-confirmation-checker.xpi *

cd ../../run-all-favorites/src
zip -r ../../xpi/run-all-favorites.xpi *

#cd ../../implicit-wait/src
#zip -r ../../xpi/implicit-wait.xpi *
