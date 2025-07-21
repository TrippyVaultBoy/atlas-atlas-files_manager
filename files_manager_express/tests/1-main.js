import dbClient from '../utils/db';

const waitConnection = () => {
    return new Promise((resolve, reject) => {
        let i = 0;
        const repeatFct = async () => {
            await new Promise((res) => setTimeout(res, 1000));
                i += 1;
                if (i >= 10) {
                    reject(new Error('MongoDB connection timeout after 10 tries.'));
                } else if (!dbClient.isAlive()) {
                    repeatFct();
                } else {
                    resolve();
                }
        };
        repeatFct();
    })
};

(async () => {
    console.log(dbClient.isAlive());
    try {
        await waitConnection();
        console.log(dbClient.isAlive());
        console.log(await dbClient.nbUsers());
        console.log(await dbClient.nbFiles());
    } catch (err) {
        console.error('Connection error:', err.message);
    }
})();