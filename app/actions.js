/* global process */

import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import moment from 'moment';
import writeFiles from '../utils/writeFiles.js';

const contentPath = process.env.CONTENT_PATH;
const allowedActions = ['add', 'rem'];
const allowedBuckets = ['queue', 'favourites', 'archive'];
const nl = '\n';

export default function actions({ app }) {
    app.post('/actions/new', (request, response) => {
        const { feedPath, id, action, bucket } = request.body;
        console.log(feedPath, nl, id, nl, action, nl, bucket);
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
                    const item = {
                        ..._.find(inFeed.items, (i) => i.id === id),
                        date_modified: moment().format(),
                    };
                    console.log(item);
                    if (item) {
                        outFeed.items = _.uniqBy([item, ...outFeed.items], 'id');
                    }
                } else if (action === 'rem') {
                    outFeed.items = outFeed.items.filter((i) => i.id !== id);
                }
                // console.log(outFeed);
                writeFiles({ dirPath, name: bucket, feed: outFeed });
                console.log('->', dirPath, bucket);
            } else {
                console.log('Directory not found!');
            }
        }

        response.send({ message: 'ok' });
    });
}
