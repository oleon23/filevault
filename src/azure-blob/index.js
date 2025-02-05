const express = require('express');
const multer = require('multer');
// const fs = require('fs');
// const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();
const server = require('./server');

// const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/upload', upload.single('file'), server.uploadFile);

app.get('/files', server.loadFilesData);

app.delete('/files/:key', server.deleteFile);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});