const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();


class DBClient {
    constructor() {
        const dbUsername = process.env.MONGO_USERNAME;
        const dbPassword = process.env.MONGO_PASSWORD;
        const dbName = process.env.MONGO_DB_NAME;
        const dbHost = process.env.MONGO_DB_HOST;

        const uri = `mongodb+srv://${dbUsername}:${dbPassword}@${dbHost}/?retryWrites=true&w=majority&appName=${dbName}`;

        this.client = new MongoClient(uri);
        this._isConnected = false;
        this.db = null;

        this.connectionPromise = this.client.connect()
            .then(() => {
                this._isConnected = true;
                this.db = this.client.db(dbName);
                console.log('Connected to MongoDB!');
            })
            .catch ((err) => {
                console.error('Error connected to MongoDB:', err);
                this._isConnected = false;
                this.db = null;
            })
    }

    isAlive() {
        return this._isConnected;
    }

    async ready() {
        return this.connectionPromise;
    }

    async nbUsers() {
        if (!this.db) {
            return 0;
        }
        return this.db.collection('users').countDocuments();
    }

    async nbFiles() {
        if (!this.db) {
            return 0;
        }
        return this.db.collection('files').countDocuments();
    }
}

const dbClient = new DBClient();
module.exports = {dbClient, ObjectId};