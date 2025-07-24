const redisClient = require('../utils/redis.js');
const {dbClient, ObjectId} = require('../utils/db.js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

const FilesController = {
    async postUpload(req, res) {
        const token = req.headers['x-token'];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const key = `auth_${token}`;

        const userId = await redisClient.get(key);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, type, parentId = 0, isPublic = false, data } = req.body;
        const types = ['folder', 'file', 'image'];

        if (!name) return res.status(400).json({ error: 'Missing name' });
        if (!type || !types.includes(type)) return res.status(400).json({ error: 'Missing type' });
        if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });
        
        let parentfile = null;
        const filesCollection = dbClient.db.collection('files');
        
        if (parentId) {
            try {
                parentfile = await filesCollection.findOne({ _id: new ObjectId(parentId) });
                if (!parentfile) return res.status(400).json({ error: 'Parent not found' });
                if (parentfile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
            } catch (err) {
                return res.status(400).json({ error: 'Parent not found' }); 
            }
        }

        const newFile = {
            userId: new ObjectId(userId),
            name,
            type,
            isPublic,
            parentId: parentId === 0 ? 0 : new ObjectId(parentId),
        }

        if (type === 'folder') {
            const result = await filesCollection.insertOne(newFile);
            newFile.id = result.insertedId;
            delete newFile._id;
            return res.status(201).json({
                id: result.insertedId,
                userId,
                name,
                type,
                isPublic,
                parentId,
            });
        }

        if (type === 'file' || type === 'image') {
            const fileUuid = uuidv4();
            const filePath = path.join(FOLDER_PATH, fileUuid);

            try {
                await fs.promises.mkdir(FOLDER_PATH, { recursive: true });
                const fileData = Buffer.from(data, 'base64');
                await fs.promises.writeFile(filePath, fileData);
            } catch (err) {
                return res.status(500).json({ error: 'Error saving file' });
            }

            newFile.localPath = filePath

            const result = await filesCollection.insertOne(newFile);
            return res.status(201).json({
                id: result.insertedId,
                userId,
                name,
                type,
                isPublic,
                parentId,
            });
        }
    },
    
    async getShow(req, res) {
        const token = req.headers['x-token'];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const key = `auth_${token}`;

        const userId = await redisClient.get(key);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        let fileId;
        try {
            fileId = new ObjectId(req.params.id);
        } catch (err) {
            return res.status(404).json({ error: 'Not found' });
        }
        
        const file = await dbClient.db.collection('files').findOne({
            _id: fileId,
            userId: new ObjectId(userId),
        });

        if (!file) return res.status(404).json({ error: 'Not found' });

        return res.status(200).json({
            id: fileId,
            userId: file.userId,
            name: file.name,
            type: file.type,
            isPublic: file.isPublic,
            parentId: file.parentId,
        });
    },

    async getIndex(req, res) {
        const token = req.headers['x-token'];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const key = `auth_${token}`;
        const userId = await redisClient.get(key);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const parentId = req.query.parentId || '0';
        const page = parseInt(req.query.page, 10) || 0;

        const match = {
            userId: new ObjectId(userId),
            parentId: parentId === '0' ? 0 : new ObjectId(parentId),
        };

        const files = await dbClient.db.collection('files')
            .aggregate([
            { $match: match },
            { $skip: page * 20 },
            { $limit: 20 },
            {
                $project: {
                _id: 0,
                id: '$_id',
                userId: 1,
                name: 1,
                type: 1,
                isPublic: 1,
                parentId: 1,
                },
            },
            ])
            .toArray();

        return res.status(200).json(files);
    },

    async getFile(req, res) {
        const fileId = req.params.id;

        const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
        if (!file) return res.status(404).json({ error: 'Not found' });

        if (file.type === 'folder') return res.status(400).json({ error: "A folder doesn't have content" });

        const token = req.headers['x-token'];
        if (!file.isPublic) {
            if (!token) return res.status(404).json({ error: 'Not found' });

            const key = `auth_${token}`;
            const userId = await redisClient.get(key);

            if (!userId || userId !== file.userId.toString()) {
                return res.status(404).json({ error: 'Not found' });
            }
        }

        try {
            await fs.promises.access(file.localPath, fs.constants.R_OK);
        } catch (err) {
            return res.status(404).json({ error: 'Not found' });
        }

        const mimeType = mime.lookup(file.name) || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);

        const fileStream = fs.createReadStream(file.localPath);
        fileStream.pipe(res);
    },

    async putPublish(req, res) {
        const token = req.headers['x-token'];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const key = `auth_${token}`;
        const userId = await redisClient.get(key);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        let fileId;
        try {
            fileId = new ObjectId(req.params.id);
        } catch (err) {
            return res.status(404).json({ error: 'Not found' });
        }
        
        const file = await dbClient.db.collection('files').findOne({
            _id: fileId,
            userId: new ObjectId(userId),
        });
        if (!file) return res.status(404).json({ error: 'Not found' });

        await dbClient.db.collection('files').updateOne(
            { _id: fileId },
            { $set: { isPublic: true } }
        );

        const updatedFile = {
            id: file._id,
            userId: file.userId,
            name: file.name,
            type: file.type,
            isPublic: true,
            parentId: file.parentId,
        };

        return res.status(200).json(updatedFile);
    },

    async putUnpublish(req, res) {
        const token = req.headers['x-token'];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const key = `auth_${token}`;
        const userId = await redisClient.get(key);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        let fileId;
        try {
            fileId = new ObjectId(req.params.id);
        } catch (err) {
            return res.status(404).json({ error: 'Not found' });
        }
        
        const file = await dbClient.db.collection('files').findOne({
            _id: fileId,
            userId: new ObjectId(userId),
        });
        if (!file) return res.status(404).json({ error: 'Not found' });

        await dbClient.db.collection('files').updateOne(
            { _id: fileId },
            { $set: { isPublic: false } }
        );

        const updatedFile = {
            id: file._id,
            userId: file.userId,
            name: file.name,
            type: file.type,
            isPublic: false,
            parentId: file.parentId,
        };

        return res.status(200).json(updatedFile);
    },
};

module.exports = FilesController;