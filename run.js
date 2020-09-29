/* global process */

import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';
import useragent from 'express-useragent';

import auth from './app/auth.js';
import feedItemAction from './app/feed-item-action.js';
import feedConfig from './app/feed-config.js';

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const app = express();

app.use(
    cors({
        origin: [
            process.env.APP_HOST.replace(/\/$/, ''),
            ...(process.env.APP_HOST_CORS || '').split(',').map((s) => s.replace(/\/$/, '')),
        ],
        credentials: true,
    }),
);

app.use(express.static('public'));

app.use(useragent.express());

const requestLogger = (request, response, next) => {
    console.log('-----------------------------------------------------');
    // console.log(request.useragent.source);
    console.log(
        '[',
        request.useragent.platform,
        '-',
        request.useragent.browser,
        ']',
        request.method,
        request.path,
    );
    next();
};

app.use(requestLogger);

app.use(bodyParser.json());

app.get('/', (request, response) => {
    response.redirect(307, process.env.APP_HOST);
});

auth({ app });
feedItemAction({ app });
feedConfig({ app });

app.listen(process.env.PORT);
