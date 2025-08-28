# LMS Backend API

A backend API for a Learning Management System (LMS) built with Node.js, Express, and Firebase (previously MongoDB). This API provides functionality for user authentication (including Google OAuth), course management, and student enrollment.

## Features

- User authentication (JWT-based)
- Google OAuth integration
- Role-based access control (student, instructor, admin)
- Course management (CRUD operations)
- Student enrollment in courses
- Course ratings and reviews
- MongoDB database integration

## Prerequisites

- Node.js (v14 or higher)
- MongoDB project with database
- Google OAuth credentials (for Google authentication)

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file in the root directory
   - Add the following variables:
     ```
     PORT=5000
     JWT_SECRET=your_jwt_secret_key_here
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     CLIENT_URL=http://localhost:3000
     
     # MongoDB Configuration
     MONGODB_URI=mongodb://localhost:27017/lms

## Running the Server

Development mode:
```
npm run dev
```

Production mode:
```
npm start
