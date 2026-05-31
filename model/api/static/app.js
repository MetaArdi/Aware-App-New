// api/static/app.js
// AWARE Fatigue Detection Dashboard - Logic

document.addEventListener("DOMContentLoaded", () => {
    // ── STORES & STATE ───────────────────────────────────────
    let currentTab = "single-image";
    let threshold = 0.50;
    
    // Webcam state
    let webcamStream = null;
    let webcamActive = false;
    let webcamIntervalId = null;
    let lastFrameTime = performance.now();
    let fpsHistory = [];
    
    // Stats state
    const stats = {
        total: 0,
        fit: 0,
        fatigue: 0
    };
    
    // Batch processing state
    let batchResultsList = [];

    // Elements
    const elements = {
        navButtons: document.querySelectorAll(".nav-btn"),
        tabPanels: document.querySelectorAll(".tab-panel"),
        thresholdRange: document.getElementById("threshold-range"),
        thresholdVal: document.getElementById("threshold-val"),
        
        // Single Image Upload
        dropZone: document.getElementById("drop-zone"),
        fileInput: document.getElementById("file-input"),
        previewContainer: document.getElementById("preview-container"),
        imagePreview: document.getElementById("image-preview"),
        removePreviewBtn: document.getElementById("remove-preview-btn"),
        resultCard: document.getElementById("result-card"),
        resultEmptyState: document.getElementById("result-empty-state"),
        resultContent: document.getElementById("result-content"),
        fitBadge: document.getElementById("fit-badge"),
        riskBadge: document.getElementById("risk-badge"),
        probVal: document.getElementById("prob-val"),
        probBar: document.getElementById("prob-bar"),
        confVal: document.getElementById("conf-val"),
        confBar: document.getElementById("conf-bar"),
        employeeId: document.getElementById("employee-id"),
        btnSubmitPredict: document.getElementById("btn-submit-predict"),
        
        // Live Webcam
        btnStartCamera: document.getElementById("btn-start-camera"),
        btnStopCamera: document.getElementById("btn-stop-camera"),
        webcamVideo: document.getElementById("webcam-video"),
        webcamPlaceholder: document.getElementById("webcam-placeholder"),
        webcamHud: document.getElementById("webcam-hud"),
        hudFps: document.getElementById("hud-fps"),
        hudLatency: document.getElementById("hud-latency"),
        liveStatus: document.getElementById("live-status"),
        liveStatusCircle: document.getElementById("live-status-circle"),
        liveFitText: document.getElementById("live-fit-text"),
        liveRiskText: document.getElementById("live-risk-text"),
        liveProbPercent: document.getElementById("live-prob-percent"),
        liveProbBar: document.getElementById("live-prob-bar"),
        liveConfPercent: document.getElementById("live-conf-percent"),
        liveConfBar: document.getElementById("live-conf-bar"),
        liveAlerts: document.getElementById("live-alerts"),
        
        // Batch
        batchDropZone: document.getElementById("batch-drop-zone"),
        batchFileInput: document.getElementById("batch-file-input"),
        batchProgressSection: document.getElementById("batch-progress-section"),
        batchProgressText: document.getElementById("batch-progress-text"),
        batchProgressPercentage: document.getElementById("batch-progress-percentage"),
        batchProgressBar: document.getElementById("batch-progress-bar"),
        batchTableContainer: document.getElementById("batch-table-container"),
        batchTableBody: document.getElementById("batch-table-body"),
        btnExportCsv: document.getElementById("btn-export-csv"),
        
        // Stats
        statTotal: document.getElementById("stat-total"),
        statFit: document.getElementById("stat-fit"),
        statFatigue: document.getElementById("stat-fatigue"),
        apiHost: document.getElementById("api-host"),
        apiHealthBadge: document.getElementById("api-health-badge"),
        
        // Notifications
        notifications: document.getElementById("notification-container")
    };

    // ── INITIALIZATION & GENERAL CONTROLS ─────────────────────
    
    // Set Host API details
    elements.apiHost.textContent = window.location.origin;
    checkApiHealth();

    // Tab Switching
    elements.navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            switchTab(targetTab);
        });
    });

    function switchTab(tabId) {
        currentTab = tabId;
        
        // Update navigation buttons
        elements.navButtons.forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
        });
        
        // Update tab panels
        elements.tabPanels.forEach(panel => {
            panel.classList.toggle("active", panel.id === `${tabId}-tab`);
        });

        // Pause/stop camera if leaving webcam tab
        if (tabId !== "webcam" && webcamActive) {
            stopWebcam();
        }
    }

    // Threshold Slider
    elements.thresholdRange.addEventListener("input", (e) => {
        threshold = parseFloat(e.target.value);
        elements.thresholdVal.textContent = threshold.toFixed(2);
    });

    // ── NOTIFICATION TOAST ────────────────────────────────────
    function showNotification(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        const icon = document.createElement("i");
        icon.className = type === "success" 
            ? "fa-solid fa-circle-check" 
            : "fa-solid fa-triangle-exclamation";
            
        const text = document.createElement("p");
        text.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(text);
        elements.notifications.appendChild(toast);

        // Remove toast after 4s
        setTimeout(() => {
            toast.style.animation = "slideIn 0.3s reverse forwards";
            toast.addEventListener("animationend", () => {
                toast.remove();
            });
        }, 4000);
    }

    // API Health check
    async function checkApiHealth() {
        try {
            const res = await fetch("/health");
            if (res.ok) {
                elements.apiHealthBadge.textContent = "ONLINE";
                elements.apiHealthBadge.className = "badge badge-success";
            } else {
                throw new Error("HTTP error");
            }
        } catch (e) {
            elements.apiHealthBadge.textContent = "OFFLINE";
            elements.apiHealthBadge.className = "badge badge-danger";
            showNotification("Gagal terhubung ke API backend AWARE.", "error");
        }
    }

    // ── SINGLE IMAGE TAB LOGIC ──────────────────────────────
    let selectedImageFile = null;

    // Dropzone Events
    ["dragenter", "dragover"].forEach(eventName => {
        elements.dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            elements.dropZone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        elements.dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            elements.dropZone.classList.remove("dragover");
        }, false);
    });

    elements.dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleSingleImageSelect(files[0]);
        }
    });

    elements.dropZone.addEventListener("click", () => {
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleSingleImageSelect(e.target.files[0]);
        }
    });

    function handleSingleImageSelect(file) {
        if (!file.type.match("image.*")) {
            showNotification("File harus berupa gambar (JPEG/PNG/WEBP)!", "error");
            return;
        }
        
        selectedImageFile = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            elements.imagePreview.src = e.target.result;
            elements.dropZone.style.display = "none";
            elements.previewContainer.style.display = "flex";
            elements.btnSubmitPredict.disabled = false;
        };
        reader.readAsDataURL(file);
        
        // Reset results card
        resetSingleResultCard();
    }

    elements.removePreviewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedImageFile = null;
        elements.fileInput.value = "";
        elements.imagePreview.src = "";
        elements.previewContainer.style.display = "none";
        elements.dropZone.style.display = "block";
        elements.btnSubmitPredict.disabled = true;
        resetSingleResultCard();
    });

    function resetSingleResultCard() {
        elements.resultCard.classList.add("empty");
        elements.resultEmptyState.style.display = "flex";
        elements.resultContent.style.display = "none";
    }

    // Submit Analysis
    elements.btnSubmitPredict.addEventListener("click", async () => {
        if (!selectedImageFile) return;

        elements.btnSubmitPredict.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menganalisis...';
        elements.btnSubmitPredict.disabled = true;

        const formData = new FormData();
        formData.append("file", selectedImageFile);
        
        const empId = elements.employeeId.value.trim();
        if (empId) formData.append("employee_id", empId);
        
        formData.append("threshold", threshold);

        try {
            const response = await fetch(`/predict?threshold=${threshold}`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Terjadi kesalahan server");
            }

            const result = await response.json();
            displaySingleResult(result);
            showNotification("Inference berhasil diselesaikan!");
            
            // Update stats
            updateAggregatedStats(result.fit_to_work);

        } catch (error) {
            showNotification(error.message, "error");
        } finally {
            elements.btnSubmitPredict.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Jalankan Analisis';
            elements.btnSubmitPredict.disabled = false;
        }
    });

    function displaySingleResult(data) {
        elements.resultCard.classList.remove("empty");
        elements.resultEmptyState.style.display = "none";
        elements.resultContent.style.display = "block";

        // Fit Badge
        elements.fitBadge.className = "fit-badge";
        if (data.fit_to_work === "FIT") {
            elements.fitBadge.textContent = "✅ READY TO WORK (FIT)";
            elements.fitBadge.classList.add("fit");
        } else if (data.fit_to_work === "AT RISK") {
            elements.fitBadge.textContent = "⚠️ AT RISK (BUT FIT)";
            elements.fitBadge.classList.add("at-risk");
        } else {
            elements.fitBadge.textContent = "🚫 REST MANDATORY (NOT FIT)";
            elements.fitBadge.classList.add("not-fit");
        }

        // Risk Level
        elements.riskBadge.className = "risk-badge";
        elements.riskBadge.textContent = `${data.risk_level} Risk`;
        elements.riskBadge.classList.add(data.risk_level.toLowerCase());

        // Probability
        const probPct = (data.fatigue_probability * 100).toFixed(2);
        elements.probVal.textContent = `${probPct}%`;
        elements.probBar.style.width = `${probPct}%`;
        
        // Color transition for probability bar based on risk
        if (data.risk_level === "High") {
            elements.probBar.style.background = "var(--danger)";
        } else if (data.risk_level === "Medium") {
            elements.probBar.style.background = "var(--warning)";
        } else {
            elements.probBar.style.background = "var(--success)";
        }

        // Confidence
        const confPct = (data.confidence * 100).toFixed(2);
        elements.confVal.textContent = `${confPct}%`;
        elements.confBar.style.width = `${confPct}%`;
    }

    // ── LIVE WEBCAM LOGIC ────────────────────────────────────
    elements.btnStartCamera.addEventListener("click", startWebcam);
    elements.btnStopCamera.addEventListener("click", stopWebcam);

    async function startWebcam() {
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 },
                    facingMode: "user"
                },
                audio: false
            });
            
            elements.webcamVideo.srcObject = webcamStream;
            elements.webcamPlaceholder.style.display = "none";
            elements.webcamHud.style.display = "flex";
            elements.btnStopCamera.style.display = "inline-flex";
            
            webcamActive = true;
            fpsHistory = [];
            lastFrameTime = performance.now();
            
            // Start capturing frames
            webcamIntervalId = setInterval(captureWebcamFrame, 350); // ~3 FPS, good balance
            showNotification("Kamera aktif. Mulai telemetri deteksi.", "success");
            
            // Set hud loading
            elements.liveFitText.textContent = "PROCESSING...";
            elements.liveRiskText.textContent = "Waiting for frames";
            elements.liveStatusCircle.className = "status-circle";
            
        } catch (err) {
            console.error(err);
            showNotification("Gagal mengakses kamera. Izinkan akses kamera browser.", "error");
        }
    }

    function stopWebcam() {
        webcamActive = false;
        
        if (webcamIntervalId) {
            clearInterval(webcamIntervalId);
            webcamIntervalId = null;
        }

        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }

        elements.webcamVideo.srcObject = null;
        elements.webcamPlaceholder.style.display = "flex";
        elements.webcamHud.style.display = "none";
        elements.btnStopCamera.style.display = "none";
        
        // Reset Hud
        elements.liveFitText.textContent = "SYSTEM INACTIVE";
        elements.liveRiskText.textContent = "N/A Risk Level";
        elements.liveStatusCircle.className = "status-circle";
        elements.liveStatusCircle.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
        elements.liveProbPercent.textContent = "0%";
        elements.liveProbBar.style.width = "0%";
        elements.liveConfPercent.textContent = "0%";
        elements.liveConfBar.style.width = "0%";
        
        elements.liveAlerts.innerHTML = `
            <div class="alert-box info-alert">
                <i class="fa-solid fa-circle-info"></i>
                <p>Posisikan wajah Anda tepat di depan kamera. Pastikan pencahayaan ruangan cukup terang.</p>
            </div>
        `;
    }

    async function captureWebcamFrame() {
        if (!webcamActive || !webcamStream) return;

        const video = elements.webcamVideo;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        // Create temporary offscreen canvas at MobileNetV2 input size
        const canvas = document.createElement("canvas");
        canvas.width = 224;
        canvas.height = 224;
        const ctx = canvas.getContext("2d");
        
        // Draw centered square frame to match MobileNetV2 aspect ratio
        const size = Math.min(video.videoWidth, video.videoHeight);
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224);

        // Convert to Blob and send
        canvas.toBlob(async (blob) => {
            if (!blob) return;

            const sendTime = performance.now();
            const formData = new FormData();
            formData.append("file", blob, "webcam_frame.jpg");

            try {
                const response = await fetch(`/predict?threshold=${threshold}`, {
                    method: "POST",
                    body: formData
                });

                if (!response.ok) return;

                const result = await response.json();
                
                // Telemetry computations
                const receiveTime = performance.now();
                const latency = Math.round(receiveTime - sendTime);
                elements.hudLatency.textContent = `${latency}ms`;

                // Calculate FPS
                const fps = Math.round(1000 / (receiveTime - lastFrameTime));
                lastFrameTime = receiveTime;
                
                fpsHistory.push(fps);
                if (fpsHistory.length > 10) fpsHistory.shift();
                const avgFps = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
                elements.hudFps.textContent = avgFps;

                // Display Telemetry Result
                displayLiveTelemetry(result);

            } catch (err) {
                console.error("Webcam inference error:", err);
            }
        }, "image/jpeg", 0.7);
    }

    function displayLiveTelemetry(data) {
        // Status circle icon & class
        elements.liveStatusCircle.className = "status-circle";
        if (data.fit_to_work === "FIT") {
            elements.liveStatusCircle.classList.add("fit");
            elements.liveStatusCircle.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            elements.liveFitText.textContent = "READY TO WORK (FIT)";
            elements.liveRiskText.textContent = `${data.risk_level} Fatigue Risk`;
            elements.liveAlerts.innerHTML = `
                <div class="alert-box info-alert">
                    <i class="fa-solid fa-circle-info"></i>
                    <p>Kondisi Anda terdeteksi prima. Tetap utamakan keselamatan kerja!</p>
                </div>
            `;
        } else if (data.fit_to_work === "AT RISK") {
            elements.liveStatusCircle.classList.add("at-risk");
            elements.liveStatusCircle.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            elements.liveFitText.textContent = "ALERT: AT RISK";
            elements.liveRiskText.textContent = `${data.risk_level} Fatigue Risk`;
            elements.liveAlerts.innerHTML = `
                <div class="alert-box info-alert" style="background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.2); color:#fde047;">
                    <i class="fa-solid fa-mug-hot"></i>
                    <p>Terdeteksi sedikit kelelahan. Direkomendasikan minum air putih atau peregangan ringan.</p>
                </div>
            `;
        } else {
            elements.liveStatusCircle.classList.add("not-fit");
            elements.liveStatusCircle.innerHTML = '<i class="fa-solid fa-face-tired"></i>';
            elements.liveFitText.textContent = "NOT FIT (FATIGUE ⚠️)";
            elements.liveRiskText.textContent = `${data.risk_level} Fatigue Risk`;
            elements.liveAlerts.innerHTML = `
                <div class="alert-box danger-alert">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p><strong>Bahaya!</strong> Indeks kelelahan melampaui batas aman. Segera lakukan istirahat minimal 15 menit.</p>
                </div>
            `;
        }

        // Live Bars
        const probPct = (data.fatigue_probability * 100).toFixed(0);
        elements.liveProbPercent.textContent = `${probPct}%`;
        elements.liveProbBar.style.width = `${probPct}%`;
        
        if (data.risk_level === "High") {
            elements.liveProbBar.style.background = "var(--danger)";
        } else if (data.risk_level === "Medium") {
            elements.liveProbBar.style.background = "var(--warning)";
        } else {
            elements.liveProbBar.style.background = "var(--success)";
        }

        const confPct = (data.confidence * 100).toFixed(0);
        elements.liveConfPercent.textContent = `${confPct}%`;
        elements.liveConfBar.style.width = `${confPct}%`;

        // Update statistics storage dynamically
        updateAggregatedStats(data.fit_to_work);
    }

    // ── BATCH PROCESS TAB LOGIC ──────────────────────────────
    
    // Dropzone Events
    ["dragenter", "dragover"].forEach(eventName => {
        elements.batchDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            elements.batchDropZone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        elements.batchDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            elements.batchDropZone.classList.remove("dragover");
        }, false);
    });

    elements.batchDropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            processBatchFiles(files);
        }
    });

    elements.batchFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            processBatchFiles(e.target.files);
        }
    });

    async function processBatchFiles(files) {
        const imageFiles = Array.from(files).filter(file => file.type.match("image.*"));
        if (imageFiles.length === 0) {
            showNotification("Tidak ada file gambar yang valid dipilih!", "error");
            return;
        }

        // Reset Table & Lists
        elements.batchTableBody.innerHTML = "";
        batchResultsList = [];
        elements.batchTableContainer.style.display = "none";
        elements.btnExportCsv.disabled = true;

        // Show progress bar
        elements.batchProgressSection.style.display = "block";
        elements.batchProgressText.textContent = `Memproses 0 dari ${imageFiles.length} file...`;
        elements.batchProgressPercentage.textContent = "0%";
        elements.batchProgressBar.style.width = "0%";

        let processedCount = 0;

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            const formData = new FormData();
            formData.append("file", file);
            formData.append("threshold", threshold);

            try {
                const response = await fetch(`/predict?threshold=${threshold}`, {
                    method: "POST",
                    body: formData
                });

                if (!response.ok) {
                    throw new Error("HTTP error on file " + file.name);
                }

                const result = await response.json();
                
                // Add to list
                const record = {
                    filename: file.name,
                    fatigue_probability: result.fatigue_probability,
                    risk_level: result.risk_level,
                    fit_to_work: result.fit_to_work,
                    confidence: result.confidence
                };
                
                batchResultsList.push(record);
                
                // Append row to table
                appendBatchRow(record);
                
                // Update general stats
                updateAggregatedStats(result.fit_to_work);

            } catch (err) {
                console.error(err);
                appendBatchRow({
                    filename: file.name,
                    fatigue_probability: -1,
                    risk_level: "ERROR",
                    fit_to_work: "ERROR",
                    confidence: 0
                });
            }

            processedCount++;
            const pct = Math.round((processedCount / imageFiles.length) * 100);
            elements.batchProgressText.textContent = `Memproses ${processedCount} dari ${imageFiles.length} file...`;
            elements.batchProgressPercentage.textContent = `${pct}%`;
            elements.batchProgressBar.style.width = `${pct}%`;
        }

        // Processing finished
        showNotification(`Batch selesai. Berhasil memproses ${imageFiles.length} file.`);
        elements.batchTableContainer.style.display = "block";
        if (batchResultsList.length > 0) {
            elements.btnExportCsv.disabled = false;
        }
    }

    function appendBatchRow(data) {
        const tr = document.createElement("tr");
        
        // Filename
        const tdName = document.createElement("td");
        tdName.textContent = data.filename;
        tr.appendChild(tdName);

        // Probability
        const tdProb = document.createElement("td");
        if (data.fatigue_probability >= 0) {
            tdProb.textContent = `${(data.fatigue_probability * 100).toFixed(2)}%`;
        } else {
            tdProb.textContent = "N/A";
        }
        tr.appendChild(tdProb);

        // Risk Level
        const tdRisk = document.createElement("td");
        const spanRisk = document.createElement("span");
        spanRisk.className = `badge`;
        if (data.risk_level === "Low") {
            spanRisk.classList.add("badge-success");
        } else if (data.risk_level === "Medium") {
            spanRisk.classList.add("badge-warning");
        } else if (data.risk_level === "High") {
            spanRisk.classList.add("badge-danger");
        } else {
            spanRisk.classList.add("badge-secondary");
        }
        spanRisk.textContent = data.risk_level;
        tdRisk.appendChild(spanRisk);
        tr.appendChild(tdRisk);

        // Readiness Status
        const tdFit = document.createElement("td");
        const spanFit = document.createElement("span");
        spanFit.className = "badge";
        if (data.fit_to_work === "FIT") {
            spanFit.classList.add("badge-success");
            spanFit.textContent = "✅ READY / FIT";
        } else if (data.fit_to_work === "AT RISK") {
            spanFit.classList.add("badge-warning");
            spanFit.textContent = "⚠️ AT RISK";
        } else if (data.fit_to_work === "NOT FIT") {
            spanFit.classList.add("badge-danger");
            spanFit.textContent = "🚫 MANDATORY REST";
        } else {
            spanFit.classList.add("badge-secondary");
            spanFit.textContent = "ERROR";
        }
        tdFit.appendChild(spanFit);
        tr.appendChild(tdFit);

        // Confidence
        const tdConf = document.createElement("td");
        tdConf.textContent = data.fatigue_probability >= 0 
            ? `${(data.confidence * 100).toFixed(1)}%` 
            : "-";
        tr.appendChild(tdConf);

        elements.batchTableBody.appendChild(tr);
    }

    // Export CSV
    elements.btnExportCsv.addEventListener("click", () => {
        if (batchResultsList.length === 0) return;

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Filename,Fatigue Probability,Risk Level,Fit to Work,Confidence\n";

        batchResultsList.forEach(r => {
            csvContent += `"${r.filename}",${r.fatigue_probability},"${r.risk_level}","${r.fit_to_work}",${r.confidence}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `aware_screening_report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification("Ekspor CSV berhasil diunduh.");
    });

    // ── STATS ACCUMULATION LOGIC ─────────────────────────────
    function updateAggregatedStats(fitStatus) {
        stats.total++;
        if (fitStatus === "FIT" || fitStatus === "AT RISK") {
            stats.fit++;
        } else {
            stats.fatigue++;
        }

        // Render to UI
        elements.statTotal.textContent = stats.total;
        elements.statFit.textContent = stats.fit;
        elements.statFatigue.textContent = stats.fatigue;
    }
});
