class AudioTranscriptionApp {
    constructor() {
        this.selectedFile = null;
        this.processId = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const fileInput = document.getElementById('audioFile');
        const dropZone = document.getElementById('dropZone');
        const processBtn = document.getElementById('processBtn');

        // File input change
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-legal-blue', 'bg-blue-50');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-legal-blue', 'bg-blue-50');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-legal-blue', 'bg-blue-50');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        // Process button
        processBtn.addEventListener('click', () => this.startProcessing());
    }

    handleFileSelect(file) {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.m4a')) {
            this.showError('Please select a .m4a audio file');
            return;
        }

        if (file.size > 500 * 1024 * 1024) { // 500MB limit
            this.showError('File size must be less than 500MB');
            return;
        }

        this.selectedFile = file;

        // Show file info
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');

        fileName.textContent = file.name;
        fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        fileInfo.classList.remove('hidden');

        // Enable process button
        document.getElementById('processBtn').disabled = false;
    }

    async startProcessing() {
        if (!this.selectedFile) return;

        // Show status card
        document.getElementById('statusCard').classList.remove('hidden');
        document.getElementById('processBtn').disabled = true;

        const formData = new FormData();
        formData.append('audio', this.selectedFile);
        formData.append('clientName', document.getElementById('clientName').value);
        formData.append('caseNumber', document.getElementById('caseNumber').value);
        formData.append('meetingNotes', document.getElementById('meetingNotes').value);

        try {
            const response = await fetch('/api/process-audio', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to start processing');
            }

            const data = await response.json();
            this.processId = data.processId;

            // Start polling for status
            this.pollProcessingStatus();

        } catch (error) {
            console.error('Processing error:', error);
            this.showError('Failed to start processing: ' + error.message);
            document.getElementById('processBtn').disabled = false;
        }
    }

    async pollProcessingStatus() {
        try {
            const response = await fetch(`/api/status/${this.processId}`);
            const data = await response.json();

            this.updateProcessingStatus(data);

            if (data.status === 'completed') {
                this.showResults(data);
            } else if (data.status === 'error') {
                this.showError(data.error);
                document.getElementById('processBtn').disabled = false;
            } else {
                // Continue polling
                setTimeout(() => this.pollProcessingStatus(), 2000);
            }
        } catch (error) {
            console.error('Status polling error:', error);
            setTimeout(() => this.pollProcessingStatus(), 5000);
        }
    }

    updateProcessingStatus(data) {
        const steps = ['conversion', 'transcription', 'summary', 'hubspot'];
        const stepElements = [1, 2, 3, 4];

        let completedSteps = 0;

        steps.forEach((step, index) => {
            const statusEl = document.getElementById(`status${index + 1}`);
            const stepEl = document.getElementById(`step${index + 1}`);

            if (data.steps && data.steps[step]) {
                const stepData = data.steps[step];
                statusEl.className = `status-indicator status-${stepData.status}`;

                switch (stepData.status) {
                    case 'processing':
                        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Processing</span>';
                        stepEl.classList.add('bg-blue-50', 'border', 'border-blue-200');
                        break;
                    case 'completed':
                        statusEl.innerHTML = '<i class="fas fa-check"></i><span>Completed</span>';
                        stepEl.classList.add('bg-green-50', 'border', 'border-green-200');
                        completedSteps++;
                        break;
                    case 'error':
                        statusEl.innerHTML = '<i class="fas fa-times"></i><span>Error</span>';
                        stepEl.classList.add('bg-red-50', 'border', 'border-red-200');
                        break;
                }
            }
        });

        // Update progress bar
        const progress = (completedSteps / 3) * 100; // Only count first 3 steps for progress
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').textContent =
            `Step ${completedSteps + 1} of 3: ${data.currentStep || 'Processing'}`;
    }

    showResults(data) {
        document.getElementById('resultsCard').classList.remove('hidden');

        if (data.transcription) {
            document.getElementById('transcriptionText').textContent = data.transcription;
        }

        if (data.summary) {
            document.getElementById('summaryText').innerHTML = data.summary.replace(/\n/g, '<br>');
        }

        document.getElementById('progressText').textContent = 'Processing completed successfully!';
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    resetApp() {
        this.selectedFile = null;
        this.processId = null;

        document.getElementById('fileInfo').classList.add('hidden');
        document.getElementById('statusCard').classList.add('hidden');
        document.getElementById('resultsCard').classList.add('hidden');
        document.getElementById('processBtn').disabled = true;
        document.getElementById('audioFile').value = '';

        // Reset form fields
        document.getElementById('clientName').value = '';
        document.getElementById('caseNumber').value = '';
        document.getElementById('meetingNotes').value = '';

        // Reset status indicators
        for (let i = 1; i <= 4; i++) {
            const statusEl = document.getElementById(`status${i}`);
            const stepEl = document.getElementById(`step${i}`);
            statusEl.className = 'status-indicator status-pending';
            statusEl.innerHTML = '<i class="fas fa-clock"></i><span>Pending</span>';
            stepEl.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
        }

        document.getElementById('progressBar').style.width = '0%';
        document.getElementById('progressText').textContent = 'Ready to start';
    }

    attachToHubspot() {
        if (!this.processId) return;

        // This would integrate with HubSpot API
        alert('HubSpot integration would be implemented here');
    }
}

// Utility functions
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent || element.innerText;
    navigator.clipboard.writeText(text).then(() => {
        // Show temporary feedback
        const button = event.target.closest('button');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check mr-2"></i>Copied!';
        button.classList.add('bg-green-200');
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('bg-green-200');
        }, 2000);
    });
}

function downloadText(type) {
    const elementId = type === 'transcription' ? 'transcriptionText' : 'summaryText';
    const element = document.getElementById(elementId);
    const text = element.textContent || element.innerText;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AudioTranscriptionApp();
});