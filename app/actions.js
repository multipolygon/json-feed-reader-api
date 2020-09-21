/* global process */

import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import moment from 'moment';
import writeFiles from '../utils/writeFiles.js';

const contentPath = process.env.CONTENT_PATH;
const allowedActions = ['add', 'rem'];
const allowedBuckets = ['queue', 'archive'];
const nl = '\n';

export default function actions({ app }) {
    app.post('/actions/new', (request, response) => {
        const { feedPath, id, action, bucket, favourite } = request.body;
        console.log('-----------------------------------------------------');
        console.log(feedPath, nl, id, nl, action, nl, bucket, nl, favourite);

        if (allowedBuckets.includes(bucket) && allowedActions.includes(action)) {
            const dirPath = path.dirname(feedPath);
            if (fs.existsSync(path.join(contentPath, dirPath))) {
                const origFilePath = path.join(contentPath, dirPath, 'original.json');
                const queueFilePath = path.join(contentPath, dirPath, 'queue.json');
                const archiveFilePath = path.join(contentPath, dirPath, 'archive.json');

                const origFeed = fs.existsSync(origFilePath)
                    ? JSON.parse(fs.readFileSync(origFilePath))
                    : { items: [] };
                const queueFeed =
                    bucket !== 'queue' && fs.existsSync(queueFilePath)
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

                        console.log(item);

                        outFeed.items = _.uniqBy([item, ...outFeed.items], 'id');
                    }
                } else if (action === 'rem') {
                    outFeed.items = outFeed.items.filter((i) => i.id !== id);
                }

                // console.log(outFeed);
                writeFiles({ dirPath, name: bucket, feed: outFeed });
                console.log('->', dirPath, '::', bucket, outFeed.items.length);

                if (favourite !== undefined) {
                    const favouritesFeed = {
                        ...outFeed,
                        items: outFeed.items.filter((i) => i._archive && i._archive.favourite),
                    };
                    writeFiles({ dirPath, name: 'favourites', feed: favouritesFeed });
                    console.log('->', dirPath, '::', 'favourites', favouritesFeed.items.length);
                }
            } else {
                console.log('Directory not found!');
            }
        }

        response.send({ message: 'ok' });
    });
}
