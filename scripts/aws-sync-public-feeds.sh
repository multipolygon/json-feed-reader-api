aws \
    s3 sync \
    --delete \
    --size-only \
    --exclude "*" \
    --include "index.html" \
    --include "error.html" \
    --include "robots.txt" \
    --include "*.json" \
    --include "*.xml" \
    --include "*/_attachments/*" \
    --exclude "*/.DS_Store" \
    ../public-favourite-feeds/ \
    s3://feeds.multipolygon.net/
