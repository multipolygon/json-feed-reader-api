/* global process */

import dotenv from 'dotenv';
import makeIndexes from './make-indexes.js';

dotenv.config();

async function run() {
    makeIndexes({
        contentPath: process.env.CONTENT_PATH,
        contentHost: process.env.CONTENT_HOST,
        appHost: process.env.APP_HOST,
        buckets: ['queue', 'favourite', 'archive', 'original'],
    });
}

run().then(console.log).catch(console.error);
