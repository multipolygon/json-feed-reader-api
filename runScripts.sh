rm ../public-favourite-feeds/*/*/*/favourite*
rm ../public-favourite-feeds/*/*/favourite*
rm ../public-favourite-feeds/*/favourite*

node scripts/run.js

cd ../feeds/ && git add . && git commit -m - && git push
cd -

cd ../public-favourite-feeds && ./aws-sync.sh
cd -
