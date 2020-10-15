/* global URL process */

import Telegram from 'telegraf/telegram.js';
import Telegraf from 'telegraf';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import fetch from 'node-fetch';
import { primaryId, fileNameSnakeCase } from './telegramUtils.js';

dotenv.config();

const contentPath = process.env.CONTENT_PATH;

const telegram = new Telegram(process.env.TELEGRAM_BOT_TOKEN);
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.on(['message', 'edited_message'], (ctx) => {
    const message = ctx.editedMessage || ctx.message;
    // console.log(JSON.stringify(message, null, 4));

    const dirPath = path.join(
        contentPath,
        'me',
        'blog',
        '_telegram',
        primaryId(message),
        message.message_id.toString(),
    );

    console.log(dirPath);

    mkdirp.sync(dirPath);

    fs.writeFileSync(path.join(dirPath, `message.json`), JSON.stringify(message, null, 1));

    [message.photo, message.document ? [message.document] : null].forEach((files) => {
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

    // return ctx.reply('ok');
    return null;
});

bot.launch();
