const redisClient = require('../utils/redis.js');
const dbClient = require('../utils/db.js');

const AppController = {
    async getStatus(req, res) {
        try {
            const redisAlive = redisClient.isAlive();
            const dbAlive = dbClient.isAlive();
            return res.status(200).json({ redis: redisAlive, db: dbAlive });
        } catch (err) {
            return res.status(500).json({ error: 'Failed to get status' });
        }
    },

    async getStats(req, res) {
        try {
            const usersCount = await dbClient.nbUsers();
            const filesCount = await dbClient.nbFiles();
            return res.status(200).json({ users: usersCount, files: filesCount });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to get stats'});
        }
    },
};

module.exports = AppController;