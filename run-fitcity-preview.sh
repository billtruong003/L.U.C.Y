#!/bin/bash
cd /root/lucy-workspace/fitcity-web || exit 1
export CI=1 WRANGLER_SEND_METRICS=false NODE_NO_WARNINGS=1
exec node_modules/.bin/astro dev --host 0.0.0.0 --port 8793
