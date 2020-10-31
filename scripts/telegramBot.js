/* global URL process */

import Telegram from 'telegraf/telegram.js';
import Telegraf from 'telegraf';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import fetch from 'node-fetch';
import { primaryId, fileNameSnakeCase } from './util/telegram/helpers.js';
import makeFeeds from './util/telegram/makeFeeds.js';
import _ from 'lodash';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;
const telegramUserIds = process.env.TELEGRAM_USER_IDS.split(',').map(i => i.trim()).map(i => parseInt(i));
const telegram = new Telegram(process.env.TELEGRAM_BOT_TOKEN);
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

console.log('Bot:', process.env.TELEGRAM_BOT_TOKEN.split(':')[0]);
console.log('User IDs:', telegramUserIds);

const saveMessage = (ctx, message) => {
    const dirPath = path.join(
            contentPath,
            'me',
            'blog',
            '_telegram',
            (_.snakeCase(ctx.chat.title) || '_direct'),
            primaryId(message),
            message.message_id.toString(),
        );

        console.log(dirPath);

        mkdirp.sync(dirPath);

        fs.writeFileSync(path.join(dirPath, `message.json`), JSON.stringify(message, null, 1));

        [message.photo, message.video ? [message.video] : null, message.document ? [message.document] : null].forEach((files) => {
            if (files) {
                files.forEach((file) => {
                    telegram.getFileLink(file.file_id).then((src) => {
                        console.log(' ->', src);
                        const filePath = path.join(
                            dirPath.replace('_telegram', '_attachments'),
                            fileNameSnakeCase(file.file_name) ||
                                file.file_unique_id + path.extname(new URL(src).pathname),
                        );
                        if (!fs.existsSync(filePath)) {
                            fetch(src)
                                .then((response) => {
                                    if (!response.ok) {
                                        console.log(`     > ERROR ${response.status}`);
                                    } else {
                                        mkdirp.sync(path.dirname(filePath));
                                        const fileStream = fs.createWriteStream(filePath);
                                        response.body.pipe(fileStream);
                                        response.body.on('error', () => {
                                            console.log(`     > FAILED!`);
                                        });
                                        fileStream.on('finish', () => {
                                            console.log(`     > OK`);
                                        });
                                    }
                                })
                                .catch(() => {
                                    console.log(`     > ERROR`);
                                });
                        }
                    });
                });
            }
        });
};

bot.on(['message', 'edited_message'], (ctx) => {
    if (!telegramUserIds.includes(ctx.from.id)) {
        console.log('Unknown sender:', ctx.from.id);

    } else {
        const message = ctx.editedMessage || ctx.message;
        saveMessage(ctx, message);
        // console.log(JSON.stringify(message, null, 4));
        if (message.reply_to_message) {
            saveMessage(ctx, message.reply_to_message);
        }
        makeFeeds();
        // return ctx.reply('ok');
    }
});

bot.launch();
