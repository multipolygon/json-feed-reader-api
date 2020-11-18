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

const {
    CONTENT_PATH,
    CONTENT_HOST,
    PUBLIC_CONTENT_PATH,
    PUBLIC_CONTENT_HOST,
    PUBLIC_APP_HOST,
} = process.env;

function copyAttachment(url) {
    const src = url.replace(CONTENT_HOST, CONTENT_PATH);
    const dest = url.replace(CONTENT_HOST, PUBLIC_CONTENT_PATH);
    if (!fs.existsSync(src)) {
        console.log('  -->', src, fs.existsSync(src) ? '' : 'MISSING!');
    }
    mkdirp.sync(path.dirname(dest));
    fs.copyFileSync(src, dest);
}

function exportFeedFile(srcFilePath) {
    if (fs.existsSync(path.join(CONTENT_PATH, srcFilePath))) {
        const feed = JSON.parse(fs.readFileSync(path.join(CONTENT_PATH, srcFilePath)));
        if (feed.items.length !== 0 || fs.existsSync(path.join(PUBLIC_CONTENT_PATH, srcFilePath))) {
            // console.log('-->', srcFilePath, `[${feed.items.length}]`, feed.items.length === 0 ? 'EMPTY!' : '');

            const dirPath = path.dirname(srcFilePath);
            const name = path.basename(srcFilePath, path.extname(srcFilePath));

            mkdirp.sync(path.join(PUBLIC_CONTENT_PATH, dirPath));

            feed.items.forEach((item) => {
                if (item.image && _.startsWith(item.image, CONTENT_HOST)) {
                    copyAttachment(item.image);
                }
                if (item.attachments) {
                    item.attachments.forEach((att) => {
                        if (_.startsWith(att.url, CONTENT_HOST)) {
                            copyAttachment(att.url);
                        }
                    });
                }
            });

            writeFiles({
                dirPath,
                name,
                feed: {
                    ...feed,
                    items: feed.items.map((i) => ({
                        ...i,
                        ...(i.image
                            ? {
                                  image: i.image.replace(CONTENT_HOST, PUBLIC_CONTENT_HOST),
                              }
                            : {}),
                        ...(i.attachments
                            ? {
                                  attachments: i.attachments.map((a) => ({
                                      ...a,
                                      url: a.url.replace(CONTENT_HOST, PUBLIC_CONTENT_HOST),
                                  })),
                              }
                            : {}),
                    })),
                },
                contentPath: PUBLIC_CONTENT_PATH,
                contentHost: PUBLIC_CONTENT_HOST,
                appHost: PUBLIC_APP_HOST,
            });
        }
    }
}

export default function () {
    yaml.safeLoad(fs.readFileSync(path.join(CONTENT_PATH, 'public.yaml'))).forEach((globPath) =>
        glob
            .sync(globPath, { cwd: CONTENT_PATH })
            .filter((f) => {
                const configFilePath = path.join(CONTENT_PATH, path.dirname(f), 'config.yaml');
                if (fs.existsSync(configFilePath)) {
                    const config = yaml.safeLoad(fs.readFileSync(configFilePath));
                    if (config.private === true) {
                        // console.log('SKIP:', f);
                        return false;
                    }
                }
                // console.log('EXPORT:', f);
                return true;
            })
            .forEach(exportFeedFile),
    );
}
