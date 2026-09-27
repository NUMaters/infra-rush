#!/bin/sh
set -eu
chown game:game /data
exec su-exec game /infra-rush -static /app/static -master /app/master
