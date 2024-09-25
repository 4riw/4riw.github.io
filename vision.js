// shared-visioncraft.js

class VisioncraftAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.token = "b3c23b1c-8f14-42cb-b57a-ad7b452d3807";
    }

    async fetchModels(category) {
        try {
            const response = await fetch(`${this.baseUrl}/models/${category}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching models:', error);
            throw error;
        }
    }

    async fetchLoras(category) {
        try {
            const response = await fetch(`${this.baseUrl}/loras/${category}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching LORAs:', error);
            throw error;
        }
    }

    async generateImage(payload) {
        try {
            const response = await fetch(`${this.baseUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...payload, token: this.token })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.body.getReader();
        } catch (error) {
            console.error('Error generating image:', error);
            throw error;
        }
    }
}

class VisioncraftUI {
    constructor(api) {
        this.api = api;
        this.loraOptions = [];
    }

    initializeEventListeners() {
        document.getElementById('addLoraBtn').addEventListener('click', () => this.addLoraEntry());
        document.getElementById('imageForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(event.target);
            await this.generateImage(formData);
        });
        document.getElementById('cancelButton').addEventListener('click', () => this.hideOverlay());
    }

    async initializeModels(category) {
        try {
            const models = await this.api.fetchModels(category);
            const modelSelect = document.getElementById('model');
            modelSelect.innerHTML = ''; // Clear existing options
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error initializing models:', error);
        }
    }

    async initializeLoras(category) {
        try {
            this.loraOptions = await this.api.fetchLoras(category);
            this.addLoraEntry();
        } catch (error) {
            console.error('Error initializing LORAs:', error);
        }
    }
    updatePageTitle(category) {
        const pageTitle = document.getElementById('pageTitle');
        pageTitle.textContent = `Visioncraft ${category} Image Generator`;
    }
    addLoraEntry() {
        const loraContainer = document.getElementById('loraContainer');
        const entryCount = loraContainer.children.length;
        
        if (entryCount >= 5) {
            alert('Maximum of 5 LORA entries allowed.');
            return;
        }

        const entryDiv = document.createElement('div');
        entryDiv.className = 'lora-entry row';
        entryDiv.innerHTML = `
          <div class="row row-cols-3">
            <div class="col-6 mb-2">
                <select class="form-select lora-select me-2">
                    <option value="">Select LORA</option>
                    ${this.loraOptions.map(lora => `<option value="${lora}">${lora}</option>`).join('')}
                </select>
            </div>
            <div class="col-4 mb-2" width="20%">
                <input type="number" class="form-control lora-value" value="0.8" min="0.1" max="2" step="0.1" size="3">
            </div>
            <div class="col-2 mb-2">
                <button type="button" class="btn btn-danger remove-lora"><i class="bi-trash"></i></button>
            </div>
      </div>
            </div>
        `;

        loraContainer.appendChild(entryDiv);

        entryDiv.querySelector('.remove-lora').addEventListener('click', () => {
            loraContainer.removeChild(entryDiv);
        });
    }

    getLoraPairs() {
        const loraEntries = document.querySelectorAll('.lora-entry');
        return Array.from(loraEntries).reduce((pairs, entry) => {
            const select = entry.querySelector('.lora-select');
            const value = entry.querySelector('.lora-value');
            if (select.value && value.value) {
                pairs[select.value] = parseFloat(value.value);
            }
            return pairs;
        }, {});
    }

    showOverlay(message) {
        document.getElementById('statusMessage').textContent = message;
        document.getElementById('overlay').style.display = 'block';
    }

    hideOverlay() {
        document.getElementById('overlay').style.display = 'none';
    }

    async generateImage(formData) {
        const payload = {
            model: formData.get('model'),
            prompt: formData.get('prompt'),
            negative_prompt: formData.get('negative_prompt'),
            sampler: "DPM++ 2M Karras",
            steps: parseInt(formData.get('steps')),
            width: parseInt(formData.get('width')),
            height: parseInt(formData.get('height')),
            cfg_scale: parseFloat(formData.get('cfg_scale')),
            loras: this.getLoraPairs(),
            seed: parseInt(formData.get('seed')),
            stream: true,
            nsfw_filter: false
        };

        try {
            this.showOverlay('Submitting job...');
            document.getElementById('generatedImage').src = null;
            const reader = await this.api.generateImage(payload);
            await this.pollJobStatus(reader);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to generate image. Please try again.');
            this.hideOverlay();
        }
    }

    async pollJobStatus(reader) {
        while (true) {
            try {
                const { done, value } = await reader.read();
                if (done) break;

                const result = JSON.parse(new TextDecoder().decode(value));
                
                switch (result.status) {
                    case 'WAITING':
                        this.updateStatus('Waiting in queue', `Position: ${result.queue_position} / ${result.queue_total}`);
                        break;
                    case 'RUNNING':
                        this.updateStatus('Generating image', result.progress || 'Processing...');
                        break;
                    case 'SUCCESS':
                        this.hideOverlay();
                        this.displayGeneratedImage(result.image_url, result.seed);
                        return;
                    default:
                        throw new Error(`Unexpected status: ${result.status}`);
                }
            } catch (error) {
                console.error('Error polling job status:', error);
                this.hideOverlay();
                alert('Error checking job status:', error.message);
                break;
            }
        }
    }

    updateStatus(status, progress) {
        document.getElementById('statusMessage').textContent = status;
        document.getElementById('progressMessage').textContent = progress;
    }

    displayGeneratedImage(imageUrl, seed) {
        const img = document.getElementById('generatedImage');
        img.src = imageUrl;
        img.style.display = 'block';
        document.getElementById('seed').value = seed;
    }
}

// Initialize and export the Visioncraft application
const API_BASE_URL = 'https://visioncraft.top/api/image';
const api = new VisioncraftAPI(API_BASE_URL);
const ui = new VisioncraftUI(api);

function initVisioncraft(category) {
    ui.updatePageTitle(category);
    ui.initializeEventListeners();
    ui.initializeModels(category);
    ui.initializeLoras(category);
}

// Export the initialization function for use in HTML files
window.initVisioncraft = initVisioncraft;