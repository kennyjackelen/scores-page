#!/usr/bin/env bash

forever stop scoreboard
forever start -c "node --harmony" -a --uid "scoreboard" scores.js
