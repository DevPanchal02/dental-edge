// server.js
const express = require('express');
const cors = require('cors');

// --- Configuration ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// --- Routes ---



// --- Placeholder Root Route ---
// You can keep this or remove it once you have API routes
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// --- Placeholder API Route (Remove when adding real routes) ---
app.get('/api', (req, res) => {
    res.json({ message: 'API base route is working! Mount specific routes.' });
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});