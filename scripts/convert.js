/* global process URL */

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

function htmlImages(html) {
    // https://stackoverflow.com/a/15013465/5165

    const src = [];

    if (html) {
        const re = /<img\s.*?src="([^">]*\/([^">]*?))".*?>/g;

        while (true) {
            const m = re.exec(html);
            // console.log(m);
            if (!m)
                break;
            try {
                src.push( new URL(m[1]).href );
            } catch (e) {
                console.log(' -> Invalid URL:', m[1]);
            }
        }
    }

    return src;
}

function loadXml(feedPath, config) {
    return new Promise((resolve) => {
        const feed = {
            version: null,
            feed_url: null,
            title: null,
            description: null,
            home_page_url: null,
            items: [],
        };
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
                feed.home_page_url = meta.link;
                feed._original = { url: meta.xmlurl };
                // feed.feed_url = meta.xmlurl;
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
                    // console.log('  -->', item.link);
                    const images = config.html_images ? htmlImages(item.description) : [];
                    const attachments = [
                        ...item.enclosures
                            .map((e) =>
                                 omitNull({
                                     url: (e.url || '').replace(/\s/g, '%20'),
                                     mime_type: e.type,
                                     size_in_bytes: parseInt(e.length, 10) || null,
                                 }),
                                )
                            .filter((att) => _.isString(att.url) && _.isString(att.mime_type)),
                        ...images.map(i => ({ url: i, mime_type: 'image/something' })),
                    ];
                    feed.items.push(
                        omitNull({
                            id: item.guid,
                            title: item.title,
                            content_text:
                            (item.description && _stripTags(item.description)) ||
                                (item['media:group'] &&
                                 item['media:group']['media:description'] &&
                                 _stripTags(item['media:group']['media:description']['#'])) ||
                                '-',
                            url: item.link,
                            image: item.image.url || images[0],
                            date_published: moment(item.pubdate).toISOString(),
                            date_modified: moment(item.date).toISOString(),
                            tags: item.categories,
                            attachments,
                            _meta: {
                                audioCount: attachments.filter(i => /^audio\//.test(i.mime_type)).length,
                                videoCount: attachments.filter(i => /^video\//.test(i.mime_type)).length,
                                imageCount: attachments.filter(i => /^image\//.test(i.mime_type)).length,
                            },
                            _youtube: item['yt:videoid']
                                ? {
                                    id: item['yt:videoid']['#'],
                                    width: item['media:group']['media:content']['@'].width,
                                    height: item['media:group']['media:content']['@'].height,
                                }
                            : null,
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
    if (
        config.enabled !== false &&
            config.disabled !== true &&
            fs.existsSync(feedPath) &&
            fs.existsSync(typePath)
    ) {
        const type = fs.readFileSync(typePath).toString();
        // console.log(' ->', type);
        const feed =
              ((config.type === 'xml' || /xml/.test(type)) && (await loadXml(feedPath, config))) ||
              ((config.type === 'json' || /json/.test(type)) && loadJson(feedPath)) ||
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
            }
        } else {
            console.log('EMPTY', dirPath, type);
        }
    }
    return 'ok';
}

async function all() {
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
