/* global process */
// https://www.npmjs.com/package/twitter
// https://developer.twitter.com/en/docs/twitter-api/v1/tweets/timelines/api-reference/get-statuses-user_timeline

import dotenv from 'dotenv';
import Twitter from 'twitter';
import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs';
import moment from 'moment';
import yaml from 'js-yaml';
import _ from 'lodash';
import omitNull from '../utils/omitNull.js';
import writeFiles from '../utils/writeFiles.js';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;

const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
});

const config = yaml.safeLoad(fs.readFileSync(path.join(contentPath, 'twitter.yaml')));

function get(screenName) {
    return new Promise((resolve) => {
        console.log('Get:', screenName);
        const options = config[screenName] || {};
        const params = {
            screen_name: screenName,
            count: 200,
            trim_user: false,
            exclude_replies: !Boolean(options.replies),
            include_rts: Boolean(options.retweets),
            tweet_mode: 'extended',
        };
        client.get('statuses/user_timeline', params, (error, tweets) => {
            if (error) {
                resolve([]);
            } else {
                resolve(tweets);
            }
        });
    });
}

function filePath(screenName, filename) {
    return path.join(
        contentPath,
        'twitter',
        'twitter',
        screenName.toLowerCase(),
        filename || 'tweets.json',
    );
}

async function getAll() {
    for (const screenName of Object.keys(config)) {
        const data = await get(screenName);
        mkdirp.sync(path.dirname(filePath(screenName)));
        fs.writeFileSync(filePath(screenName), JSON.stringify(data, null, 1));
        console.log('-->', filePath(screenName));
    }
}

const itemUrl = (i, screenName) =>
    `https://twitter.com/${
        (i.retweeted_status && i.retweeted_status.user && i.retweeted_status.user.screen_name) ||
        screenName
    }/status/${(i.retweeted_status && i.retweeted_status.id_str) || i.id_str}`;

const itemDate = (i) => moment(i.created_at, 'dd MMM DD HH:mm:ss ZZ YYYY', 'en').format();

const itemImage = (i) => {
    return (
        (i &&
            i.entities.media &&
            i.entities.media[0] &&
            i.entities.media[0].type === 'photo' &&
            i.entities.media[0].media_url) ||
        null
    );
};

const itemAttachments = (i) =>
    (i &&
        i.extended_entities &&
        i.extended_entities.media && [
            ...(i.extended_entities.media
                .filter((m) => m.type === 'video')
                .map((m) => ({
                    url: _.last(m.video_info.variants).url,
                    mime_type: _.last(m.video_info.variants).content_type,
                    _video: {
                        aspect_ratio: m.video_info.aspect_ratio,
                    },
                })) || []),
            ...((i.extended_entities.media.filter((m) => m.type === 'video').length === 0 &&
                i.extended_entities.media
                    .filter((m) => m.type === 'photo')
                    .map((m) => ({
                        url: m.media_url,
                        mime_type: 'image/something',
                    }))) ||
                []),
        ]) ||
    null;

const itemMedia = (i) =>
    omitNull({
        image: itemImage(i),
        attachments: itemAttachments(i),
    });

function convertAll() {
    for (const screenName of Object.keys(config)) {
        const data = JSON.parse(fs.readFileSync(filePath(screenName)));
        const feed = {
            version: 'https://jsonfeed.org/version/1',
            title: `@${screenName}`,
            feed_url: `https://twitter.com/${screenName}`,
            home_page_url: `https://twitter.com/${screenName}`,
            items: data.map((i) =>
                omitNull({
                    id: i.id_str,
                    title: _.truncate(i.full_text, { length: 140 }),
                    content_text:
                        (i.retweeted_status && i.retweeted_status.full_text) || i.full_text,
                    url: itemUrl(i, screenName),
                    date_published: itemDate(i),
                    date_modified: itemDate(i),
                    ...itemMedia(i),
                    ...itemMedia(i.retweeted_status),
                }),
            ),
        };
        if (feed && feed.items) {
            try {
                writeFiles({
                    dirPath: path.join('twitter', 'twitter', screenName.toLowerCase()),
                    name: 'original',
                    feed,
                });
            } catch (e) {
                console.log('ERROR', screenName);
            }
        } else {
            console.log('EMPTY', screenName);
        }
    }
}

async function run() {
    await getAll();
    convertAll();
    return 'Done';
}

run().then(console.log).catch(console.error);
