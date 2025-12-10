# CodeKeeper

A real-time collaborative code editor with Google Docs-like functionality, featuring multi-language support, cloud storage, AI assistance, and live code execution.

🔗 **Live Demo:** https://codekeeper-nu.vercel.app/

## Features

- **Real-Time Collaboration** - Multiple users can edit code simultaneously with live cursor tracking and instant synchronization powered by Yjs CRDT technology
- **Syntax Highlighting** - Comprehensive language support with intelligent code highlighting
- **Code Execution** - Run code directly in the browser using Piston API with support for 50+ programming languages
- **AI Integration** - Get coding assistance and responses through Pollinations AI integration
- **Cloud Storage** - Persistent file storage with AWS S3 for seamless project management
- **Multi-Language Support** - Write and execute code in dozens of languages including Python, JavaScript, Java, C++, and more

## Tech Stack

### Frontend
- **Angular v20** - Modern reactive UI framework
- **CodeMirror 6 Editor** - Editor component
- **Yjs** - Conflict-free replicated data types for real-time collaboration

### Backend
- **Node.js + Express** - RESTful API server
- **WebSocket Server** - Real-time bidirectional communication
- **MongoDB Atlas** - Cloud-hosted document database
- **AWS S3** - Scalable object storage for files

### APIs & Services
- **Piston EMKC API** - Code execution engine supporting 50+ languages
- **Pollinations AI** - AI-powered coding assistance

## Architecture

CodeKeeper follows a distributed architecture with three main components:

- **Frontend Repository** (This repo) - Angular-based client application
- **[API Backend](https://github.com/09samuel/codekeeper-api-backend)** - Express.js REST API for file management and AI integration
- **[WebSocket Backend](https://github.com/09samuel/codekeeper-backend)** - Yjs WebSocket server for real-time collaboration