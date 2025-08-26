require('dotenv').config();
const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const cors = require('cors');

const todosRouter = require('./routes/todos');
const authRouter = require('./routes/auth');
const familyTodos = require('./routes/familyTodos');

const app = express();
app.use(express.json());

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

app.use(passport.initialize());
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/todos', todosRouter);
app.use('/api/family', familyTodos);

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/todos_db';

mongoose.connect(MONGO)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => console.log('Server listening on', PORT));
    })
    .catch(err => {
        console.error('Mongo connection error', err);
        process.exit(1);
    });