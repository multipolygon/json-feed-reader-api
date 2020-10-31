/* global URL process */

import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import makeFeeds from './makeFeeds.js';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;

glob
    .sync(path.join('me', 'blog', '_telegram', '*'), { cwd: contentPath })
    .sort()
    .forEach(
        (groupFilePath) => {
            const group = path.basename(groupFilePath);
            console.log('Group:', group);
            makeFeeds(group);
        }
    );
