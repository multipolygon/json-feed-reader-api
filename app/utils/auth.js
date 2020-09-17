/* global process */

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

export const getUsernameFromAuth = (authorization) => {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && authorization) {
        try {
            const token = authorization.split(' ', 2)[1];
            const decoded = jwt.verify(token, jwtSecret);
            return decoded.username;
        } catch (err) {
            console.warn('token failed verification');
        }
    }
    return null;
};

export const getUsername = (request) => {
    if (request.headers.authorization) return getUsernameFromAuth(request.headers.authorization);
    return null;
};
