const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// Your webhook code here

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
