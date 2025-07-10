# AI Learning Assistant – Backend
This is the backend for the AI Learning Assistant platform. It powers the intelligent features including content parsing, chat interaction using Google Gemini, quiz generation, authentication, and persistent chat history.

**Features**

-> PDF/Text file upload and parsing

-> Google Gemini API integration for chat

-> MCQ quiz generation & scoring

-> JWT-based authentication

-> User profiles and progress tracking

-> Chat saving, renaming, deletion

-> AI summary, question, and concept extraction

**Tech Stack**

Runtime: Node.js + Express.js

Database: MongoDB + Mongoose

File Uploads: Multer

AI Models: Google Generative AI (Gemini)

PDF Parsing: pdf-parse

Security: JWT + bcryptjs

Deployment: Render

# Clone the repo
git clone https://github.com/chinmayee-guggilam/ai-learning-assistant-backend.git

cd ai-learning-assistant-backend

# Install dependencies
npm install

# Start server
node index.js

Your server will run on http://localhost:5000

**Authentication**

All protected routes require the Authorization header with the JWT token.

**License**

MIT License. © 2025 Guggilam Chinmayee
