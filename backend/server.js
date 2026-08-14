require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');

require('./db'); // ensures schema is created on boot

const authRoutes = require('./routes/auth');
const issueRoutes = require('./routes/issues');
const moderationRoutes = require('./routes/moderation');
const officialRoutes = require('./routes/officials');
const pollRoutes = require('./routes/polls');
const socialRoutes = require('./routes/social');
const gamificationRoutes = require('./routes/gamification');
const { attachWebSocket } = require('./ws');

const app = express();
const PORT = process.env.PORT || 4000;

fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'civic-platform-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/officials', officialRoutes);
app.use('/api/social', socialRoutes);
app.use('/api', pollRoutes); // /api/polls, /api/petitions
app.use('/api/gamification', gamificationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`Civic platform backend running on http://localhost:${PORT}`);
});

