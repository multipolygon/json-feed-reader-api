/* global process */

import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import moment from 'moment';
import writeFiles from '../utils/writeFiles.js';

const contentPath = process.env.CONTENT_PATH;
const allowedActions = ['add', 'rem'];
const allowedBuckets = ['queue', 'favourites', 'archive'];

export default function actions({ app }) {
    app.post('/actions/new', (request, response) => {
        const { feedPath, id, action, bucket } = request.body;

        if (allowedBuckets.includes(bucket) && allowedActions.includes(action)) {
            const dirPath = path.dirname(feedPath);
            if (fs.existsSync(path.join(contentPath, dirPath))) {
                const inFilePath = path.join(contentPath, dirPath, 'original.json');
                const outFilePath = path.join(contentPath, dirPath, `${bucket}.json`);
                const inFeed = fs.existsSync(inFilePath)
                    ? JSON.parse(fs.readFileSync(inFilePath))
                    : {};
                const outFeed = fs.existsSync(outFilePath)
                    ? JSON.parse(fs.readFileSync(outFilePath))
                    : { ...inFeed, items: [] };
                if (action === 'add') {
                    const item = _.find(inFeed.items, (i) => i.id === id);
                    // console.log(item);
                    outFeed.items = _.uniqBy(
                        [
                            {
                                ...item,
                                date_modified: moment().toISOString(),
                            },
                            ...outFeed.items,
                        ],
                        'id',
                    );
                } else if (action === 'rem') {
                    outFeed.items = outFeed.items.filter((i) => i.id !== id);
                }
                // console.log(outFeed);
                writeFiles({ dirPath, name: bucket, feed: outFeed });
            } else {
                console.log('Directory not found!');
            }
        }

        response.send({ message: 'ok' });
    });
}
