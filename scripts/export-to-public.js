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

const srcRootPath = process.env.CONTENT_PATH;
const targetRootPath = process.env.PUBLIC_CONTENT_PATH;
const contentHost = process.env.CONTENT_HOST;
const publicContentHost = process.env.PUBLIC_CONTENT_HOST;
const publicAppHost = process.env.PUBLIC_APP_HOST;

function copyAttachment(url) {
    const src = url.replace(contentHost, srcRootPath);
    const dest = url.replace(contentHost, targetRootPath);
    if (!fs.existsSync(src)) {
        console.log('  -->', src, fs.existsSync(src) ? '' : 'MISSING!');
    }
    mkdirp.sync(path.dirname(dest));
    fs.copyFileSync(src, dest);
}

function exportFeedFile(srcFilePath) {
    if (fs.existsSync(path.join(srcRootPath, srcFilePath))) {
        const feed = JSON.parse(fs.readFileSync(path.join(srcRootPath, srcFilePath)));
        if (feed.items.length !== 0 || fs.existsSync(path.join(targetRootPath, srcFilePath))) {
            // console.log('-->', srcFilePath, `[${feed.items.length}]`, feed.items.length === 0 ? 'EMPTY!' : '');

            const dirPath = path.dirname(srcFilePath);
            const name = path.basename(srcFilePath, path.extname(srcFilePath));

            mkdirp.sync(path.join(targetRootPath, dirPath));

            feed.items.forEach((item) => {
                if (item.image && _.startsWith(item.image, contentHost)) {
                    copyAttachment(item.image);
                }
                if (item.attachments) {
                    item.attachments.forEach((att) => {
                        if (_.startsWith(att.url, contentHost)) {
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
                                  image: i.image.replace(contentHost, publicContentHost),
                              }
                            : {}),
                        ...(i.attachments
                            ? {
                                  attachments: i.attachments.map((a) => ({
                                      ...a,
                                      url: a.url.replace(contentHost, publicContentHost),
                                  })),
                              }
                            : {}),
                    })),
                },
                contentPath: targetRootPath,
                contentHost: publicContentHost,
                appHost: publicAppHost,
            });
        }
    }
}

export default function () {
    yaml.safeLoad(fs.readFileSync(path.join(srcRootPath, 'public.yaml'))).forEach((globPath) =>
        glob
            .sync(globPath, { cwd: srcRootPath })
            .filter((f) => {
                const configFilePath = path.join(srcRootPath, path.dirname(f), 'config.yaml');
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
