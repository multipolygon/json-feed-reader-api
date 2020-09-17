/* global process */

import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import _ from 'lodash';
import glob from 'glob';
import dotenv from 'dotenv';
import writeFiles from './utils/writeFiles.js';
import omitNull from './utils/omitNull.js';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;

const getFirst = (ary, prop) => {
    try {
        return ary.filter((x) => x[prop])[0][prop];
    } catch (e) {
        return null;
    }
};

const average = (ary) => ary.reduce((a, b) => a + b, 0) / ary.length;

const coord = (ary) =>
    ary.reduce((acc, val) => acc && Boolean(parseFloat(val)), true)
        ? ary.map((v) => Math.round(parseFloat(v) * 1000) / 1000)
        : null;

const averageCoord = (items) => {
    const coordAry = items
        .filter((i) => i._geo)
        .map((i) => i._geo.coordinates)
        .filter(Boolean);
    return coord([average(coordAry.map((i) => i[0])), average(coordAry.map((i) => i[1]))]);
};

function makeIndexFeeds({ inFilePaths, title, description, name, dirPath }) {
    const feed = inFilePaths.reduce(
        (acc, indexPath) => {
            console.log(' ->', indexPath);
            const bucketFeed = JSON.parse(fs.readFileSync(indexPath));
            if (bucketFeed.items.length !== 0) {
                return {
                    title: _.upperFirst(title || bucketFeed.title),
                    description: _.upperFirst(description || bucketFeed.description),
                    items: [
                        ...acc.items,
                        omitNull({
                            id: bucketFeed.feed_url,
                            url: bucketFeed.home_page_url,
                            title: bucketFeed.title,
                            content_text: `${bucketFeed.items.length} items`,
                            image: getFirst(bucketFeed.items, 'image'),
                            date_published: getFirst(bucketFeed.items, 'date_published'),
                            date_modified: getFirst(bucketFeed.items, 'date_published'),
                            _geo: omitNull({
                                coordinates: averageCoord(bucketFeed.items),
                            }),
                            _meta: {
                                itemCount: bucketFeed.items.length,
                            },
                        }),
                    ],
                };
            }
            return acc;
        },
        {
            items: [],
        },
    );

    console.log('   ---->', feed.items.length);

    writeFiles({
        dirPath,
        name,
        feed,
    });

    return feed;
}

function makeCombinedFeeds({ inFilePaths, title, description, name, dirPath }) {
    const feed = inFilePaths.reduce(
        (acc, indexPath) => {
            console.log(' ->', indexPath);
            const bucketFeed = JSON.parse(fs.readFileSync(indexPath));
            if (bucketFeed.items.length !== 0) {
                return {
                    title: _.upperFirst(title || bucketFeed.title),
                    description: _.upperFirst(description || bucketFeed.description),
                    items: [...acc.items, ...bucketFeed.items],
                };
            }
            return acc;
        },
        {
            items: [],
        },
    );

    console.log('   ---->', feed.items.length);

    writeFiles({
        dirPath,
        name: `${name}_all`,
        feed,
    });

    return feed;
}

function feedIndexes() {
    for (const configPath of glob.sync(path.join('*', '*', '*', 'config.yaml'), {
        cwd: contentPath,
    })) {
        const dirPath = path.dirname(configPath);
        console.log(dirPath);
        const config = yaml.safeLoad(fs.readFileSync(path.join(contentPath, configPath)));
        makeIndexFeeds({
            inFilePaths: ['inbox', 'favourites', 'archive', 'original']
                .map((bucket) => path.join(contentPath, dirPath, `${bucket}.json`))
                .filter((bucketPath) => fs.existsSync(bucketPath)),
            title: config.title,
            name: 'index',
            dirPath,
        });
    }
}

function subCategoryIndexes(bucket) {
    for (const dirPath of glob.sync(path.join('*', '*'), { cwd: contentPath })) {
        if (fs.lstatSync(path.join(contentPath, dirPath)).isDirectory()) {
            console.log(dirPath);
            makeIndexFeeds({
                inFilePaths: glob.sync(path.join(contentPath, dirPath, '*', `${bucket}.json`)),
                title: path.basename(dirPath),
                description: `All feeds in ${dirPath
                    .split(path.sep)
                    .map(_.upperFirst)
                    .join(' > ')}.`,
                name: bucket,
                dirPath,
            });
            makeCombinedFeeds({
                inFilePaths: glob.sync(path.join(contentPath, dirPath, '*', `${bucket}.json`)),
                title: path.basename(dirPath),
                description: `All items in ${dirPath
                    .split(path.sep)
                    .map(_.upperFirst)
                    .join(' > ')}.`,
                name: bucket,
                dirPath,
            });
        }
    }
}

function categoryIndexes(bucket) {
    for (const dirPath of glob.sync(path.join('*'), { cwd: contentPath })) {
        if (fs.lstatSync(path.join(contentPath, dirPath)).isDirectory()) {
            console.log(dirPath);
            makeIndexFeeds({
                inFilePaths: glob.sync(path.join(contentPath, dirPath, '*', `${bucket}.json`)),
                title: dirPath,
                description: 'All subcategories in category.',
                name: bucket,
                dirPath,
            });
            makeCombinedFeeds({
                inFilePaths: glob.sync(path.join(contentPath, dirPath, '*', `${bucket}_all.json`)),
                title: dirPath,
                description: 'All items in subcategories for category.',
                name: bucket,
                dirPath,
            });
        }
    }
}

function mainIndexes(bucket) {
    console.log(contentPath);
    console.log(bucket);
    makeIndexFeeds({
        inFilePaths: glob.sync(path.join(contentPath, '*', `${bucket}.json`)),
        title: 'Multipolygon Feeds Index',
        description: 'All categories.',
        name: bucket,
        dirPath: '.',
    });
    makeCombinedFeeds({
        inFilePaths: glob.sync(path.join(contentPath, '*', `${bucket}_all.json`)),
        title: 'Multipolygon Feeds All Items',
        description: 'All items.',
        name: bucket,
        dirPath: '.',
    });
}

feedIndexes();

['index', 'inbox', 'favourites', 'archive'].forEach((bucket) => {
    console.log('----', bucket, '----');
    subCategoryIndexes(bucket);
    categoryIndexes(bucket);
    mainIndexes(bucket);
});