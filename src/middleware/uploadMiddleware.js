const multer = require('multer');

const storage = multer.memoryStorage(); // Store files in memory for Cloudflare R2 upload
const upload = multer({ storage });

module.exports = upload;