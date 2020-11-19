/* global process */

import dotenv from 'dotenv';
import fs from 'fs';
import execute from '@getvim/execute';
import path from 'path';

import fetchFeeds from './fetch-feeds.js';
import convertFeeds from './convert-feeds-to-json.js';
import twitter from './twitter-to-json-feed.js';
import scrapeMissingImages from './scrape-missing-images.js';
import archiveToFavourite from './export-archive-to-favourite.js';
import makeIndexes from './make-indexes.js';
import telegramToFeeds from './telegram-cache-to-feeds.js';
import exportToPublic from './export-to-public.js';

dotenv.config();

const {
    APP_HOST,
    CONTENT_HOST,
    CONTENT_PATH,
    PUBLIC_APP_HOST,
    PUBLIC_CONTENT_HOST,
    PUBLIC_CONTENT_PATH,
} = process.env;

const exec = execute.execute;

async function run() {
    console.log('Git commit feeds...');
    console.log(
        await exec(
            `cd ${CONTENT_PATH} && git add . && git commit -m - && git push || echo 'no changes'`,
        ),
    );

    console.log('fetchFeeds...');
    await fetchFeeds();

    console.log('convertFeeds...');
    await convertFeeds();

    console.log('twitter...');
    await twitter();

    console.log('scrapeMissingImages...');
    await scrapeMissingImages();

    console.log('archiveToFavourite...');
    archiveToFavourite();

    console.log('telegramToFeeds...');
    telegramToFeeds();

    console.log('makeIndexes...');
    makeIndexes({
        contentPath: CONTENT_PATH,
        contentHost: CONTENT_HOST,
        appHost: APP_HOST,
        buckets: ['queue', 'favourite', 'archive', 'original'],
    });

    console.log('--PUBLIC--');

    console.log('rm favourite*...');
    await exec(`rm ${path.join(PUBLIC_CONTENT_PATH, '*/*/*/favourite*')}`);
    await exec(`rm ${path.join(PUBLIC_CONTENT_PATH, '*/*/favourite*')}`);
    await exec(`rm ${path.join(PUBLIC_CONTENT_PATH, '*/favourite*')}`);

    console.log('exportToPublic...');
    exportToPublic();

    console.log('makeIndexes...');
    if (fs.existsSync(PUBLIC_CONTENT_PATH)) {
        makeIndexes({
            contentPath: PUBLIC_CONTENT_PATH,
            contentHost: PUBLIC_CONTENT_HOST,
            appHost: PUBLIC_APP_HOST,
            buckets: ['favourite'],
        });
    }

    console.log('AWS S3 Sync public feeds...');
    console.log(await exec(`cd ${PUBLIC_CONTENT_PATH} && ./sync.sh`));

    return 'Done';
}

run().then(console.log).catch(console.error);
