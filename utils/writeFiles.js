/* global process URL */

import path from 'path';
import jsonschema from 'jsonschema';
import fs from 'fs';
import jsonfeedToRSS from 'jsonfeed-to-rss';
import jsonfeedToAtom from 'jsonfeed-to-atom';
import _ from 'lodash';
import dotenv from 'dotenv';
import feedSchema from 'jsonfeed-schema/v1.js';
import omitNull from './omitNull.js';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;
const appHost = process.env.APP_HOST;
const contentHost = process.env.CONTENT_HOST;

const validator = new jsonschema.Validator();
const geoSchema = JSON.parse(fs.readFileSync('./utils/schemas/geo.json'));

const validate = (obj, schema) => {
    const result = validator.validate(obj, schema, { throwError: false });
    if (result.errors && result.errors.length !== 0) {
        ['property', 'message', 'instance'].forEach((i) =>
            console.log(JSON.stringify(result.errors[0][i], null, 4)),
        );
        throw new Error('Failed validation!');
    }
};

const sortFeedItems = (items) =>
    _.orderBy(
        items,
        [
            'date_published',
            'date_modified',
            '_meta.itemCount',
            '_meta.imageCount',
            '_meta.videoCount',
            '_meta.audioCount',
        ],
        ['desc', 'desc', 'desc', 'desc', 'desc', 'desc'],
    );

const PER_PAGE = 1000;

export default function ({ dirPath, name, feed }) {
    const feedUrl = new URL(path.join(dirPath, `${name}.json`), contentHost).href;
    const homePageUrl = `${appHost}?i=${encodeURIComponent(feedUrl)}`;
    const pageCount = Math.ceil(feed.items.length / PER_PAGE);
    const items = sortFeedItems(feed.items).map(i => ({
        ...i,
        _meta: {
            ...(i._meta || {}),
            audioCount: (i.attachments || []).filter((a) => /^audio\//.test(a.mime_type))
                .length,
            videoCount: (i.attachments || []).filter((a) => /^video\//.test(a.mime_type))
                .length,
            imageCount: (i.attachments || []).filter((a) => /^image\//.test(a.mime_type))
                .length,
            featured: i._archive && i._archive.favourite,
        },
    }));

    _.range(1, (pageCount || 1) + 1).forEach((page) => {
        const fileName = `${name}${page === 1 ? '' : `_${page}`}`;

        const feedPage = {
            version: 'https://jsonfeed.org/version/1',
            feed_url: feedUrl,
            _feed_url: {
                ...(feed._feed_url || {}),
                rss: feedUrl.replace(/\.json\b/, '.rss.xml'),
                atom: feedUrl.replace(/\.json\b/, '.atom.xml'),
            },
            ...feed,
            home_page_url: feed.home_page_url || homePageUrl,
            ...(page < pageCount
                ? {
                    next_url: new URL(
                        ['.', dirPath, `${name}_${page + 1}.json`].join('/'),
                        contentHost,
                    ).href,
                }
                : {}),
            items: items.slice((page - 1) * PER_PAGE, page * PER_PAGE),
            _meta: {
                itemCount: feed.items.length,
                pageNumber: page,
                pageCount,
            },
        };

        if (page === 1) {
            validate(feedPage, feedSchema);
        }

        fs.writeFileSync(
            path.join(contentPath, dirPath, `${fileName}.json`),
            JSON.stringify(feedPage, null, 1),
        );

        fs.writeFileSync(
            path.join(contentPath, dirPath, `${fileName}.rss.xml`),
            jsonfeedToRSS(feedPage, {
                feedURLFn: (url) => url.replace(/\.json\b/, '.rss.xml'),
            }),
        );

        fs.writeFileSync(
            path.join(contentPath, dirPath, `${fileName}.atom.xml`),
            jsonfeedToAtom(feedPage, {
                feedURLFn: (url) => url.replace(/\.json\b/, '.atom.xml'),
            }),
        );
    });

    if (feed.items.length !== 0) {
        const geo = {
            type: 'FeatureCollection',
            features: feed.items
                .filter(({ _geo }) => _geo && _geo.coordinates)
                .map(({ id, url, title: itemTitle, image, _geo, _meta }) => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: _geo.coordinates,
                    },
                    properties: omitNull({
                        id,
                        url,
                        date: _meta.date,
                        title: itemTitle,
                        image,
                    }),
                })),
        };

        if (geo.features.length !== 0) {
            validate(geo, geoSchema);
            fs.writeFileSync(
                path.join(contentPath, dirPath, `${name}.geo.json`),
                JSON.stringify(geo, null, 1),
            );
        }
    }
}
