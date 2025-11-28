process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
process.env.MONGO_URI = 'mongodb://localhost/google-docs-test';
process.env.MONGO_TEST_URI = 'mongodb://localhost/google-docs-test';
process.env.CLIENT_URL = 'http://localhost:3000';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidV4 } = require('uuid');
const Document = require('../Document');
const User = require('../User');
const documentRoutes = require('../routes/documentRoutes');
const authRoutes = require('../routes/authRoutes');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

let testUser;
let authToken;

beforeAll(async () => {
    process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
    process.env.MONGO_URI = 'mongodb://localhost/google-docs-test';
    process.env.CLIENT_URL = 'http://localhost:3000';

    const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost/google-docs-test';
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    }
});

afterAll(async () => {
    await Document.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
});

beforeEach(async () => {
    await Document.deleteMany({});
    await User.deleteMany({});

    // Create test user and get token
    const response = await request(app)
        .post('/api/auth/register')
        .send({
            username: 'testuser',
            email: 'test@example.com',
            password: 'Test123!'
        });

    testUser = response.body;
    authToken = response.body.token;
});

describe('Document API', () => {
    describe('POST /api/documents', () => {
        it('should create a new document', async () => {
            const documentId = uuidV4();
            const response = await request(app)
                .post('/api/documents')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    documentId,
                    title: 'Test Document'
                })
                .expect(201);

            expect(response.body).toHaveProperty('_id', documentId);
            expect(response.body).toHaveProperty('title', 'Test Document');
            expect(response.body).toHaveProperty('owner');
        });

        it('should reject document creation without authentication', async () => {
            const response = await request(app)
                .post('/api/documents')
                .send({
                    documentId: uuidV4(),
                    title: 'Test Document'
                })
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });

        it('should reject document creation with invalid UUID', async () => {
            const response = await request(app)
                .post('/api/documents')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    documentId: 'invalid-uuid',
                    title: 'Test Document'
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('GET /api/documents', () => {
        beforeEach(async () => {
            // Create test documents
            await Document.create({
                _id: uuidV4(),
                title: 'Document 1',
                owner: testUser._id,
                data: {}
            });

            await Document.create({
                _id: uuidV4(),
                title: 'Document 2',
                owner: testUser._id,
                data: {}
            });
        });

        it('should get all user documents', async () => {
            const response = await request(app)
                .get('/api/documents')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
        });

        it('should reject request without authentication', async () => {
            const response = await request(app)
                .get('/api/documents')
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('GET /api/documents/:id', () => {
        let documentId;

        beforeEach(async () => {
            documentId = uuidV4();
            await Document.create({
                _id: documentId,
                title: 'Test Document',
                owner: testUser._id,
                data: { content: 'test' }
            });
        });

        it('should get a specific document', async () => {
            const response = await request(app)
                .get(`/api/documents/${documentId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('_id', documentId);
            expect(response.body).toHaveProperty('title', 'Test Document');
        });

        it('should reject access to non-existent document', async () => {
            const response = await request(app)
                .get(`/api/documents/${uuidV4()}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('message');
        });

        it('should reject access without authentication', async () => {
            const response = await request(app)
                .get(`/api/documents/${documentId}`)
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('PATCH /api/documents/:id/title', () => {
        let documentId;

        beforeEach(async () => {
            documentId = uuidV4();
            await Document.create({
                _id: documentId,
                title: 'Original Title',
                owner: testUser._id,
                data: {}
            });
        });

        it('should update document title', async () => {
            const response = await request(app)
                .patch(`/api/documents/${documentId}/title`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Updated Title' })
                .expect(200);

            expect(response.body).toHaveProperty('title', 'Updated Title');
        });

        it('should reject empty title', async () => {
            const response = await request(app)
                .patch(`/api/documents/${documentId}/title`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: '' })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('DELETE /api/documents/:id', () => {
        let documentId;

        beforeEach(async () => {
            documentId = uuidV4();
            await Document.create({
                _id: documentId,
                title: 'Test Document',
                owner: testUser._id,
                data: {}
            });
        });

        it('should delete a document', async () => {
            const response = await request(app)
                .delete(`/api/documents/${documentId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message');

            // Verify document is deleted
            const doc = await Document.findById(documentId);
            expect(doc).toBeNull();
        });

        it('should reject deletion of non-existent document', async () => {
            const response = await request(app)
                .delete(`/api/documents/${uuidV4()}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('POST /api/documents/:id/share', () => {
        let documentId;

        beforeEach(async () => {
            documentId = uuidV4();
            await Document.create({
                _id: documentId,
                title: 'Test Document',
                owner: testUser._id,
                data: {}
            });
        });

        it('should generate a share link', async () => {
            const response = await request(app)
                .post(`/api/documents/${documentId}/share`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ permission: 'viewer' })
                .expect(200);

            expect(response.body).toHaveProperty('shareUrl');
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('permission', 'viewer');
            expect(response.body).toHaveProperty('enabled', true);
        });

        it('should reject invalid permission type', async () => {
            const response = await request(app)
                .post(`/api/documents/${documentId}/share`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ permission: 'invalid' })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });
    });
});
