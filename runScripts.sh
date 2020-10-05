node scripts/fetch.js
node scripts/convert.js
node scripts/twitterToJsonFeed.js
node scripts/scrapeMissingImages.js
node scripts/archiveToFavourite.js
rm ../public-favourite-feeds/*/*/*/favourite*
rm ../public-favourite-feeds/*/*/favourite*
rm ../public-favourite-feeds/*/favourite*
node scripts/exportPublicFavourites.js
node scripts/index.js
cd ../feeds/ && git add . && git commit -m - && git push
cd -
cd ../public-favourite-feeds/ && git add . && git commit --amend -m - && git push -f
cd -
