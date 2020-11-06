/* global process */

import dotenv from 'dotenv';
import fs from 'fs';

import fetchFeeds from './fetch-feeds.js';
import convertFeeds from './convert-feeds-to-json.js';
import twitter from './twitter-to-json-feed.js';
import scrapeMissingImages from './scrape-missing-images.js';
import archiveToFavourite from './export-archive-to-favourite.js';
import makeIndexes from './make-indexes.js';
import telegramToFeeds from './telegram-cache-to-feeds.js';
import exportToPublic from './export-to-public.js';

dotenv.config();

async function run() {
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
        contentPath: process.env.CONTENT_PATH,
        contentHost: process.env.CONTENT_HOST,
        appHost: process.env.APP_HOST,
        buckets: ['queue', 'favourite', 'archive', 'original'],
    });

    console.log('--PUBLIC--');

    console.log('exportToPublic...');
    exportToPublic();

    console.log('makeIndexes...');
    if (fs.existsSync(process.env.PUBLIC_CONTENT_PATH)) {
        makeIndexes({
            contentPath: process.env.PUBLIC_CONTENT_PATH,
            contentHost: process.env.PUBLIC_CONTENT_HOST,
            appHost: process.env.PUBLIC_APP_HOST,
            buckets: ['favourite'],
        });
    }

    return 'Done';
}

run().then(console.log).catch(console.error);
