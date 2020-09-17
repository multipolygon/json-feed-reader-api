/* global process */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export default function auth({ app }) {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) throw new Error('No JWT_SECRET!');

    const passwordDigest = (salt, password) =>
        crypto.createHash('sha256').update(`${salt}${password}`).digest('base64');

    app.post('/auth', (request, response) => {
        const { username, password } = request.body;
        if (
            process.env.USERNAME === username &&
            process.env.USERPASS === passwordDigest(process.env.USERSALT, password)
        ) {
            response.send({
                token: jwt.sign({ username }, jwtSecret, { expiresIn: '30d' }),
            });
        } else {
            response.status(422).send({ errors: { password: ['incorrect'] } });
        }
    });
}
