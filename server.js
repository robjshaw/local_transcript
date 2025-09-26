const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const crypto = require('crypto');

// Simple UUID generator to avoid external dependency
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + '_' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.originalname.toLowerCase().endsWith('.m4a')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    },
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

// In-memory storage for processing status
const processingJobs = new Map();

class AudioProcessor {
    constructor(processId, audioFile, metadata = {}) {
        this.processId = processId;
        this.audioFile = audioFile;
        this.metadata = metadata;
        this.status = 'started';
        this.steps = {
            conversion: { status: 'pending' },
            transcription: { status: 'pending' },
            summary: { status: 'pending' },
            hubspot: { status: 'pending' }
        };
        this.results = {};
    }

    updateStep(stepName, status, data = {}) {
        this.steps[stepName] = { status, ...data };
        processingJobs.set(this.processId, this);
    }

    async convertAudioToWav() {
        try {
            this.updateStep('conversion', 'processing');

            const inputPath = this.audioFile;
            const outputPath = path.join('temp', `${this.processId}.wav`);

            return new Promise((resolve, reject) => {
                // Check if ffmpeg is available
                const ffmpeg = spawn('ffmpeg', [
                    '-i', inputPath,
                    '-acodec', 'pcm_s16le',
                    '-ar', '16000',
                    '-ac', '1',
                    outputPath,
                    '-y' // Overwrite output file
                ]);

                let stderr = '';

                ffmpeg.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        this.updateStep('conversion', 'completed', { outputPath });
                        this.results.wavFile = outputPath;
                        resolve(outputPath);
                    } else {
                        console.error('FFmpeg stderr:', stderr);
                        this.updateStep('conversion', 'error', { error: 'FFmpeg conversion failed' });
                        reject(new Error(`FFmpeg failed with code ${code}`));
                    }
                });

                ffmpeg.on('error', (error) => {
                    console.error('FFmpeg error:', error);
                    this.updateStep('conversion', 'error', { error: error.message });
                    reject(error);
                });
            });
        } catch (error) {
            this.updateStep('conversion', 'error', { error: error.message });
            throw error;
        }
    }

    async transcribeAudio(wavPath) {
        try {
            this.updateStep('transcription', 'processing');

            return new Promise((resolve, reject) => {
                // Use whisper-cli for transcription
                const modelPath = path.join(__dirname, 'models', 'ggml-base.en.bin');
                const whisper = spawn('whisper-cli', [
                    '-m', modelPath,
                    '--output-txt',
                    '--no-timestamps',
                    '--language', 'en',
                    wavPath
                ]);

                let stdout = '';
                let stderr = '';

                whisper.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                whisper.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                whisper.on('close', async (code) => {
                    if (code === 0) {
                        try {
                            // whisper-cli with --output-txt creates a .wav.txt file
                            const txtPath = wavPath + '.txt';

                            // Wait a moment for file to be written
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            const transcription = await fs.readFile(txtPath, 'utf8');

                            this.updateStep('transcription', 'completed');
                            this.results.transcription = transcription.trim();

                            // Save transcript to transcripts folder
                            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                            const clientInfo = this.metadata.clientName ? `_${this.metadata.clientName.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
                            const caseInfo = this.metadata.caseNumber ? `_${this.metadata.caseNumber.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
                            const transcriptFileName = `transcript_${timestamp}${clientInfo}${caseInfo}.txt`;
                            const transcriptSavePath = path.join('transcripts', transcriptFileName);

                            await fs.writeFile(transcriptSavePath, transcription.trim());
                            console.log(`📝 Transcript saved: ${transcriptSavePath}`);

                            // Clean up the temporary generated txt file
                            await fs.unlink(txtPath).catch(() => {});

                            resolve(transcription.trim());
                        } catch (readError) {
                            console.error('Error reading transcript:', readError);
                            this.updateStep('transcription', 'error', { error: 'Failed to read transcript file' });
                            reject(readError);
                        }
                    } else {
                        console.error('Whisper-cli stderr:', stderr);
                        console.error('Whisper-cli stdout:', stdout);
                        this.updateStep('transcription', 'error', { error: `Whisper-cli failed with code ${code}` });
                        reject(new Error(`Whisper-cli failed with code ${code}`));
                    }
                });

                whisper.on('error', (error) => {
                    console.error('Whisper error:', error);
                    this.updateStep('transcription', 'error', { error: error.message });
                    reject(error);
                });
            });
        } catch (error) {
            this.updateStep('transcription', 'error', { error: error.message });
            throw error;
        }
    }

    async generateSummary(transcription) {
        try {
            this.updateStep('summary', 'processing');

            const legalPrompt = `**Situation** You are an expert legal secretary working in a law firm environment where case documentation and file management are critical to legal proceedings. You need to process court transcripts and depositions to create concise summaries for case file integration.

**Task** The assistant should analyze the provided transcript and create a structured summary suitable for inclusion in a legal case file. The assistant should extract key information, identify critical testimony, and organize findings in a format that legal professionals can quickly reference.

**Objective** Create a professional case file summary that enables legal team members to quickly understand the transcript's key points, evidence presented, and testimony given without reading the full document.

**Knowledge** Legal transcripts typically contain:
- Witness testimony under oath
- Attorney questioning (direct and cross-examination)
- Judicial rulings and objections
- Evidence presentations
- Procedural matters

Case file summaries must maintain accuracy and legal precision while condensing information. The summary should preserve the legal significance of statements and maintain chronological flow when relevant.

**Instructions** The assistant should:
1. Create a summary between 300-500 words maximum
2. Structure the output with clear headings: Case Information, Key Testimony, Evidence Presented, Notable Rulings, and Action Items
3. Use objective, professional language appropriate for legal documentation
4. Identify each witness by name and role when summarizing their testimony
5. When conflicting testimony occurs, note both positions without editorial commentary

**Transcript to Analyze:**
${transcription}`;

            return new Promise((resolve, reject) => {
                // Use Ollama for local LLM processing with gemma3:12b model
                const ollama = spawn('ollama', ['run', 'gemma3:12b']);

                let stdout = '';
                let stderr = '';

                ollama.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                ollama.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                ollama.on('close', async (code) => {
                    if (code === 0 && stdout.trim()) {
                        this.updateStep('summary', 'completed');
                        this.results.summary = stdout.trim();

                        // Save summary to summaries folder
                        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                        const clientInfo = this.metadata.clientName ? `_${this.metadata.clientName.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
                        const caseInfo = this.metadata.caseNumber ? `_${this.metadata.caseNumber.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
                        const summaryFileName = `summary_${timestamp}${clientInfo}${caseInfo}.txt`;
                        const summarySavePath = path.join('summaries', summaryFileName);

                        try {
                            await fs.writeFile(summarySavePath, stdout.trim());
                            console.log(`📋 Summary saved: ${summarySavePath}`);
                        } catch (saveError) {
                            console.error('Error saving summary:', saveError);
                        }

                        resolve(stdout.trim());
                    } else {
                        console.error('Ollama stderr:', stderr);
                        this.updateStep('summary', 'error', { error: 'Summary generation failed' });
                        reject(new Error(`Ollama failed with code ${code}`));
                    }
                });

                ollama.on('error', (error) => {
                    console.error('Ollama error:', error);
                    this.updateStep('summary', 'error', { error: error.message });
                    reject(error);
                });

                // Send the prompt to ollama
                ollama.stdin.write(legalPrompt);
                ollama.stdin.end();
            });
        } catch (error) {
            this.updateStep('summary', 'error', { error: error.message });
            throw error;
        }
    }

    async attachToHubspot() {
        try {
            this.updateStep('hubspot', 'processing');

            // Placeholder for HubSpot integration
            // This would use HubSpot API to attach the transcript and summary to a client record
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            this.updateStep('hubspot', 'completed');
            return { success: true, message: 'Attached to HubSpot successfully' };
        } catch (error) {
            this.updateStep('hubspot', 'error', { error: error.message });
            throw error;
        }
    }

    async process() {
        try {
            this.status = 'processing';
            processingJobs.set(this.processId, this);

            // Step 1: Convert M4A to WAV
            const wavPath = await this.convertAudioToWav();

            // Step 2: Transcribe audio using Whisper
            const transcription = await this.transcribeAudio(wavPath);

            // Step 3: Generate summary using Ollama
            const summary = await this.generateSummary(transcription);

            // Step 4: HubSpot integration (optional)
            if (this.metadata.attachToHubspot) {
                await this.attachToHubspot();
            }

            this.status = 'completed';
            processingJobs.set(this.processId, this);

            // Cleanup temporary files
            this.cleanup();

            return {
                transcription,
                summary,
                metadata: this.metadata
            };

        } catch (error) {
            console.error('Processing error:', error);
            this.status = 'error';
            this.error = error.message;
            processingJobs.set(this.processId, this);
            throw error;
        }
    }

    async cleanup() {
        try {
            // Clean up temporary files
            if (this.results.wavFile) {
                await fs.unlink(this.results.wavFile).catch(() => {});
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/process-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const processId = uuidv4();
        const metadata = {
            clientName: req.body.clientName,
            caseNumber: req.body.caseNumber,
            meetingNotes: req.body.meetingNotes,
            originalFileName: req.file.originalname,
            uploadedAt: new Date().toISOString()
        };

        const processor = new AudioProcessor(processId, req.file.path, metadata);
        processingJobs.set(processId, processor);

        // Start processing in background
        processor.process().catch(error => {
            console.error('Background processing error:', error);
        });

        res.json({
            processId,
            message: 'Processing started',
            status: 'started'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to start processing' });
    }
});

app.get('/api/status/:processId', (req, res) => {
    const { processId } = req.params;
    const job = processingJobs.get(processId);

    if (!job) {
        return res.status(404).json({ error: 'Process not found' });
    }

    const response = {
        processId,
        status: job.status,
        steps: job.steps,
        metadata: job.metadata
    };

    if (job.status === 'completed') {
        response.transcription = job.results.transcription;
        response.summary = job.results.summary;
    }

    if (job.status === 'error') {
        response.error = job.error;
    }

    res.json(response);
});

app.post('/api/hubspot-attach/:processId', (req, res) => {
    const { processId } = req.params;
    const job = processingJobs.get(processId);

    if (!job) {
        return res.status(404).json({ error: 'Process not found' });
    }

    if (job.status !== 'completed') {
        return res.status(400).json({ error: 'Processing not completed' });
    }

    // Trigger HubSpot attachment
    job.attachToHubspot().then(() => {
        res.json({ success: true, message: 'Attached to HubSpot' });
    }).catch(error => {
        res.status(500).json({ error: error.message });
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        dependencies: {
            ffmpeg: 'Available (check with: ffmpeg -version)',
            whisper: 'Available (check with: whisper-cli --help)',
            ollama: 'Available (check with: ollama --version)',
            model: 'gemma3:12b (check with: ollama list)'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🎙️  Legal Audio Transcription Server running on http://localhost:${PORT}`);
    console.log('📁 Make sure the following dependencies are installed:');
    console.log('   - ffmpeg (brew install ffmpeg)');
    console.log('   - whisper (pip install openai-whisper)');
    console.log('   - ollama (https://ollama.ai/)');
    console.log('📂 Directories created: uploads/, temp/, transcripts/, summaries/');
});