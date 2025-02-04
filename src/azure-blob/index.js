const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

const sharedKeyCredential = new StorageSharedKeyCredential(
    process.env.AZURE_STORAGE_ACCOUNT_NAME,
    process.env.AZURE_STORAGE_ACCOUNT_KEY
);

const blobServiceClient = new BlobServiceClient(
    `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    sharedKeyCredential
);

const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);

//Set up PostgreSQL client
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

const loadFilesData = async () => {
    const client = await pool.connect();
    try {
        const query_result = await client.query('SELECT * FROM files');
        return query_result.rows;
    } catch (err) {
        console.error('Error loading files data:', err);
        return [];
    } finally {
        client.release();
    }
};

const saveFilesData = async (filename, filepath) => {
    const client = await pool.connect();
    try {
        await client.query("INSERT INTO files (filename, filepath) VALUES ($1, $2)", [filename, filepath]);
    }
    catch (err) {
        console.error('Error saving files data:', err);
    }
    finally {
        client.release();
    }
};

const deleteFilesData = async (filepath) => {
    const client = await pool.connect();
    try {
        await client.query("DELETE FROM files WHERE filepath = $1", [filepath]);
    }
    catch (err) {
        console.error('Error deleting files data:', err);
    }
    finally {
        client.release();
    }
}

let files = loadFilesData();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/upload', upload.single('file'), async (req, res) => {
    const fileName = req.body.note;
    if (!fileName) {
        return res.status(400).send('File name is required.');
    }

    if (req.file) {
        try {

            const blobName = req.file.filename;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            await blockBlobClient.uploadFile(req.file.path);
            fs.unlinkSync(req.file.path); // remove the file locally after upload

            saveFilesData(fileName, blobName);

            res.status(200).send('File uploaded successfully.');
        } catch (err) {
            console.error('Error uploading file:', err);
            res.status(500).send('Failed to upload file.');
        }
    } else {
        res.status(400).send('No file uploaded.');
    }
});

app.get('/files', (req, res) => {
    loadFilesData().then(files => res.json(files));
});

app.delete('/files/:key', async (req, res) => {
    const fileKey = req.params.key;

    try {
        const blockBlobClient = containerClient.getBlockBlobClient(fileKey);
        await blockBlobClient.delete();
        deleteFilesData(fileKey);

        res.status(200).send('File deleted successfully.');
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).send('Failed to delete file.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
