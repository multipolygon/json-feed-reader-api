import path from 'path';
import _ from 'lodash';

export const fileNameSnakeCase = (fileName) =>
    fileName
        ? _.snakeCase(path.basename(fileName, path.extname(fileName))) + path.extname(fileName)
        : null;

export const primaryId = (message) =>
    (
        message.media_group_id ||
        (message.reply_to_message &&
            (message.reply_to_message.media_group_id || message.reply_to_message.message_id)) ||
        message.message_id
    ).toString();
