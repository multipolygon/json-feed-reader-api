/* global process */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import writeFiles from '../utils/writeFiles.js';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;

glob.sync(path.join('*', '*', '*', 'archive.json'), { cwd: contentPath })
    .slice(0, 100000000000000)
    .forEach((filePath) => {
        console.log(filePath);
        const dirPath = path.dirname(filePath);
        const feed = JSON.parse(fs.readFileSync(path.join(contentPath, filePath)));
        writeFiles({
            dirPath,
            name: 'favourite',
            feed: {
                ...feed,
                items: feed.items.filter((i) => i._archive && i._archive.favourite),
            },
        });
    });
