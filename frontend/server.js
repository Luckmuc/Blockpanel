const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 1105;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Blockpanel Frontend running on http://0.0.0.0:${PORT}`);
});