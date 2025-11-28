process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
process.env.MONGO_URI = 'mongodb://localhost/google-docs-test';
process.env.GEMINI_API_KEY = 'test_key';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.PORT = '3001';

console.log('Jest Setup: Environment variables hardcoded.');
