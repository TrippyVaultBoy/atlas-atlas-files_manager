const express = require('express');
const crypto = require('crypto');
const {dbClient, ObjectId} = require('../utils/db.js');
const redisClient = require('../utils/redis.js');

const UsersController = {
    async postNew(req, res) {

        const { email, password } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Missing email'});
        }
        if (!password) {
            return res.status(400).json({ error: 'Missing password'});
        }

        try {
            const userExists = await dbClient.db.collection('users').findOne({ email });

            if (userExists) {
                return res.status(400).json({ error: 'Already exist'})
            }

            const sha1Password = crypto.createHash('sha1').update(password).digest('hex');

            const newUser = {
                email,
                password: sha1Password,
            };

            const result = await dbClient.db.collection('users').insertOne(newUser);
            return res.status(201).json({ id: result.insertedId, email });
        } catch (err) {
            return res.status(500).json({ error: 'Could not create user'});
        }
    },

    async getMe(req, res) {
        const token = req.headers['x-token'];

        if (!token) {
           return res.status(401).json({ error: 'Unauthorized' }); 
        }

        const key = `auth_${token}`;

        try {
            const userId = await redisClient.get(key);

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            return res.status(200).json({ id: user._id, email: user.email });
        } catch (err) {
            return res.status(500).json({ error: 'Could not get user' });
        }
    }
};

module.exports = UsersController;