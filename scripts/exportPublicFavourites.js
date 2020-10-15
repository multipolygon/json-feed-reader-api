/* global process */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import yaml from 'js-yaml';
import mkdirp from 'mkdirp';
import writeFiles from '../utils/writeFiles.js';

dotenv.config();

const srcPath = process.env.CONTENT_PATH;
const targetPath = process.env.PUBLIC_CONTENT_PATH;
const contentHost = process.env.CONTENT_HOST;
const publicContentHost = process.env.PUBLIC_CONTENT_HOST;
const publicAppHost = process.env.PUBLIC_APP_HOST;

glob.sync(path.join('*', '*', '*', 'config.yaml'), { cwd: srcPath })
    .slice(0, 1000000000000)
    .forEach((filePath) => {
        const config = yaml.safeLoad(fs.readFileSync(path.join(srcPath, filePath)));
        if (config.private === true) {
            // console.log('--> SKIP');
        } else {
            const dirPath = path.dirname(filePath);
            const archiveFilePath = path.join(srcPath, dirPath, 'favourite.json');
            if (fs.existsSync(archiveFilePath)) {
                const feed = JSON.parse(fs.readFileSync(path.join(srcPath, archiveFilePath)));
                if (
                    feed.items.length !== 0 ||
                    fs.existsSync(path.join(targetPath, dirPath, 'favourite.json'))
                ) {
                    console.log(filePath);
                    mkdirp.sync(path.join(targetPath, dirPath));
                    writeFiles({
                        dirPath,
                        name: 'favourite',
                        feed: {
                            ...feed,
                            _feed_url: {
                                src: config.src,
                            },
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
                        contentPath: targetPath,
                        contentHost: publicContentHost,
                        appHost: publicAppHost,
                    });
                    console.log('-->', feed.items.length);
                }
            }
        }
    });
