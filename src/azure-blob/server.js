// const express = require('express');
// const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');
// const path = require('path');
// require('dotenv').config();

const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

// const app = express();

// const upload = multer({ dest: 'uploads/' });

const sharedKeyCredential = new StorageSharedKeyCredential(
    process.env.AZURE_STORAGE_ACCOUNT_NAME,
    process.env.AZURE_STORAGE_ACCOUNT_KEY
);

const blobServiceClient = new BlobServiceClient(
    `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    sharedKeyCredential
);

const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);

// Set up PostgreSQL client
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function loadFilesData(request, response) {
    const client = await pool.connect();
    try {
        const query_result = await client.query('SELECT * FROM files');
        response.json(query_result.rows);
    } catch (err) {
        console.error('Error loading files data:', err);
        return [];
    } finally {
        client.release();
    }
};

async function saveFilesData (filename, filepath){
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

async function uploadFile(request, response) {
    const fileName = request.body.note;
    if (!fileName) {
        return response.status(400).send('File name is required.');
    }

    if (request.file) {
        try {
            const blobName = request.file.filename;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            await blockBlobClient.uploadFile(request.file.path);
            fs.unlinkSync(request.file.path); // remove the file locally after upload

            saveFilesData(fileName, blobName);

            response.status(200).send('File uploaded successfully.');
        } catch (err) {
            console.error('Error uploading file:', err);
            response.status(500).send('Failed to upload file.');
        }
    } else {
        response.status(400).send('No file uploaded.');
    }
};

async function deleteFilesData(filepath) {
    const client = await pool.connect();
    try {
        await client.query("DELETE FROM files WHERE filepath = $1", [filepath]);
    } catch (err) {
        console.error('Error deleting files data:', err);
    } finally {
        client.release();
    }
};

async function deleteFile(request, response) {
    const fileKey = request.params.key;
    try {
        const blockBlobClient = containerClient.getBlockBlobClient(fileKey);
        await blockBlobClient.delete();
        deleteFilesData(fileKey);

        response.status(200).send('File deleted successfully.');
    } catch (err) {
        console.error('Error deleting file:', err);
        response.status(500).send('Failed to delete file.');
    }
};

module.exports = {
    loadFilesData,
    uploadFile,
    deleteFile
};