const express = require('express');
const { PORT } = require('./common/variable');
const { connectToDatabase } = require('./sql/connectToDatabase');
const routes = require('./Routes/routes');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

// Connect to the database
connectToDatabase()
.then(() => {

    console.log('Connected to the database successfully');
})
.catch(error => {
    console.error('Error connecting to the database:', error);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json())
app.use(cors());

// Middleware to disable caching for all GET requests
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next(); // Pass control to the next middleware/route
});
// app.use('/', express.static(`./media/carousel`));

app.use('/', express.static(`./media/Static`));
app.use('/', express.static(`./`));

app.use("/", routes);

// middleware to capture raw body for signature validation
app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/home', 'index.html'));
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
