node scripts/fetch.js
node scripts/convert.js
node scripts/scrapeMissingImages.js
node scripts/exportPublicFavourites.js
node scripts/index.js
cd ../feeds/ && git add . && git commit -m - && git push
cd -
cd ../public-favourite-feeds/ && git add . && git commit -m - && git push

