/* global URL process */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;
const contentHost = process.env.CONTENT_HOST;

glob.sync(path.join('*', '*', '*', '*.json'), { cwd: contentPath })
    .slice(0, 100000000)
    .forEach((filePath) => {
        console.log(filePath);
        const feed = JSON.parse(fs.readFileSync(path.join(contentPath, filePath)));
        if (feed.feed_url) {
            console.log('-->', feed.feed_url);
            feed.feed_url = new URL(filePath, contentHost).href;
            fs.writeFileSync(path.join(contentPath, filePath), JSON.stringify(feed, null, 1));
        }
    });
