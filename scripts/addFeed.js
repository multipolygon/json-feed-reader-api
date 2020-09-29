/* global process */

import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import yargs from 'yargs';
import dotenv from 'dotenv';
import { hideBin } from 'yargs/helpers';
import mkdirp from 'mkdirp';
import _ from 'lodash';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;
const { argv } = yargs(hideBin(process.argv));
const { cat, sub, id, src } = argv;

console.log({ cat, sub, id, src });

if (cat && sub && id && src) {
    const configDirPath = path.join(
        contentPath,
        _.snakeCase(cat),
        _.snakeCase(sub),
        _.snakeCase(id),
    );
    const configFilePath = path.join(configDirPath, 'config.yaml');
    console.log('-->', configFilePath);
    if (!fs.existsSync(configFilePath)) {
        mkdirp.sync(configDirPath);
        fs.writeFileSync(
            configFilePath,
            yaml.safeDump({
                src,
            }),
        );
        console.log('Saved.');
    } else {
        console.error('Already exists!!!');
    }
}
