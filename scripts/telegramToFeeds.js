/* global URL process */

import fs from 'fs';
import path from 'path';
import glob from 'glob';
import dotenv from 'dotenv';
import yaml from 'js-yaml';
import mkdirp from 'mkdirp';
import _ from 'lodash';
import moment from 'moment';
import Mimer from 'mimer';
import MarkdownIt from 'markdown-it';
import writeFiles from '../utils/writeFiles.js';
import omitNull from '../utils/omitNull.js';
import { primaryId, fileNameSnakeCase } from './telegramUtils.js';

dotenv.config();
const contentPath = process.env.CONTENT_PATH;
const contentHost = process.env.CONTENT_HOST;

const mime = Mimer();
const markdown = new MarkdownIt({ html: true, breaks: true, linkify: true });

const parseTags = (text, entities) => {
    if (text && entities) {
        return entities
            .filter((i) => i.type === 'hashtag')
            .map((i) => ({ text, tag: text.slice(i.offset + 1, i.offset + i.length), ...i }))
            .map((i) => i.tag);
    }
    return [];
};

const parsePhotos = (photos, dirPath, index) => {
    if (photos) {
        const photo = _.sortBy(photos, 'file_size')[
            index !== undefined ? index : photos.length - 1
        ];
        const filePath = glob.sync(
            path.join(dirPath.replace('_telegram', '_attachments'), `${photo.file_unique_id}.*`),
            {
                cwd: contentPath,
            },
        )[0];
        return [
            {
                url: new URL(filePath, contentHost).href,
                mime_type: mime.get(filePath),
                size_in_bytes: photo.file_size,
                _image: {
                    width: photo.width,
                    height: photo.height,
                },
            },
        ];
    }
    return [];
};

const parseVideo = (video, dirPath) => {
    if (video) {
        const filePath = glob.sync(
            path.join(dirPath.replace('_telegram', '_attachments'), `${video.file_unique_id}.*`),
            {
                cwd: contentPath,
            },
        )[0];
        return [
            {
                url: new URL(filePath, contentHost).href,
                mime_type: video.mime_type || mime.get(filePath),
                size_in_bytes: video.file_size,
                _video: {
                    duration: video.duration,
                    width: video.width,
                    height: video.height,
                },
            },
        ];
    }
    return [];
};

const parseDocument = (doc, dirPath) => {
    if (doc) {
        const filePath = path.join(
            dirPath.replace('_telegram', '_attachments'),
            fileNameSnakeCase(doc.file_name),
        );
        return [
            {
                url: new URL(filePath, contentHost).href,
                mime_type: mime.get(filePath),
                size_in_bytes: doc.file_size,
            },
        ];
    }
    return [];
};

const items = {};

_.sortBy(
    glob.sync(path.join('me', 'blog', '_telegram', '*', '*', 'message.json'), { cwd: contentPath }),
    (i) => parseInt(_.last(path.basename(i).split(path.sep)))
)
    .forEach((filePath) => {
        console.log(filePath);
        const message = JSON.parse(fs.readFileSync(path.join(contentPath, filePath)));
        const id = primaryId(message);
        const tags = [
            ...parseTags(message.text, message.entities),
            ...parseTags(message.caption, message.caption_entities),
        ];
        // console.log(tags);
        const image = items[id] && items[id].image || parsePhotos(message.photo, path.dirname(filePath), 0)[0];
        const attachments = [
            ...((items[id] && items[id].attachments) || []),
            ...parsePhotos(message.photo, path.dirname(filePath)),
            ...parseVideo(message.video, path.dirname(filePath)),
            ...parseDocument(message.document, path.dirname(filePath)),
        ];
        const text =
            [
                (items[id] && items[id].content_text) || null,
                (message.text || message.caption || '').replace(/#[a-z0-9_]+/g, ''),
            ]
                .filter(Boolean)
                .join('\n\n') || tags.join(', ');
        items[id] = omitNull({
            id,
            date_published: moment.unix(message.date).format(),
            date_modified: moment.unix(message.date).format(),
            image: (image && image.url) || null,
            ...(items[id] || {}),
            title: _.truncate(text, { length: 80 }),
            content_text: text,
            content_html: markdown.render(text),
            author: {
                name: 'Multipolygon',
                url: 'https://blog.multipolygon.net',
            },
            attachments,
            tags: _.uniq([...((items[id] && items[id].tags) || []), ...tags]),
            _archive: {
                telegram: id,
            },
        });
    });

const groups = Object.values(items)
    .filter((i) => i.title || (i.attachments && i.attachments.length !== 0))
    .reduce(
        (acc, i) => ({
            ...acc,
            [(i.tags && i.tags[0]) || 'untagged']: [
                ...(acc[(i.tags && i.tags[0]) || 'untagged'] || []),
                i,
            ],
        }),
        {},
    );

// console.log(JSON.stringify(groups, null, 4));

Object.keys(groups).forEach((tag) => {
    const dirPath = path.join(contentPath, 'me', 'blog', tag);
    mkdirp.sync(dirPath);
    const configFilePath = path.join(dirPath, 'config.yaml');
    const config = fs.existsSync(configFilePath)
        ? yaml.safeLoad(fs.readFileSync(configFilePath))
        : {
              title: _.startCase(tag),
          };
    if (!fs.existsSync(configFilePath)) {
        fs.writeFileSync(configFilePath, yaml.safeDump(config));
    }
    const feed = omitNull({
        title: config.title,
        description: config.description,
        items: groups[tag].map((i) => ({
            ...i,
            title: i.title || moment(i.created_at).format('Do MMM'),
            content_text: i.content_text || '-',
        })),
    });
    writeFiles({
        dirPath: path.join('me', 'blog', tag),
        name: 'original',
        feed: omitNull(feed),
    });
});
