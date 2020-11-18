/* global process URL */

import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import _stripTags from 'underscore.string/stripTags.js';
import _ from 'lodash';
import glob from 'glob';
import FeedParser from 'feedparser';
import dotenv from 'dotenv';
import moment from 'moment';
import Mimer from 'mimer';
import textVersion from 'textversionjs';
import MarkdownIt from 'markdown-it';
import omitNull from '../utils/omitNull.js';
import writeFiles from '../utils/writeFiles.js';

dotenv.config();

const mime = Mimer();
const markdown = new MarkdownIt({ html: true, breaks: true, linkify: false });

const contentPath = process.env.CONTENT_PATH;

const textVersionConfig = {
    headingStyle: 'hashify',
    linkProcess: (href, text) => `[${text}](${href})`,
    imgProcess: (src, alt) => `![${alt}](${src})`,
    uIndentionChar: '* ',
    oIndentionChar: '1. ',
    listIndentionTabs: 1,
    keepNbsps: true,
};

function convertToText(html) {
    return textVersion(html, textVersionConfig).replace(/[\n]+/g, '\n\n');
}

function getHtmlImages(html, rootUrl) {
    // https://stackoverflow.com/a/15013465/5165

    const src = [];

    if (html) {
        const re = /<img\s.*?src="([^">]*\/([^">]*?))".*?>/g;

        while (true) {
            const m = re.exec(html);
            // console.log(m);
            if (!m) break;
            try {
                src.push(new URL(m[1], rootUrl).href);
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
            .on('readable', function readable() {
                const stream = this;
                let eol = true;
                while (true) {
                    const item = stream.read();
                    if (item) eol = false;
                    else break;

                    feed.title = item.meta.title || 'No Title';
                    feed.description = _stripTags(item.meta.description || '').trim() || null;
                    feed.home_page_url = item.meta.link;
                    feed._feed_url = {
                        src: config.src,
                    };
                    if (item.meta.image && item.meta.image.url)
                        try {
                            feed.icon = new URL(item.meta.image.url, config.src).href;
                        } catch (e) {
                            // pass
                        }
                    if (item.meta.copyright) feed.user_comment = item.meta.copyright;

                    const attachments = item.enclosures
                        .map((e) =>
                            omitNull({
                                url: (e.url || '').replace(/\s/g, '%20'),
                                mime_type: e.type || mime.get(new URL(e.url).pathname),
                                size_in_bytes: parseInt(e.length, 10) || null,
                            }),
                        )
                        .filter((att) => _.isString(att.url) && _.isString(att.mime_type));
                    const attachmentImage = attachments.filter((a) =>
                        /^image\//.test(a.mime_type),
                    )[0];
                    const htmlImages =
                        (!item.image || !item.image.url) && !attachmentImage
                            ? getHtmlImages(item.description, config.src)
                            : [];

                    const contentText =
                        (item.description && convertToText(item.description)) ||
                        (item['media:group'] &&
                            item['media:group']['media:description'] &&
                            convertToText(item['media:group']['media:description']['#'])) ||
                        '-';

                    const contentHtml = contentText ? markdown.render(contentText) : null;

                    feed.items.push(
                        omitNull({
                            id: item.guid,
                            title: item.title,
                            content_text: contentText,
                            content_html: contentHtml,
                            url: item.link,
                            image:
                                (item.image && item.image.url) ||
                                (attachmentImage && attachmentImage.url) ||
                                htmlImages[0] ||
                                feed.icon,
                            date_published: moment(item.pubdate).format(),
                            date_modified: moment(item.date).format(),
                            tags: item.categories,
                            attachments,
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
            ..._.pick(orig, ['title', 'version', 'home_page_url', 'feed_url']),
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
                console.log('ERROR', dirPath, e);
            }
        } else {
            console.log('EMPTY', dirPath, type);
        }
    }
    return 'ok';
}

export default async function () {
    for (const configPath of glob
        .sync(path.join('*', '*', '*', 'config.yaml'), { cwd: contentPath })
        .slice(0, 1000000)) {
        await convert(path.dirname(configPath));
    }
    return 'ok';
}
