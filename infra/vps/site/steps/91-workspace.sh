#!/usr/bin/env bash
# sections: rop
# Compose native widgets into the new workspace only after data and manager roster exist.
python3 "$GG_OPS/site/build-workspace.py" "$GG_OPS/site/workspace.html" "$GG_OPS/site/workspace.css" "$GG_OPS/site/workspace.js" "$SITE"
python3 "$GG_OPS/site/build-workspace-pages.py" "$GG_OPS/site/workspace.html" "$GG_OPS/site/workspace.css" "$GG_OPS/site/workspace-pages.js" "$SITE"
