/* global process */

import fs from 'fs';
import yaml from 'js-yaml';
import { getUsername } from './utils/auth.js';

export default function ({ app }) {
    const contentPath = process.env.CONTENT_PATH;
    const contentHost = process.env.CONTENT_HOST;

    app.post('/feed-config', (request, response) => {
        const username = getUsername(request);
        if (!username) {
            response.status(401).send({ message: 'Please log in.' });
        } else {
            const { configUrl, config } = request.body;
            console.log({ configUrl, config });
            let configObj;
            try {
                configObj = yaml.safeLoad(config);
            } catch (e) {
                response.status(422).send({ message: 'YAML load error!' });
            }
            if (configObj) {
                const configPath = configUrl.replace(contentHost, contentPath);
                if (!fs.existsSync(configPath)) {
                    response.status(422).send({ message: 'File does not exist!' });
                } else {
                    fs.writeFileSync(configPath, yaml.safeDump(configObj));
                    response.send({ message: 'Saved.' });
                }
            }
        }
    });
}
