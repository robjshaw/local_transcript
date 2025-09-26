# Legal Audio Transcription Suite

A professional, privacy-focused application for processing legal audio recordings with transcription and summarization capabilities. All processing happens locally to ensure sensitive legal information remains secure.

## 🔐 Security Features

- **100% Local Processing** - No external APIs or cloud services
- **No Data Transmission** - All files stay on your local machine
- **Privacy-First Design** - Built for sensitive legal information

## 🚀 Features

1. **Audio Conversion** - Convert M4A files to WAV format using FFmpeg
2. **Speech Transcription** - Generate accurate transcripts using Whisper CLI
3. **AI Summarization** - Create professional summaries using local Ollama LLM
4. **HubSpot Integration** - Optional client file attachment (stretch goal)
5. **Professional UI** - Clean, legal-focused interface with Tailwind CSS

## 📋 Prerequisites

Before running this application, ensure you have the following installed:

### Required Dependencies

1. **Node.js** (v16 or higher)
   ```bash
   # Check version
   node --version
   ```

2. **FFmpeg** (for audio conversion)
   ```bash
   # Install on macOS
   brew install ffmpeg

   # Install on Ubuntu/Debian
   sudo apt update && sudo apt install ffmpeg

   # Verify installation
   ffmpeg -version
   ```

3. **Whisper CLI** (for transcription)
   ```bash
   # Install whisper-cli (the command line tool you're using)
   # Or if using openai-whisper:
   pip install openai-whisper

   # Verify installation
   whisper-cli --help
   ```

4. **Ollama** (for AI summarization)
   ```bash
   # Install Ollama (visit https://ollama.ai/ for instructions)
   # On macOS
   brew install ollama

   # Start Ollama service
   ollama serve

   # Pull the gemma3:12b model (in another terminal)
   ollama pull gemma3:12b

   # Verify installation
   ollama --version
   ```

## 🛠️ Installation

1. **Clone or download this project**

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Build the CSS:**
   ```bash
   npm run build-css
   ```

4. **Ensure all directories exist:**
   ```bash
   mkdir -p uploads temp transcripts summaries models
   ```

5. **Download Whisper model:**
   ```bash
   cd models
   curl -L -o ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
   cd ..
   ```

## 🏃 Running the Application

1. **Make sure Ollama is running:**
   ```bash
   ollama serve
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

## 💼 Usage

### Basic Workflow

1. **Upload Audio File**
   - Select or drag-and-drop an M4A audio file
   - Files up to 500MB are supported

2. **Add Client Information** (Optional)
   - Client name
   - Case number
   - Meeting notes or context

3. **Start Processing**
   - Click "Start Processing Pipeline"
   - Monitor real-time progress through 4 steps

4. **Review Results**
   - View full transcription
   - Read AI-generated legal summary with structured format:
     - Case Information
     - Key Testimony
     - Evidence Presented
     - Notable Rulings
     - Action Items
   - Copy or download results

### Processing Steps

1. **Audio Conversion** - M4A → WAV using FFmpeg
2. **Transcription** - Audio → Text using Whisper
3. **Legal Summarization** - Text → Professional case summary using Ollama with specialized legal secretary prompt
4. **HubSpot Integration** - Optional client file attachment

## 📁 Project Structure

```
local_transcript/
├── public/                 # Frontend files
│   ├── index.html         # Main application page
│   ├── js/app.js         # Frontend JavaScript
│   └── styles/           # CSS files
├── uploads/              # Uploaded audio files
├── temp/                 # Temporary WAV files
├── transcripts/          # Generated transcripts
├── summaries/           # Generated summaries
├── server.js            # Express server
├── package.json         # Node.js dependencies
└── tailwind.config.js   # Tailwind configuration
```

## 🔧 API Endpoints

- `GET /` - Main application interface
- `POST /api/process-audio` - Start audio processing
- `GET /api/status/:processId` - Check processing status
- `POST /api/hubspot-attach/:processId` - Attach to HubSpot
- `GET /api/health` - System health check

## 🚨 Troubleshooting

### Common Issues

1. **FFmpeg not found**
   ```bash
   # Install FFmpeg
   brew install ffmpeg  # macOS
   # or
   sudo apt install ffmpeg  # Ubuntu
   ```

2. **Whisper not found**
   ```bash
   # Install Whisper
   pip install openai-whisper
   ```

3. **Ollama connection error**
   ```bash
   # Make sure Ollama is running
   ollama serve

   # Pull the required model
   ollama pull gemma3:12b
   ```

4. **Port already in use**
   ```bash
   # Kill process on port 3000
   lsof -ti:3000 | xargs kill -9
   ```

### Health Check

Visit `http://localhost:3000/api/health` to verify all dependencies are working.

## 🔒 Security Considerations

- All processing happens locally on your machine
- No data is sent to external servers
- Temporary files are automatically cleaned up
- Consider encrypting sensitive audio files at rest
- Use HTTPS in production environments

## 🎯 Future Enhancements

- [ ] Speaker diarization (identify different speakers)
- [ ] Custom vocabulary for legal terms
- [ ] Batch processing multiple files
- [ ] Export to various formats (PDF, Word)
- [ ] Integration with more legal practice management systems
- [ ] Real-time transcription during meetings

## 📄 License

MIT License - Feel free to modify for your legal practice needs.

## 🆘 Support

For technical issues:
1. Check the troubleshooting section
2. Verify all dependencies are installed
3. Check the browser console for errors
4. Ensure Ollama service is running

---

**⚖️ Legal Notice**: This tool is designed for legal professionals. Ensure compliance with your jurisdiction's rules regarding client confidentiality and data protection.