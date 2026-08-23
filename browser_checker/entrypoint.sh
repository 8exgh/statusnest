#!/bin/sh
# Start a virtual X display and run the checker on it with a headed Chromium.
#
# Not xvfb-run: that script learns the server is ready via a SIGUSR1 from Xvfb
# to its parent, which is never delivered when it is PID 1 in a container, so
# it hangs before ever starting the command. Starting Xvfb ourselves and
# waiting for its socket is simpler and signal-safe; `exec` makes Node PID 1 so
# SIGTERM from `docker stop` reaches its shutdown handler.
set -e

SCREEN="${XVFB_SCREEN:-1366x768x24}"
export DISPLAY="${DISPLAY:-:99}"
DISPLAY_NUM="${DISPLAY#:}"

Xvfb "$DISPLAY" -screen 0 "$SCREEN" -nolisten tcp >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!

# Wait (up to 10s) for the display socket to appear.
i=0
while [ ! -S "/tmp/.X11-unix/X${DISPLAY_NUM}" ]; do
  i=$((i + 1))
  if [ "$i" -ge 100 ]; then
    echo "Xvfb did not come up on $DISPLAY" >&2
    cat /tmp/xvfb.log >&2 || true
    exit 1
  fi
  if ! kill -0 "$XVFB_PID" 2>/dev/null; then
    echo "Xvfb exited early" >&2
    cat /tmp/xvfb.log >&2 || true
    exit 1
  fi
  sleep 0.1
done
echo "Xvfb ready on $DISPLAY ($SCREEN)"

exec node dist/index.js
