/* global process */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import yaml from 'js-yaml';
import mkdirp from 'mkdirp';
import _ from 'lodash';
import writeFiles from '../utils/writeFiles.js';

dotenv.config();

const srcPath = process.env.CONTENT_PATH;
const targetPath = process.env.PUBLIC_CONTENT_PATH;

glob.sync(path.join('*', '*', '*', 'config.yaml'), { cwd: srcPath })
    .slice(0, 1000000000000)
    .forEach((filePath) => {
        console.log(filePath);
        const config = yaml.safeLoad(fs.readFileSync(path.join(srcPath, filePath)));
        if (config.private === true) {
            console.log('--> SKIP');
        } else {
            const dirPath = path.dirname(filePath);
            const archiveFilePath = path.join(srcPath, dirPath, 'favourite.json');
            if (fs.existsSync(archiveFilePath)) {
                const feed = JSON.parse(fs.readFileSync(path.join(srcPath, archiveFilePath)));
                if (feed.items.length !== 0) {
                    mkdirp.sync(path.join(targetPath, dirPath));
                    writeFiles({
                        dirPath,
                        name: 'favourite',
                        feed: {
                            ...feed,
                            items: feed.items.map(({ content_html: convertHtml, ...item }) => ({
                                ...item,
                                content_text: _.truncate(item.content_text, { length: 250 }),
                            })),
                        },
                        contentPath: targetPath,
                        contentHost: process.env.PUBLIC_CONTENT_HOST,
                        appHost: process.env.PUBLIC_APP_HOST,
                    });
                    console.log('-->', feed.items.length);
                }
            }
        }
    });
