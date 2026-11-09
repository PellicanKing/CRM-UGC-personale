#!/bin/bash
# Opens the configuration file (.env.local) in TextEdit.
cd "$(dirname "$0")"
[ -f .env.local ] || cp .env.example .env.local
open -e .env.local
