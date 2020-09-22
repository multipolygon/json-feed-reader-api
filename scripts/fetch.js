/* global process */

import fetch from 'node-fetch';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import glob from 'glob';
import UserAgent from 'user-agents';
import dotenv from 'dotenv';

const randomUserAgent = new UserAgent();

dotenv.config();
const contentPath = process.env.CONTENT_PATH;

function sleep() {
    return new Promise((resolve) => {
        setTimeout(resolve, 10);
    });
}

async function run() {
    let queue = 0;

    /* eslint-disable no-loop-func */
    for (const filePath of glob
        .sync(path.join(contentPath, '*', '*', '*', 'config.yaml'))
        .slice(0, 100000)) {
        // console.log(filePath);
        const config = yaml.safeLoad(fs.readFileSync(filePath));

        if (config.enabled !== false && config.disabled !== true && config.src) {
            const userAgent = randomUserAgent().toString();

            queue += 1;

            fetch(config.src, {
                headers: {
                    'User-Agent': userAgent,
                },
            })
                .then((response) => {
                    if (response.ok) {
                        response
                            .text()
                            .then((data) => {
                                fs.writeFileSync(
                                    path.join(path.dirname(filePath), 'original.txt'),
                                    data,
                                );

                                fs.writeFileSync(
                                    path.join(path.dirname(filePath), 'type.txt'),
                                    response.headers.get('content-type'),
                                );

                                queue -= 1;
                            })
                            .catch(() => {
                                console.error('DATA ERROR', filePath);
                                queue -= 1;
                            });
                    } else {
                        console.error('FAIL', response.status, filePath);
                        queue -= 1;
                    }
                })
                .catch(() => {
                    console.error('REQUEST ERROR', filePath);
                    queue -= 1;
                });
        }

        while (queue > 15) {
            await sleep();
        }
    }

    while (queue > 0) {
        await sleep();
    }

    return 'Done';
}

run().then(console.log).catch(console.error);
