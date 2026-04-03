/* 
    Data Transmission Visualizer Logic
    Author: Antigravity AI
    Feature: End-to-End Pipeline Visualization
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Management ---
    const themeBtn = document.getElementById('theme-btn');
    const htmlEl = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlEl.setAttribute('data-theme', savedTheme);
    if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = htmlEl.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            htmlEl.setAttribute('data-theme', newTheme);
            themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            localStorage.setItem('theme', newTheme);
        });
    }

    // --- Selectors ---
    const transInput = document.getElementById('trans-input');
    const transMod = document.getElementById('trans-mod');
    const transNoise = document.getElementById('trans-noise');
    const transNoiseVal = document.getElementById('trans-noise-val');

    // Display Boxes
    const stepInput = document.getElementById('step-input');
    const stepEncoding = document.getElementById('step-encoding');
    const stepFraming = document.getElementById('step-framing');
    const stepModulation = document.getElementById('step-modulation');
    const stepChannel = document.getElementById('step-channel');
    const stepDemodulation = document.getElementById('step-demodulation');
    const stepDecoding = document.getElementById('step-decoding');
    const stepOutput = document.getElementById('step-output');
    const integrityBadge = document.getElementById('integrity-badge');

    const modCanvas = document.getElementById('mod-canvas');
    const demodCanvas = document.getElementById('demod-canvas');

    function update() {
        const text = transInput.value || "";
        const modType = transMod.value;
        const noiseLevel = parseInt(transNoise.value);
        if (transNoiseVal) transNoiseVal.textContent = noiseLevel + "%";

        // 1. Input step
        stepInput.textContent = text ? `"${text}"` : "(Empty)";

        // 2. Encoding step
        const bitStream = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
        stepEncoding.textContent = bitStream || "...";

        // 3. Framing step
        let framedMarkup = "";
        const charBits = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0'));
        charBits.forEach(bits => {
            framedMarkup += `<span class="frame-box"><span class="frame-marker">[START]</span> ${bits} <span class="frame-marker">[END]</span></span> `;
        });
        stepFraming.innerHTML = framedMarkup || "...";

        // 4. Modulation step
        const modDescriptions = {
            'ask': 'Signal: Amplitude shifts (High for 1, Low for 0)',
            'fsk': 'Signal: Frequency shifts (Fast for 1, Slow for 0)',
            'psk': 'Signal: Phase shifts (180° for 1, 0° for 0)'
        };
        stepModulation.textContent = modDescriptions[modType];

        // 5. Channel Simulation (Noise Injection)
        let modifiedBits = "";
        let errorCount = 0;
        for (let i = 0; i < bitStream.length; i++) {
            let bit = bitStream[i];
            // Probability of error increases with noise slider
            const errorProbability = noiseLevel / 400; // Max 25% chance of error at 100% noise
            if (Math.random() < errorProbability) {
                bit = bit === "1" ? "0" : "1";
                errorCount++;
                modifiedBits += `<span class="bit-diff">${bit}</span>`;
            } else {
                modifiedBits += bit;
            }
        }
        stepChannel.innerHTML = modifiedBits || "...";

        // 6. Demodulation
        // Convert the colored markup back to a clean string for further processing
        const cleanModifiedBits = stepChannel.innerText;
        stepDemodulation.textContent = cleanModifiedBits || "...";

        // 7. Decoding & Deframing
        let receivedText = "";
        let decodingMarkup = "";
        
        for (let i = 0; i < cleanModifiedBits.length; i += 8) {
            const byte = cleanModifiedBits.substring(i, i + 8);
            if (byte.length < 8) break;
            
            const charCode = parseInt(byte, 2);
            const originalChar = text[Math.floor(i/8)];
            const receivedChar = String.fromCharCode(charCode);
            
            if (receivedChar === originalChar) {
                decodingMarkup += `<span>${byte}</span> `;
                receivedText += receivedChar;
            } else {
                decodingMarkup += `<span class="error-bit" style="color:var(--error-color)">${byte}</span> `;
                receivedText += `<span class="error-highlight">${receivedChar}</span>`;
            }
        }
        stepDecoding.innerHTML = decodingMarkup || "...";

        // 8. Final Output
        stepOutput.innerHTML = receivedText || "...";

        // 9. Signal Rendering
        renderSignals(bitStream, cleanModifiedBits, modType);
        
        // Integrity Badge
        if (text) {
            if (errorCount === 0) {
                integrityBadge.innerHTML = '<span class="badge" style="background:#059669; color:white; border:none;">CLEAN DATA</span>';
            } else {
                integrityBadge.innerHTML = `<span class="badge" style="background:#dc2626; color:white; border:none;">${errorCount} ERRORS DETECTED</span>`;
            }
        } else {
            integrityBadge.innerHTML = '';
        }
    }

    function renderSignals(originalBits, noisyBits, type) {
        const modCtx = modCanvas.getContext('2d');
        const demodCtx = demodCanvas.getContext('2d');

        [modCanvas, demodCanvas].forEach(c => {
            c.width = c.parentElement.clientWidth * 2;
            c.height = 240;
        });

        drawWave(modCtx, originalBits, type, modCanvas.width, modCanvas.height);
        drawWave(demodCtx, noisyBits, type, demodCanvas.width, demodCanvas.height);
    }

    function drawWave(ctx, bits, type, w, h) {
        ctx.clearRect(0,0,w,h);
        if (!bits || bits.length === 0) return;

        const pad = 40;
        const displayBits = bits.substring(0, 16);
        const bitW = (w - 2 * pad) / displayBits.length;
        
        // Get theme primary color
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        ctx.strokeStyle = primaryColor || '#3b82f6';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < displayBits.length; i++) {
            const bit = displayBits[i];
            for (let x = 0; x < bitW; x++) {
                const totalX = pad + i * bitW + x;
                let y = 0;
                let t = (i * bitW + x) * 0.15; // frequency scale

                if (type === 'ask') {
                    const amp = bit === '1' ? 1 : 0.25;
                    y = Math.sin(t * 1.5) * amp;
                } else if (type === 'fsk') {
                    const freq = bit === '1' ? 3 : 1;
                    y = Math.sin(t * freq);
                } else if (type === 'psk') {
                    const phase = bit === '1' ? Math.PI : 0;
                    y = Math.sin(t * 1.5 + phase);
                }

                const plotY = h / 2 - y * (h / 3);
                if (i === 0 && x === 0) ctx.moveTo(totalX, plotY);
                else ctx.lineTo(totalX, plotY);
            }
        }
        ctx.stroke();
    }

    // Event Listeners
    transInput.addEventListener('input', update);
    transMod.addEventListener('change', update);
    transNoise.addEventListener('input', update);

    update(); // Initial run
});
