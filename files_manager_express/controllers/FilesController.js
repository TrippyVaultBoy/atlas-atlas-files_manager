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
    }    
};

module.exports = FilesController;