/* global process */

import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import makeFeeds from './util/telegram/make-feeds.js';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;

export default function () {
    glob.sync(path.join('me', 'blog', '_telegram', '*'), { cwd: contentPath })
        .sort()
        .forEach((groupFilePath) => {
            const group = path.basename(groupFilePath);
            // console.log('Group:', group);
            makeFeeds(group);
        });
}
