import fetch from 'node-fetch';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import glob from 'glob';
import UserAgent from 'user-agents';

const randomUserAgent = new UserAgent();

// const fileTypes = {
//     'text/xml': 'xml',
//     'application/xml': 'xml',
//     'application/atom+xml': 'atom.xml',
//     'application/rss+xml': 'rss.xml',
//     'application/json': 'json',
//     'text/html': 'html',
// };

function sleep() {
    return new Promise((resolve) => {
        setTimeout(resolve, 10);
    });
}

async function run() {
    let queue = 0;

    for (const filePath of glob
        .sync(path.join('public', 'feeds', '*', '*', '*', 'config.yaml'))
        .slice(0, 100000)) {
        // console.log(filePath);
        const config = yaml.safeLoad(fs.readFileSync(filePath));

        const userAgent = randomUserAgent().toString();

        /* eslint-disable no-loop-func */
        const done = (result) => {
            console.log(filePath, '\n  -> ', config.src, '\n     -> ', result);
            queue -= 1;
        };
        /* eslint-disable no-loop-func */

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

                            done('HIT');
                        })
                        .catch(() => {
                            done('DATA ERROR');
                        });
                } else {
                    done(`MISS ${response.status}`);
                }
            })
            .catch(() => {
                done('RESPONSE ERROR');
            });

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
