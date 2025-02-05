process.env = {
    AZURE_STORAGE_ACCOUNT_NAME: 'test_account_name',
    AZURE_STORAGE_ACCOUNT_KEY: 'test_key',
    AZURE_CONTAINER_NAME: 'test_container_name',
    PORT: '3001',
    PGUSER: 'test_user',
    PGHOST: 'test_host',
    PGDATABASE: 'test_database',
    PGPASSWORD: 'test_password',
    PGPORT: '5432'
};

jest.mock('@azure/storage-blob', () => ({
    ...jest.requireActual('@azure/storage-blob'),
    BlobServiceClient: jest.fn().mockImplementation(function () {
        return {
            getContainerClient: jest.fn().mockReturnValue({
                getBlockBlobClient: jest.fn().mockReturnValue({
                    uploadFile: jest.fn(),
                    delete: jest.fn()
                }),
            }),
        }
    })
}));
    
// jest.mock('pg', () => ({
//     ...jest.requireActual('pg'),
//     Pool: jest.fn().mockImplementation(function () {
//         return {
//             connect: jest.fn().mockReturnValue({
//                 query: jest.fn().mockReturnValue({ rows: [{}] }),
//                 release: jest.fn()
//             })
//         }
//     })
// }));
const request = require('supertest');
const express = require('express');
const server = require('../server');
const path = require('path');
const { Pool } = require('pg');


jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    unlinkSync: jest.fn(),
}));

jest.mock('pg', () => {
    const mClient = {
      query: jest.fn().mockReturnValue( { rows: [{ id: 1, filename: 'test.txt', filepath: 'test_path' }] }),
      release: jest.fn(),
    };
    // return { Client: jest.fn(() => mClient) };
    const mPool = {
        connect: 
            jest.fn().mockImplementation(() => {
                return mClient;
            })
        };
    return { Pool: jest.fn(() => mPool) };
});
// jest.mock('pg', () => {
//     const mPool = {
//       connect: function () {
//         return { query: jest.fn() };
//       }
//     //   query: jest.fn(),
//     //   end: jest.fn(),
//     //   on: jest.fn(),
//     };
//     return { Pool: jest.fn(() => mPool) };
// });


const app = express();
app.use(express.json());

app.get('/files', server.loadFilesData);
app.delete('/files/:key', server.deleteFile);
app.post('/upload', server.uploadFile);

describe('Test all endpoints', () => {
    let pool;
    let client
    beforeEach(() => {
        pool = new Pool();
        client = pool.connect();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Test uploadFile is successful', async () => {
        const req = {body: {note: 'test'}, file: {filename: 'test filename', path: 'test path'}}
        const res = {
            status: jest.fn().mockImplementation(function () {
                return {send: jest.fn()}
            }),
        };
        await server.uploadFile(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('Test loadFilesData is successful', async () => {
        const req = {}
        const res = {
            json: jest.fn()
        };

        await server.loadFilesData(req, res);

        expect(res.json).toHaveBeenCalled();
    })

    it('Test deleteFile fails', async () => {
        const req = {params: {key: 7}}
        const res = {
            status: jest.fn().mockImplementation(function () {
                return {send: jest.fn()}
            }),
        };

        jest.spyOn(res, 'status').mockImplementationOnce(function () {
            throw new Error("error");
        })
        
        await server.deleteFile(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('Test deleteFile is succsessful', async () => {
        const req = {params: {key: 1}}
        const res = {
            status: jest.fn().mockImplementation(function () {
                return {send: jest.fn()}
            }),
        };
        
        await server.deleteFile(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('Test uploadFile fails with no file name', async () => {
        const req = {body: {note: null}}
        const res = {
            status: jest.fn().mockImplementation(function () {
                return {send: jest.fn()}
            }),
        };
        
        await server.uploadFile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('Test uploadFile fails with file name but no file', async () => {
        const req = {body: {note: 'test-file-name'}}
        const res = {
            status: jest.fn().mockImplementation(function () {
                return {send: jest.fn()}
            }),
        };
        
        await server.uploadFile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('Test uploadFile fails to upload file', async () => {
        const req = {body: {note: "test"}, file: true}
        const res = {
            status: jest.fn().mockImplementation(function () {
                return {send: jest.fn()}
            }),
        };

        jest.spyOn(res, 'status').mockImplementationOnce(function () {
            throw new Error("error");
        })
        
        await server.uploadFile(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    //TODO fix test implementation with supertest
    // it('GET /files is successful', async () => {
    //     const res = await request(app).get('/files');
    //     expect(res.statusCode).toEqual(200);
    //     expect(res.body).toBeDefined();
    // });

    // it('DELETE fails to delete file', async () => {
    //     jest.spyOn(server, 'deleteFile').mockImplementationOnce((req, res) => {
    //         res.status(500).send();
    //     });

    //     const res = await request(app).delete('/files/1');
    //     expect(res.statusCode).toEqual(500);
    // });

    // it('DELETE is successful', async () => {
    //     const res = await request(app).delete('/files/1');
    //     expect(res.statusCode).toEqual(200);
    // });

    // it('POST uploadFile fails - no file name', async () => {
    //     const res = await request(app)
    //         .post('/upload')
    //         .send({ note: null });
    //     expect(res.statusCode).toEqual(400);
    // });

    // it('POST uploadFile fails - file name but no file', async () => {
    //     const res = await request(app)
    //         .post('/upload')
    //         .send({ note: 'test-no-file' });
    //     expect(res.statusCode).toEqual(400);
    // });

    // it('POST uploadFile fails to upload file', async () => {
    //     jest.spyOn(server, 'uploadFile').mockImplementationOnce((req, res) => {
    //         res.status(500).send();
    //     });

    //     const res = await request(app)
    //         .post('/upload')
    //         .send({ note: 'test', file: true });
    //     expect(res.statusCode).toEqual(500);
    // });

    // it('POST uploadFile is successful', async () => {
    //     const res = await request(app)
    //         .post('/upload')
    //         .attach('file', 'test.txt')
    //         .field('note', 'test');
    //     expect(res.statusCode).toEqual(200);
    // });

});