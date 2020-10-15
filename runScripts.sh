node scripts/fetch.js
node scripts/convert.js
node scripts/twitterToJsonFeed.js
node scripts/scrapeMissingImages.js
node scripts/archiveToFavourite.js
rm ../public-favourite-feeds/*/*/*/favourite*
rm ../public-favourite-feeds/*/*/favourite*
rm ../public-favourite-feeds/*/favourite*
node scripts/telegramToFeeds.js
node scripts/exportPublicFavourites.js
node scripts/index.js
cd ../feeds/ && git add . && git commit -m - && git push
cd -
./scripts/rsync-attachments.sh
./scripts/aws-sync-public-feeds.sh
