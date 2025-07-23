const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const {dbClient, ObjectId} = require('../utils/db.js');
const redisClient = require('../utils/redis.js');


const AuthController = {
    async getConnect(req, res) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [email, password] = credentials.split(':');

        if (!email || !password) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const sha1Password = crypto.createHash('sha1').update(password).digest('hex');

        try {
            const user = await dbClient.db.collection('users').findOne({ email, password: sha1Password });

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const token = uuidv4();
            const key = `auth_${token}`;

            await redisClient.set(key, user._id.toString(), 86400);

            return res.status(200).json({ token });
        } catch (err) {
            return res.status(500).json({ error: 'Could not authorize user' });
        }
    },

    async getDisconnect(req, res) {
        const token = req.headers['x-token']; // Use 'x-token' header

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const key = `auth_${token}`;

        try {
            const userId = await redisClient.get(key);

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            await redisClient.del(key);

            return res.status(204).send();
        } catch (err) {
            return res.status(500).json({ error: 'Could not disconnect user' });
        }
    }
};

module.exports = AuthController;