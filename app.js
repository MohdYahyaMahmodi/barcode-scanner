/**
 * Barcode Scanner - Multi-Store Price Checker
 * 
 * This script implements a barcode scanner using the Quagga.js library.
 * It allows users to scan barcodes using their device's camera, search for the scanned items
 * across multiple online stores, and save their scan history.
 * 
 * Features:
 * - Camera selection
 * - Real-time barcode scanning
 * - Multi-store product search
 * - Scan history management
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Element References
    const result = document.getElementById('result');
    const scanRegion = document.querySelector('.scan-region');
    const lastScansList = document.getElementById('lastScans');
    const saveButton = document.getElementById('saveButton');
    const popupOverlay = document.querySelector('.popup-overlay');
    const productNameInput = document.getElementById('productName');
    const popupSaveButton = document.querySelector('.popup-save');
    const popupCancelButton = document.querySelector('.popup-cancel');
    const cameraSelect = document.getElementById('cameraSelect');

    // Global Variables
    let currentStream = null;
    let lastResult = null;
    let detectionCount = 0;
    const requiredDetections = 3;

    // Camera Handling Functions
    /**
     * Retrieves available video input devices (cameras)
     * @returns {Promise<MediaDeviceInfo[]>} Array of available video input devices
     */
    async function getCameraDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
    }

    /**
     * Populates the camera selection dropdown with available cameras
     */
    async function populateCameraSelect() {
        const cameras = await getCameraDevices();
        cameraSelect.innerHTML = '';
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.text = camera.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });
    }

    /**
     * Initializes the barcode scanner with the selected camera
     */
    async function initializeScanner() {
        const selectedCameraId = cameraSelect.value;
        
        try {
            // Stop any existing stream
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }

            // Get new media stream
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined }
            });

            // Initialize Quagga
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector('.scanner-container'),
                    constraints: {
                        width: 480,
                        height: 320,
                        facingMode: "environment",
                        deviceId: selectedCameraId
                    },
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: navigator.hardwareConcurrency || 4,
                decoder: {
                    readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"]
                },
                locate: true
            }, function(err) {
                if (err) {
                    console.log(err);
                    result.innerHTML = '<p class="error-message">Error initializing scanner. Please try again.</p>';
                    return;
                }
                console.log("Quagga initialization finished. Ready to start");
                Quagga.start();
            });
        } catch (error) {
            console.error("Error accessing the camera:", error);
            result.innerHTML = '<p class="error-message">Error accessing the camera. Please check your camera permissions.</p>';
        }
    }

    // Barcode Processing Functions
    /**
     * Handles the processing of each frame from the video stream
     * @param {Object} result - The result object from Quagga's processing
     */
    function handleProcessed(result) {
        var drawingCtx = Quagga.canvas.ctx.overlay,
            drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
                result.boxes.filter(function (box) {
                    return box !== result.box;
                }).forEach(function (box) {
                    Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
                });
            }

            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "#00F", lineWidth: 2 });
            }

            if (result.codeResult && result.codeResult.code) {
                Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
            }
        }
    }

    /**
     * Handles the detection of a barcode
     * @param {Object} data - The data object from Quagga's detection
     */
    function handleDetected(data) {
        let detectedCode = data.codeResult.code;

        if (detectedCode === lastResult) {
            detectionCount++;
            if (detectionCount === requiredDetections) {
                processBarcode(detectedCode);
            }
        } else {
            lastResult = detectedCode;
            detectionCount = 1;
        }
    }

    /**
     * Processes the detected barcode and updates the UI
     * @param {string} code - The detected barcode
     */
    function processBarcode(code) {
        console.log("Barcode detected and processed : [" + code + "]");
        
        scanRegion.style.borderColor = '#22C55E';
        setTimeout(() => { scanRegion.style.borderColor = '#3d5afe'; }, 500);

        result.innerHTML = `
            <p class="barcode-result">Barcode: ${code}</p>
            <div class="store-buttons">
                <a href="https://www.google.com/search?q=${code}" target="_blank" class="store-button google-button">
                    <i class="fab fa-google"></i> Search on Google
                </a>
                <a href="https://www.amazon.com/s?k=${code}" target="_blank" class="store-button amazon-button">
                    <i class="fab fa-amazon"></i> Search on Amazon
                </a>
                <a href="https://www.walmart.com/search?q=${code}" target="_blank" class="store-button walmart-button">
                    <i class="fas fa-store"></i> Search on Walmart
                </a>
                <a href="https://www.target.com/s?searchTerm=${code}" target="_blank" class="store-button target-button">
                    <i class="fas fa-bullseye"></i> Search on Target
                </a>
            </div>
        `;

        saveButton.style.display = 'block';
        saveButton.onclick = () => showSavePopup(code);
    }

    // Scan History Management Functions
    /**
     * Displays the save popup for the scanned barcode
     * @param {string} code - The scanned barcode
     */
    function showSavePopup(code) {
        popupOverlay.style.display = 'flex';
        productNameInput.value = '';
        productNameInput.focus();

        popupSaveButton.onclick = () => {
            const productName = productNameInput.value.trim();
            if (productName) {
                saveScannedCode(code, productName);
                popupOverlay.style.display = 'none';
            } else {
                alert('Please enter a product name');
            }
        };

        popupCancelButton.onclick = () => {
            popupOverlay.style.display = 'none';
        };
    }

    /**
     * Saves the scanned code and product name to local storage
     * @param {string} code - The scanned barcode
     * @param {string} productName - The user-provided product name
     */
    function saveScannedCode(code, productName) {
        let scans = JSON.parse(localStorage.getItem('lastScans')) || [];
        const existingIndex = scans.findIndex(scan => scan.code === code);

        if (existingIndex !== -1) {
            scans[existingIndex].name = productName;
        } else {
            scans.unshift({ code, name: productName });
            scans = scans.slice(0, 10); // Keep only the last 10 scans
        }

        localStorage.setItem('lastScans', JSON.stringify(scans));
        updateLastScansList();
        saveButton.style.display = 'none';
    }

    /**
     * Updates the UI with the list of recent scans
     */
    function updateLastScansList() {
        let scans = JSON.parse(localStorage.getItem('lastScans')) || [];
        lastScansList.innerHTML = '';
        scans.forEach(scan => {
            let li = document.createElement('li');
            li.innerHTML = `
                <span>${scan.name} (${scan.code})</span>
                <button class="delete-btn" aria-label="Delete"><i class="fas fa-trash"></i></button>
            `;
            li.querySelector('span').addEventListener('click', () => {
                processBarcode(scan.code);
            });
            li.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteScannedCode(scan.code);
            });
            lastScansList.appendChild(li);
        });
    }

    /**
     * Deletes a saved scan from local storage
     * @param {string} code - The barcode to delete
     */
    function deleteScannedCode(code) {
        let scans = JSON.parse(localStorage.getItem('lastScans')) || [];
        scans = scans.filter(scan => scan.code !== code);
        localStorage.setItem('lastScans', JSON.stringify(scans));
        updateLastScansList();
    }

    // Event Listeners
    cameraSelect.addEventListener('change', initializeScanner);

    // Initialization
    populateCameraSelect().then(() => {
        initializeScanner();
    });

    Quagga.onProcessed(handleProcessed);
    Quagga.onDetected(handleDetected);
    updateLastScansList();
});