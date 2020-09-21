/* global process */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import _ from 'lodash';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;

glob.sync(path.join('*', '*', '*', 'archive.json'), { cwd: contentPath })
    .slice(0, 10000000000)
    .forEach((feedPath) => {
        console.log(feedPath);
        const origPath = path.join(path.dirname(feedPath), 'original.json');
        if (fs.existsSync(path.join(contentPath, origPath))) {
            console.log(' --->', origPath);
            const feed = JSON.parse(fs.readFileSync(path.join(contentPath, feedPath)));
            const orig = JSON.parse(fs.readFileSync(path.join(contentPath, origPath)));
            const beforeCount = feed.items.length;
            feed.items = feed.items.map((item) => {
                const origItem = _.find(orig.items, (i) => i.id === item.id);
                if (origItem) {
                    console.log(' + ', item.id);
                    if (item._archive) {
                        origItem._archive = item._archive;
                    }
                    // console.log(origItem);
                    return origItem;
                }
                console.log(' - ', item.id);
                // item._archive = item._archive || {
                //     log: [
                //         moment(item.date_modified).format(),
                //     ],
                // };
                return item;
            });
            console.log('  ', beforeCount, '=>', feed.items.length);
            fs.writeFileSync(path.join(contentPath, feedPath), JSON.stringify(feed, null, 1));
        }
    });
