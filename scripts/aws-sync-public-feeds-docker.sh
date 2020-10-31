docker run --rm -it \
       --env-file "$HOME/.aws.env" \
       -e "AWS_DEFAULT_REGION=us-east-2" \
       --volume="$PWD/../public-favourite-feeds:/var/data:ro" \
       amazon/aws-cli \
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
       /var/data/ \
       s3://feeds.multipolygon.net/
