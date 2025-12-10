process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
process.env.MONGO_URI = 'mongodb://localhost/google-docs-test';
process.env.MONGO_TEST_URI = 'mongodb://localhost/google-docs-test';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../User');
const authRoutes = require('../routes/authRoutes');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Mock database connection
beforeAll(async () => {
    process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
    process.env.MONGO_URI = 'mongodb://localhost/google-docs-test';

    // Use in-memory database for testing
    const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost/google-docs-test';
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri);
    }
});

afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
});

beforeEach(async () => {
    await User.deleteMany({});
});

describe('Authentication API', () => {
    describe('POST /api/auth/register', () => {
        it('should register a new user with valid data', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('username', userData.username);
            expect(response.body).toHaveProperty('email', userData.email);
            expect(response.body).not.toHaveProperty('password');
        });

        it('should reject registration with missing fields', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    email: 'test@example.com'
                    // missing password
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should reject registration with invalid email', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    email: 'invalid-email',
                    password: 'Test123!'
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should reject registration with weak password', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    email: 'test@example.com',
                    password: 'weak'
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should reject duplicate email registration', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!'
            };

            // First registration
            await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            // Duplicate registration
            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create a test user
            const hashedPassword = await bcrypt.hash('Test123!', 10);
            await User.create({
                username: 'testuser',
                email: 'test@example.com',
                password: hashedPassword
            });
        });

        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123!'
                })
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('username', 'testuser');
            expect(response.body).toHaveProperty('email', 'test@example.com');
        });

        it('should reject login with invalid email', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'wrong@example.com',
                    password: 'Test123!'
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should reject login with invalid password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'WrongPassword123!'
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should reject login with missing fields', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com'
                    // missing password
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('GET /api/auth/me', () => {
        let token;

        beforeEach(async () => {
            // Register and get token
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    email: 'test@example.com',
                    password: 'Test123!'
                });

            token = response.body.token;
        });

        it('should get user data with valid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toHaveProperty('username', 'testuser');
            expect(response.body).toHaveProperty('email', 'test@example.com');
            expect(response.body).not.toHaveProperty('password');
        });

        it('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });

        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });
    });
});
