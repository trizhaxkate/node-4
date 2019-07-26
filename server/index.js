const express = require('express');
const massive = require('massive');
const users = require('../controllers/userController.js');

massive({
    host: 'localhost',
    port: 5432,
    database: 'node4db',
    user: 'postgres',
    password: 'node4db'
}).then(db => {
    const app = express();
    app.set('db', db);
    app.use(express.json());
    app.post('/api/register', users.register);
    app.get('/api/protected/data', users.protect);
    app.post('/api/login', users.login);
    const PORT = 3001;
    app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
    })
})