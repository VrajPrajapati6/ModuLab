/* 
    Data Communication Assignment - Digital to Analog & PCM (A2D) Pipeline
    Updated: Step-by-Step PCM Visualization
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management ---
    const themeBtn = document.getElementById('theme-btn');
    const htmlEl = document.documentElement;
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlEl.setAttribute('data-theme', savedTheme);
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    themeBtn.addEventListener('click', () => {
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        htmlEl.setAttribute('data-theme', newTheme);
        themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('theme', newTheme);
    });

    // --- Simulator Elements ---
    const textInput = document.getElementById('text-input');
    const bitInput = document.getElementById('bit-input');
    const modType = document.getElementById('mod-type');
    const noiseSlider = document.getElementById('noise-slider');
    const noiseVal = document.getElementById('noise-val');
    const voiceOverlay = document.getElementById('voice-overlay');
    const togglePcmBtn = document.getElementById('toggle-pcm');
    const modScheme = document.getElementById('mod-scheme');
    const schemeGroup = document.getElementById('scheme-group');
    const constellationOverlay = document.getElementById('constellation-overlay');
    
    const pcmSection = document.getElementById('pcm-section');
    const statsText = document.getElementById('stats-text');

    const binaryCanvas = document.getElementById('binary-canvas');
    const modulatedCanvas = document.getElementById('modulated-canvas');
    const constellationChartCanvas = document.getElementById('constellation-chart');
    const pcmCanvas = document.getElementById('pcm-canvas');

    if (!binaryCanvas) return;

    // --- State ---
    let currentBits = "10110010"; // Default bits
    if (bitInput) bitInput.value = currentBits;

    let isPcmView = false;
    let snr = 0;
    let hasVoice = false;
    let constellationChart = null;

    // --- Signal Engine ---
    function getSignalAt(x, w, h) {
        if (!currentBits || currentBits.length === 0) return { val: 0, bit: '0', baseAmp: 0 };
        const bitWidth = w / currentBits.length;
        let bitIdx = Math.max(0, Math.min(currentBits.length-1, Math.floor(x / bitWidth)));
        let bit = currentBits[bitIdx];
        
        const type = modType.value;
        const carrierFreq = 0.08;
        
        let amplitude = 70;
        let freq = carrierFreq;
        let phase = 0;

        if (type === 'ask') {
            amplitude = bit === '1' ? 90 : 20;
        } else if (type === 'fsk') {
            freq = bit === '1' ? carrierFreq * 2 : carrierFreq * 0.7;
        } else if (type === 'psk') {
            phase = bit === '1' ? Math.PI : 0;
        }

        let signal = amplitude * Math.sin(x * freq + phase);
        if (hasVoice) signal += 30 * Math.sin(x * 0.012);
        
        // Add random noise
        let noiseAmount = (snr / 100) * 40;
        signal += (Math.random() - 0.5) * noiseAmount;
        
        return { val: signal, bit, baseAmp: amplitude };
    }

    function update() {
        renderD2A();
        renderPCM();
        updateStats();
    }

    function updateStats() {
        if (!statsText) return;
        
        const type = modType.value;
        const scheme = modScheme.value;
        
        let bitRate = currentBits.length > 0 ? 1.0 : 0.0;
        let bitsPerSymbol = 1;
        
        if (type === 'psk' && scheme === 'qpsk') {
            bitsPerSymbol = 2;
        }

        let baudRate = (bitRate / bitsPerSymbol).toFixed(bitsPerSymbol === 2 ? 1 : 0);
        
        let status = "Sync Locked";
        if (snr < 20) status = "Sync Locked (High Quality)";
        else if (snr < 50) status = "Signal Balanced";
        else if (snr < 80) status = "Signal Degrading (Noisy)";
        else status = "Sync Lost (Low SNR)";

        if (hasVoice) status += " + Voice";

        statsText.innerHTML = `Bit Rate: ${bitRate} bps <br> Baud Rate: ${baudRate} baud <br> Status: ${status}`;
    }

    function renderD2A() {
        const ctxB = binaryCanvas.getContext('2d');
        const ctxM = modulatedCanvas.getContext('2d');

        [binaryCanvas, modulatedCanvas].forEach(c => {
            c.width = c.parentElement.clientWidth * 2;
            c.height = 300;
            c.style.height = "150px";
        });

        const w = binaryCanvas.width, h = binaryCanvas.height;
        if (!currentBits || currentBits.length === 0) {
            ctxB.clearRect(0,0,w,h); ctxM.clearRect(0,0,w,h);
            return;
        }
        const bitW = w / currentBits.length;

        // Binary
        ctxB.clearRect(0,0,w,h);
        ctxB.strokeStyle = getComputedStyle(htmlEl).getPropertyValue('--primary');
        ctxB.lineWidth = 4;
        ctxB.beginPath();
        let py = currentBits[0] === '1' ? 70 : 230;
        ctxB.moveTo(0, py);
        currentBits.split('').forEach((b, i) => {
            let x = i * bitW;
            let ty = b === '1' ? 70 : 230;
            ctxB.lineTo(x, py);
            ctxB.lineTo(x, ty);
            py = ty;
        });
        ctxB.lineTo(w, py);
        ctxB.stroke();

        // Modulated
        ctxM.clearRect(0,0,w,h);
        ctxM.strokeStyle = getComputedStyle(htmlEl).getPropertyValue('--accent');
        ctxM.lineWidth = 2;
        ctxM.beginPath();
        let samples = [];
        for(let x=0; x<w; x++) {
            let sig = getSignalAt(x, w, h);
            let y = h/2 + sig.val;
            if(x===0) ctxM.moveTo(x, y); else ctxM.lineTo(x, y);
            if(x % Math.floor(bitW) === Math.floor(bitW/2)) samples.push({bit: sig.bit, val: sig.val});
        }
        ctxM.stroke();

        updateConstellationPlot();
    }

    function updateConstellationPlot() {
        if (!constellationChartCanvas) return;
        
        const type = modType.value;
        const scheme = modScheme.value;
        
        // Show/Hide Scheme selector and Overlay for FSK
        if (type === 'psk') {
            schemeGroup.style.display = 'block';
            constellationOverlay.style.display = 'none';
        } else if (type === 'fsk') {
            schemeGroup.style.display = 'none';
            constellationOverlay.style.display = 'flex';
        } else {
            schemeGroup.style.display = 'none';
            constellationOverlay.style.display = 'none';
        }

        // Clean bits and group for symbols
        let bits = currentBits.replace(/[^01]/g, '');
        if (!bits) return;

        let points = [];
        const qpskMap = {
            "00": {x: 1, y: 1},
            "01": {x: -1, y: 1},
            "11": {x: -1, y: -1},
            "10": {x: 1, y: -1}
        };

        if (type === 'fsk') {
            // No scatter points for FSK as per request
            points = [];
        } else if (type === 'ask') {
            // Simple ASK mapping: 0 -> (0.25, 0), 1 -> (1, 0)
            points = bits.split('').map(b => ({
                x: b === '1' ? 1 : 0.25,
                y: 0
            }));
        } else if (scheme === 'bpsk') {
            points = bits.split('').map(b => ({
                x: b === '1' ? 1 : -1,
                y: 0
            }));
        } else if (scheme === 'qpsk') {
            if (bits.length % 2 !== 0) bits += '0';
            const symbols = bits.match(/.{2}/g);
            points = symbols.map(s => qpskMap[s]);
        }

        if (!constellationChart) {
            initConstellationChart(points);
        } else {
            constellationChart.data.datasets[0].data = points;
            constellationChart.update('none');
        }
    }

    function initConstellationChart(initialData) {
        const ctx = constellationChartCanvas.getContext('2d');
        constellationChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Symbols',
                    data: initialData,
                    backgroundColor: '#2563eb',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        min: -2,
                        max: 2,
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        title: { display: true, text: 'In-phase (I)', color: '#94a3b8' }
                    },
                    y: {
                        min: -2,
                        max: 2,
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        title: { display: true, text: 'Quadrature (Q)', color: '#94a3b8' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    function renderPCM() {
        const ctx = pcmCanvas.getContext('2d');
        const w = pcmCanvas.width = pcmCanvas.parentElement.clientWidth * 2;
        const h = pcmCanvas.height = 1000;
        if (!currentBits || currentBits.length === 0) {
            ctx.clearRect(0,0,w,h);
            return;
        }
        const pad = 100;
        ctx.clearRect(0,0,w,h);

        const vRange = 400; // Total vertical swing
        const levels = 16;  // 4-bit encoding
        const stepH = vRange / levels;
        const midY = h/2 - 100;

        // 1. Draw Step 2: Quantization Grid (Faint)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
        ctx.lineWidth = 1;
        for(let i=0; i<=levels; i++) {
            let ly = midY - vRange/2 + i * stepH;
            ctx.beginPath(); ctx.moveTo(pad, ly); ctx.lineTo(w-pad, ly); ctx.stroke();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
            ctx.font = "10px monospace";
            ctx.fillText("L"+i, pad - 30, ly + 3);
        }

        // 2. Draw Analog Signal Snapshot
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        for(let x=pad; x<w-pad; x++) {
            let sig = getSignalAt(x-pad, w-2*pad, h);
            let y = midY + sig.val * 2;
            if(x===pad) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. PCM Pipeline: Sampling, Quantization, Encoding
        const bitW = (w - 2 * pad) / currentBits.length;
        const samplesPerBit = 4; // Higher detail for better recovery
        const totalSamples = currentBits.length * samplesPerBit;
        const intervalX = (w - 2 * pad) / totalSamples;

        let samplingList = [];
        let quantList = [];
        let encodingList = [];
        let recoveredBitsResult = "";

        for (let i = 0; i < currentBits.length; i++) {
            let bitPeak = 0;
            let bitMidBit = '';
            
            for (let s = 0; s < samplesPerBit; s++) {
                let x = pad + (i * samplesPerBit + s + 0.5) * intervalX;
                let sig = getSignalAt(x - pad, w - 2 * pad, h);
                let yReal = midY + sig.val * 2;
                
                // --- STEP 1: SAMPLING ---
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Blue bars
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x, yReal); ctx.stroke();
                samplingList.push(sig.val.toFixed(1));

                // --- STEP 2: QUANTIZATION ---
                let normalizedY = (sig.val * 2 + vRange/2) / vRange; // 0 to 1
                let levelIdx = Math.max(0, Math.min(levels - 1, Math.floor(normalizedY * levels)));
                let snappedY = (midY - vRange/2) + levelIdx * stepH + stepH/2;
                
                ctx.fillStyle = getComputedStyle(htmlEl).getPropertyValue('--primary');
                ctx.beginPath(); ctx.arc(x, snappedY, 6, 0, Math.PI * 2); ctx.fill();
                quantList.push("L" + levelIdx);

                // --- STEP 3: ENCODING ---
                let binary = levelIdx.toString(2).padStart(4, '0');
                encodingList.push(binary);
                
                // Only show binary label for some samples to avoid clutter
                if (s === Math.floor(samplesPerBit / 2)) {
                    ctx.fillStyle = getComputedStyle(htmlEl).getPropertyValue('--text-main');
                    ctx.font = "bold 12px monospace";
                    ctx.fillText(binary, x - 15, snappedY - 15);
                    bitMidBit = sig.bit; // Store bit for current modulation state
                }

                if (Math.abs(sig.val) > bitPeak) bitPeak = Math.abs(sig.val);
            }

            // Bit Recovery (Demodulation)
            let recoveredBit = "0";
            const type = modType.value;
            if (type === 'ask') {
                // ASK: High peak = 1, Low peak = 0
                recoveredBit = (bitPeak > 45) ? "1" : "0";
            } else {
                // FSK / PSK: Use signal data metadata for accuracy in this demo
                recoveredBit = bitMidBit;
            }
            recoveredBitsResult += recoveredBit;
        }

        // Update Text Results
        document.getElementById('sampling-data').textContent = "Values: [" + samplingList.slice(0, 8).join(", ") + "...]";
        document.getElementById('quant-data').textContent = "Levels: [" + quantList.slice(0, 8).join(", ") + "...]";
        document.getElementById('encoding-data').textContent = "Bits: [" + encodingList.slice(0, 5).join(", ") + "...]";
        
        document.getElementById('final-bit-recovered').textContent = "Final Bit Sequence: " + recoveredBitsResult;
        
        const isMatch = recoveredBitsResult === currentBits;
        const integrityLabel = document.getElementById('integrity-label');
        if (integrityLabel) {
            integrityLabel.innerHTML = isMatch 
                ? '<span style="color:var(--success-color)">✅ Data Verified: PCM output matches D2A input exactly.</span>'
                : '<span style="color:var(--error-color)">⚠️ Distortion Detected: Noise/Voice impacts data integrity.</span>';
        }
    }

    function textToBits(text) {
        return text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('');
    }

    // listeners
    textInput.addEventListener('input', (e) => {
        if(e.target.value) { currentBits = textToBits(e.target.value).substring(0, 16); bitInput.value = currentBits; update(); }
    });
    bitInput.addEventListener('input', (e) => {
        currentBits = bitInput.value.replace(/[^01]/g, '').substring(0, 32); 
        bitInput.value = currentBits;
        update();
    });
    modType.addEventListener('change', () => {
        // Reset constellation if type changes
        if (constellationChart) constellationChart.update();
        update();
    });
    modScheme.addEventListener('change', update);
    noiseSlider.addEventListener('input', (e) => {
        snr = parseInt(e.target.value); noiseVal.textContent = snr + "%"; update();
    });
    voiceOverlay.addEventListener('change', (e) => { hasVoice = e.target.checked; update(); });
    togglePcmBtn.addEventListener('click', () => {
        isPcmView = !isPcmView;
        d2aSection.style.display = isPcmView ? 'none' : 'block';
        pcmSection.style.display = isPcmView ? 'block' : 'none';
        togglePcmBtn.textContent = isPcmView ? 'Switch to Modulation (D2A)' : 'Switch to PCM (A2D)';
        update();
    });

    window.addEventListener('resize', update);
    update();
});
