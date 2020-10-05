/* global process URL */
/* eslint-disable no-loop-func */
/* eslint-disable no-param-reassign */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import _ from 'lodash';
import ogs from 'open-graph-scraper';
import UserAgent from 'user-agents';
import writeFiles from '../utils/writeFiles.js';

const randomUserAgent = new UserAgent();
dotenv.config();

const contentPath = process.env.CONTENT_PATH;

async function run() {
    for (const bucket of ['archive']) {
        for (const feedPath of glob
            .sync(path.join('*', '*', '*', `${bucket}.json`), { cwd: contentPath })
            .slice(0, 1000000)) {
            console.log(feedPath);
            const feed = JSON.parse(fs.readFileSync(path.join(contentPath, feedPath)));

            await Promise.all(
                feed.items.map((item) => {
                    const url = item.external_url || item.url;
                    if (url && !item.image && !item._scrape_missing_images) {
                        return ogs({
                            url,
                            ogImageFallback: false,
                            headers: { 'User-Agent': randomUserAgent().toString() },
                        })
                            .then(({ result }) => {
                                if (result && result.success && result.ogImage) {
                                    const ogImage = _.isArray(result.ogImage)
                                        ? result.ogImage[0]
                                        : result.ogImage;
                                    if (ogImage && ogImage.url) {
                                        item.image = new URL(ogImage.url, item.url).href;
                                        console.log(item.url);
                                        console.log('   ->', item.image.slice(0, 100));
                                    } else {
                                        item._scrape_missing_images = { noimage: true };
                                    }
                                } else {
                                    item._scrape_missing_images = { noimage: true };
                                }
                            })
                            .catch((e) => {
                                item._scrape_missing_images = { ignore: true };
                                console.log(e);
                            });
                    }
                    return undefined;
                }),
            );

            writeFiles({
                dirPath: path.dirname(feedPath),
                name: bucket,
                feed,
            });

            console.log('Done:', feedPath);
            console.log('--------------------------------');
        }
    }

    return 'Ok.';
}

run().then(console.log).catch(console.error);
