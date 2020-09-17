/* global process */

import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import _stripTags from 'underscore.string/stripTags.js';
import yargs from 'yargs';
import _ from 'lodash';
import glob from 'glob';
import FeedParser from 'feedparser';
import dotenv from 'dotenv';
import moment from 'moment';
import { hideBin } from 'yargs/helpers';
import omitNull from './utils/omitNull.js';
import writeFiles from './utils/writeFiles.js';

dotenv.config();

const { argv } = yargs(hideBin(process.argv));

const contentPath = process.env.CONTENT_PATH;

function loadXml(feedPath) {
    return new Promise((resolve) => {
        const feed = { items: [] };
        fs.createReadStream(feedPath)
            .on('error', (error) => {
                console.error(error);
                resolve(null);
            })
            .pipe(new FeedParser())
            .on('error', (error) => {
                console.error(error);
                resolve(null);
            })
            .on('meta', (meta) => {
                feed.title = meta.title || 'No Title';
                feed.description = _stripTags(meta.description || '').trim() || null;
                // feed.home_page_url = meta.xmlurl || meta.link;
                // if (meta.image && meta.image.url)
                //     feed.icon = meta.image.url;
                // if (meta.favicon)
                //     feed.favicon = meta.favicon;
                if (meta.copyright) feed.user_comment = meta.copyright;
            })
            .on('readable', function readable() {
                const stream = this;
                let eol = true;
                while (true) {
                    const item = stream.read();
                    if (item) eol = false;
                    else break;
                    // console.log('  -->', item.title);
                    feed.items.push(
                        omitNull({
                            id: item.guid,
                            title: item.title,
                            content_text: (item.description && _stripTags(item.description)) || '-',
                            url: item.origlink || item.url,
                            external_url: item.origlink || item.url,
                            image: item.image.url,
                            date_published: moment(item.pubdate).toISOString(),
                            date_modified: moment(item.date).toISOString(),
                            tags: item.categories,
                            attachments: item.enclosures
                                .map((e) =>
                                    omitNull({
                                        url: (e.url || '').replace(/\s/g, '%20'),
                                        mime_type: e.type,
                                        size_in_bytes: parseInt(e.length, 10) || null,
                                    }),
                                )
                                .filter(
                                    (att) => _.isString(att.url) && _.isString(att.mime_type)
                                ),
                        }),
                    );
                }
                if (eol) {
                    resolve(omitNull(feed));
                }
            });
    });
}

function jsonParse(buf) {
    try {
        return JSON.parse(buf);
    } catch (e) {
        console.error('Error loading JSON');
        return null;
    }
}

function loadJson(feedPath) {
    const orig = jsonParse(fs.readFileSync(feedPath));
    if (orig) {
        return omitNull({
            ..._.pick(orig, ['version', 'home_page_url', 'feed_url']),
            items: (orig.items || []).map((i) =>
                _.pick(
                    {
                        ...i,
                        content_text: _stripTags(i.content_text || i.content_html),
                        attachments: (i.attachments || []).filter(
                            (att) => att.mime_type && /(audio|video)/.test(att.mime_type),
                        ),
                    },
                    [
                        'id',
                        'title',
                        'content_text',
                        'url',
                        'external_url',
                        'image',
                        'date_published',
                        'date_modified',
                        'tags',
                        'attachments',
                    ],
                ),
            ),
        });
    }
    return orig;
}

async function convert(dirPath) {
    // console.log(dirPath);
    const config = yaml.safeLoad(fs.readFileSync(path.join(contentPath, dirPath, 'config.yaml')));
    const feedPath = path.join(contentPath, dirPath, 'original.txt');
    const typePath = path.join(contentPath, dirPath, 'type.txt');
    if (fs.existsSync(feedPath) && fs.existsSync(typePath)) {
        const type = fs.readFileSync(typePath).toString();
        // console.log(' ->', type);
        const feed =
            (/xml/.test(type) && (await loadXml(feedPath))) ||
            (/json/.test(type) && loadJson(feedPath)) ||
            null;
        // console.log(feed);
        if (feed && feed.items) {
            if (config.title) feed.title = config.title;
            try {
                writeFiles({
                    dirPath,
                    name: 'original',
                    feed,
                });
            } catch (e) {
                console.log(dirPath);
                console.error(e);
                // console.log('----------------------');
                // console.log(JSON.stringify(feed, null, 4));
                // console.log('----------------------');
                // break;
                console.log('---');
            }
        } else {
            console.log(dirPath);
            console.log(' -> EMPTY!', type);
            console.log('---');
        }
    } else {
        // console.error('File "original.txt" not found!');
    }
    return 'ok';
}

async function all() {
    console.log('---');
    for (const configPath of glob
        .sync(path.join('*', '*', '*', 'config.yaml'), { cwd: contentPath })
        .slice(0, 1000000)) {
        await convert(path.dirname(configPath));
    }
    return 'ok';
}

(argv.f ? convert(path.relative(contentPath, argv.f)) : all())
    .then(console.log)
    .catch(console.error);