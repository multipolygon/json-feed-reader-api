/* global process URL */
/* eslint-disable no-loop-func */
/* eslint-disable no-param-reassign */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import _ from 'lodash';
import ogs from 'open-graph-scraper';
import writeFiles from '../utils/writeFiles.js';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;

function sleep() {
    return new Promise((resolve) => {
        setTimeout(resolve, 1000);
    });
}

async function run() {
    let queue = 0;

    for (const feedPath of glob
        .sync(path.join('*', '*', '*', 'archive.json'), { cwd: contentPath })
        .slice(0, 1000000)) {
        console.log(feedPath);
        const feed = JSON.parse(fs.readFileSync(path.join(contentPath, feedPath)));
        let modified = false;
        Promise.all(
            feed.items.map((item) => {
                if (item._archive && item._archive.favourite && item.url && !item.image) {
                    // console.log(' ->', item.url);
                    queue += 1;
                    return ogs({ url: item.url })
                        .then(({ result }) => {
                            if (result && result.success && result.ogImage) {
                                const ogImage = _.isArray(result.ogImage)
                                    ? result.ogImage[0]
                                    : result.ogImage;
                                if (ogImage && ogImage.url) {
                                    item.image = new URL(ogImage.url, item.url).href;
                                    console.log(item.url);
                                    console.log('   ->', item.image);
                                    modified = true;
                                }
                            }
                            queue -= 1;
                        })
                        .catch((e) => {
                            queue -= 1;
                            console.log(e);
                        });
                }
                return undefined;
            }),
        ).then(() => {
            if (modified) {
                console.log('Done:', feedPath);
                writeFiles({
                    dirPath: path.dirname(feedPath),
                    name: 'archive',
                    feed,
                });
                writeFiles({
                    dirPath: path.dirname(feedPath),
                    name: 'favourite',
                    feed: {
                        ...feed,
                        items: feed.items.filter((i) => i._archive && i._archive.favourite),
                    },
                });
            }
        });

        while (queue > 3) {
            await sleep();
        }
    }

    while (queue > 0) {
        await sleep();
    }

    return 'Ok.';
}

run().then(console.log).catch(console.error);
