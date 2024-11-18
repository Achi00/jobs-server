# Tech Job Application. Server Side

## Description

This is a Node.js based server application for a job searching platform. It provides authentication, user management, and job-related functionalities through a RESTful API.

This app uses custom web scraper with puppeteer and takes specific data from linkedin and stores it in mongoDB database

This app is based on linkedin-jobs-scraper app which scrapes job URLs

- Repo: https://github.com/spinlud/linkedin-jobs-scraper

## Features

- User authentication (with google OAuth)
- User management
- Job scraping from linkedin
- saving in mongoDB database
- Job listings and management
- Session handling
- CORS support

## Prerequisites

- Node.js
- MongoDB
- npm (Node Package Manager)

## Technical Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ORM
- **Authentication**: Passport.js with Google OAuth
- **Web Scraping**: Puppeteer
- **Task Scheduling**: node-cron (currnetlly on development)

**Scheduled Tasks**

- Implements node-cron for periodic job scraping (currently commented out)
- Allows for automated updating of job listings

## API Endpoints

- `GET /`: Server health check
- `GET /api/session`: Retrieve current session information
- `/auth/*`: Authentication routes (Google OAuth)
- `/user/*`: User profile management routes
- `/jobs/*`: Job listing and management routes

## Configuration

- Sessions are configured with a 1-day expiration
- Passport.js is used for authentication (setup in `./config/passport-config.js`)

## Database

The application uses MongoDB as its database. The connection is established using Mongoose.

## Scheduled Tasks

There's a commented-out section for scheduling tasks using `node-cron`. This can be used to set up periodic job scraping tasks.
