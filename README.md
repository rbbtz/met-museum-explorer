# MET MUSEUM EXPLORER 🏛️✨

**Bridging the Gallery and the Cloud: A Digital Humanities Platform**

MET MUSEUM EXPLORER is a sophisticated digital bridge between the world’s most iconic art collection and modern AI. It transforms the Metropolitan Museum of Art's Open Access collection into a personalized, interactive experience, blending art history with cutting-edge technology.

*A minimalist, "museum-grade" interface designed to let the artwork take center stage.*

## ✨ Features

- **🏛️ Met API Integration**: Seamlessly explore thousands of artworks from the Metropolitan Museum of Art's Open Access collection.
- **🤖 AI Curator (Lens & Light)**: Powered by **Google Gemini AI**, providing real-time scholarly insights, historical context, and composition analysis for every piece.
- **🔍 Interactive Magnifying Lens**: A custom-built UI feature that allows users to examine brushstrokes and textures with high-precision detail.
- **🖼️ Personal Exhibitions**: Move from passive observer to active curator by building and managing your own digital art collections.
- **📱 Responsive Design**: A fluid, dark-themed aesthetic built with **Tailwind CSS 4** that adapts perfectly from ultra-wide desktops to mobile devices.
- **🔒 Secure Architecture**: Full-stack implementation with server-side AI processing to ensure API key security and high performance.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Framer Motion (for fluid animations).
- **Backend**: Node.js, Express.js.
- **Database**: SQLite (via `better-sqlite3`) for persistent user collections.
- **AI**: Google Gemini API (Gemini 3.1 Flash).
- **API**: Metropolitan Museum of Art Open Access API.
- **Build Tool**: Vite.

## 📦 Local Setup

Follow these steps to run the project on your local machine:

### 1. Prerequisites
- **Node.js** (v18 or higher)
- A **Gemini API Key** (Get one for free at [Google AI Studio](https://aistudio.google.com/))

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/met-museum-explorer.git
cd met-museum-explorer
npm install
```

### 3. Environment Variables
In the root directory, create a file named `.env` and add your API key:
```env
GEMINI_API_KEY="your_actual_api_key_here"
```
*Note: The `.env` file is ignored by git to keep your keys secure.*

### 4. Start Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ for the intersection of Tech and the Humanities.*
