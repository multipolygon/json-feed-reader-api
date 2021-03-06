/* global process */

import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import moment from 'moment';
import writeFiles from '../utils/writeFiles.js';
import { getUsername } from './utils/auth.js';

const allowedActions = ['add', 'rem'];
const allowedBuckets = ['queue', 'archive'];

export default function ({ app }) {
    const contentPath = process.env.CONTENT_PATH;

    app.post('/feed-item-action', (request, response) => {
        const username = getUsername(request);
        if (!username) {
            response.status(401).send({ message: 'Please log in.' });
        } else {
            const { feedPath, id, action, bucket, favourite } = request.body;
            console.log({ feedPath, id, action, bucket, favourite });

            if (allowedBuckets.includes(bucket) && allowedActions.includes(action)) {
                const dirPath = path.dirname(feedPath);
                if (fs.existsSync(path.join(contentPath, dirPath))) {
                    const origFilePath = path.join(contentPath, dirPath, 'original.json');
                    const queueFilePath = path.join(contentPath, dirPath, 'queue.json');
                    const archiveFilePath = path.join(contentPath, dirPath, 'archive.json');

                    const origFeed = fs.existsSync(origFilePath)
                        ? JSON.parse(fs.readFileSync(origFilePath))
                        : { items: [] };
                    const queueFeed = fs.existsSync(queueFilePath)
                        ? JSON.parse(fs.readFileSync(queueFilePath))
                        : { ...origFeed, items: [] };
                    const archiveFeed = fs.existsSync(archiveFilePath)
                        ? JSON.parse(fs.readFileSync(archiveFilePath))
                        : { ...origFeed, items: [] };

                    const outFeed = bucket === 'queue' ? queueFeed : archiveFeed;

                    if (action === 'add') {
                        const origItem = _.find(origFeed.items, (i) => i.id === id);
                        const queueItem = _.find(queueFeed.items, (i) => i.id === id);
                        const archiveItem = _.find(archiveFeed.items, (i) => i.id === id);

                        const item = origItem || queueItem || archiveItem;

                        if (item) {
                            item._archive = {
                                ...((queueItem && queueItem._archive) || {}),
                                ...((archiveItem && archiveItem._archive) || {}),
                                ...(favourite === undefined ? {} : { favourite }),
                                [bucket === 'archive' ? 'log' : bucket]: _.sortedUniq(
                                    [
                                        ...((queueItem &&
                                            queueItem._archive &&
                                            queueItem._archive[bucket]) ||
                                            []),
                                        ...((archiveItem &&
                                            archiveItem._archive &&
                                            archiveItem._archive[bucket]) ||
                                            []),
                                        moment().startOf('day').format(),
                                    ].sort(),
                                ),
                            };

                            console.log({ item: item._archive });

                            outFeed.items = _.uniqBy([item, ...outFeed.items], 'id');
                        }
                    } else if (action === 'rem') {
                        outFeed.items = outFeed.items.filter((i) => i.id !== id);
                    }

                    const origMeta = {
                        ...(origFeed && origFeed.home_page_url
                            ? { home_page_url: origFeed.home_page_url }
                            : {}),
                        ...(origFeed && origFeed._feed_url
                            ? { _feed_url: origFeed._feed_url }
                            : {}),
                    };

                    writeFiles({
                        dirPath,
                        name: bucket,
                        feed: {
                            ...outFeed,
                            ...origMeta,
                        },
                    });
                    console.log({ dirPath, bucket, length: outFeed.items.length });

                    if (favourite !== undefined) {
                        const favouriteFeed = {
                            ...outFeed,
                            ...origMeta,
                            items: outFeed.items.filter((i) => i._archive && i._archive.favourite),
                        };
                        writeFiles({ dirPath, name: 'favourite', feed: favouriteFeed });
                        console.log('->', dirPath, '::', 'favourite', favouriteFeed.items.length);
                    }

                    if (action === 'add' && bucket === 'archive') {
                        const newQueueFeed = {
                            ...queueFeed,
                            ...origMeta,
                            items: queueFeed.items.filter((i) => i.id !== id),
                        };
                        if (queueFeed.items.length > newQueueFeed.items.length) {
                            writeFiles({ dirPath, name: 'queue', feed: newQueueFeed });
                            console.log('->', dirPath, '::', 'queue', newQueueFeed.items.length);
                        }
                    }
                } else {
                    console.log('Directory not found!');
                }
            }

            response.send({ message: 'ok' });
        }
    });
}
