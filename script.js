/* ====================================================================
   MODULAB — Digital Communication System Simulator
   Complete pipeline: Input → Line Coding → Modulation → Noise →
                      Error Detection → Multiplexing
   ====================================================================
   STRUCTURE:
   1. Top-level pipeline functions (called by HTML onclick handlers)
   2. DOMContentLoaded block (existing modulation UI + live flow)
   3. Plotly helpers shared across all stages
   ==================================================================== */


/* ====================================================================
   GLOBAL STATE — shared data between pipeline stages
   ==================================================================== */

const pipelineState = {
    bits: [],
    lineCoded: null,
    modulated: null,
    noisy: null,
    errorResult: null,
    muxResult: null
};


/* ====================================================================
   UTILITY FUNCTIONS
   ==================================================================== */

/**
 * Parse the bit stream input string into an array of 0s and 1s.
 */
function parseBits(inputStr) {
    return inputStr
        .split('')
        .filter(ch => ch === '0' || ch === '1')
        .map(Number);
}

/**
 * Generate Gaussian random noise using Box-Muller transform.
 */
function gaussianNoise(sigma) {
    let u1 = Math.random();
    let u2 = Math.random();
    while (u1 === 0) u1 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z * sigma;
}

/**
 * Synchronize the muxSignal1 input with the main bit stream input.
 */
function syncMuxSignal() {
    const mux1 = document.getElementById('muxSignal1');
    const bitInput = document.getElementById('bitStream');
    if (mux1 && bitInput) {
        mux1.value = bitInput.value;
    }
}


/* ====================================================================
   PLOTLY HELPERS — matching ModuLab's transparent/orange style
   ==================================================================== */

function getBaseLayout(height, yRange) {
    return {
        height: height || 180,
        margin: { t: 5, l: 45, r: 20, b: 30 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        xaxis: {
            showgrid: true,
            gridcolor: "#f1f5f9",
            zeroline: false,
            tickfont: { size: 10, family: 'Inter' },
            title: { text: 'Time', font: { size: 10, family: 'Inter' } }
        },
        yaxis: {
            showgrid: true,
            gridcolor: "#f1f5f9",
            zeroline: true,
            zerolinecolor: '#e2e8f0',
            tickfont: { size: 10, family: 'Inter' },
            range: yRange || null
        },
        autosize: true
    };
}

const plotConfig = { responsive: true, displayModeBar: false };

/**
 * Plot a single-color signal trace.
 */
function plotPipelineSignal(elementId, x, y, color, lineShape, yRange) {
    const trace = {
        x: x,
        y: y,
        type: 'scatter',
        mode: 'lines',
        line: { color: color || '#ff6b00', width: 2, shape: lineShape || 'linear' },
        showlegend: false
    };
    const layout = getBaseLayout(180, yRange);
    Plotly.newPlot(elementId, [trace], layout, plotConfig);
}

/**
 * Plot a signal with color-segmented traces based on bit values.
 * Bit 1 = orange (#ff6b00), Bit 0 = dark navy (#0f172a).
 */
function plotPipelineSegmented(elementId, x, y, bits, lineShape, yRange) {
    const x1 = [], y1 = [], x0 = [], y0 = [];

    for (let i = 0; i < x.length; i++) {
        const currentBit = bits[i];
        const px = x[i];
        const py = y[i];

        if (i > 0 && currentBit !== bits[i - 1]) {
            x1.push(px); y1.push(py);
            x0.push(px); y0.push(py);
            if (currentBit === 1) {
                x0.push(null); y0.push(null);
            } else {
                x1.push(null); y1.push(null);
            }
        } else {
            if (currentBit === 1) {
                x1.push(px); y1.push(py);
            } else {
                x0.push(px); y0.push(py);
            }
        }
    }

    const trace1 = {
        x: x1, y: y1,
        type: 'scatter', mode: 'lines',
        name: 'Bit 1',
        line: { color: '#ff6b00', width: 2, shape: lineShape },
        showlegend: false
    };
    const trace0 = {
        x: x0, y: y0,
        type: 'scatter', mode: 'lines',
        name: 'Bit 0',
        line: { color: '#0f172a', width: 2, shape: lineShape },
        showlegend: false
    };

    const layout = getBaseLayout(180, yRange);
    Plotly.newPlot(elementId, [trace0, trace1], layout, plotConfig);
}


/* ====================================================================
   STAGE 1: LINE CODING
   ====================================================================
   NRZ-L, NRZ-I, Manchester, Differential Manchester, AMI
   ==================================================================== */

function generateNRZL(bits) {
    const time = [], signal = [];
    const spb = 100; // samples per bit
    for (let i = 0; i < bits.length; i++) {
        const level = bits[i] === 1 ? 1 : -1;
        for (let s = 0; s < spb; s++) {
            time.push(i + s / spb);
            signal.push(level);
        }
    }
    return { time, signal };
}

function generateNRZI(bits) {
    const time = [], signal = [];
    const spb = 100;
    let currentLevel = 1;
    for (let i = 0; i < bits.length; i++) {
        if (bits[i] === 1) currentLevel = -currentLevel;
        for (let s = 0; s < spb; s++) {
            time.push(i + s / spb);
            signal.push(currentLevel);
        }
    }
    return { time, signal };
}

function generateManchester(bits) {
    const time = [], signal = [];
    const spb = 100;
    const half = spb / 2;
    for (let i = 0; i < bits.length; i++) {
        for (let s = 0; s < spb; s++) {
            time.push(i + s / spb);
            if (bits[i] === 1) {
                signal.push(s < half ? 1 : -1);
            } else {
                signal.push(s < half ? -1 : 1);
            }
        }
    }
    return { time, signal };
}

function generateDiffManchester(bits) {
    const time = [], signal = [];
    const spb = 100;
    const half = spb / 2;
    let currentLevel = 1;
    for (let i = 0; i < bits.length; i++) {
        if (bits[i] === 0) currentLevel = -currentLevel;
        for (let s = 0; s < spb; s++) {
            time.push(i + s / spb);
            signal.push(s < half ? currentLevel : -currentLevel);
        }
        currentLevel = -currentLevel;
    }
    return { time, signal };
}

function generateAMI(bits) {
    const time = [], signal = [];
    const spb = 100;
    let lastPolarity = 1;
    for (let i = 0; i < bits.length; i++) {
        let level = 0;
        if (bits[i] === 1) {
            lastPolarity = -lastPolarity;
            level = lastPolarity;
        }
        for (let s = 0; s < spb; s++) {
            time.push(i + s / spb);
            signal.push(level);
        }
    }
    return { time, signal };
}

/**
 * Master line coding function — called by HTML onclick.
 */
function runLineCoding() {
    const bitInput = document.getElementById('bitStream').value;
    const bits = parseBits(bitInput);
    if (bits.length === 0) return;
    pipelineState.bits = bits;

    const lineType = document.getElementById('lineType').value;
    let result;
    switch (lineType) {
        case 'NRZ-L':          result = generateNRZL(bits); break;
        case 'NRZ-I':          result = generateNRZI(bits); break;
        case 'Manchester':     result = generateManchester(bits); break;
        case 'DiffManchester': result = generateDiffManchester(bits); break;
        case 'AMI':            result = generateAMI(bits); break;
        default:               result = generateNRZL(bits); break;
    }
    pipelineState.lineCoded = result;

    // Build input digital signal
    const spb = 100;
    const inputTime = [], inputSignal = [], bitWave = [];
    for (let i = 0; i < bits.length; i++) {
        for (let s = 0; s < spb; s++) {
            inputTime.push(i + s / spb);
            inputSignal.push(bits[i]);
            bitWave.push(bits[i]);
        }
    }

    plotPipelineSegmented('lineInputChart', inputTime, inputSignal, bitWave, 'hv', [-0.2, 1.2]);
    plotPipelineSignal('lineChart', result.time, result.signal, '#ff6b00', 'hv', [-1.5, 1.5]);
}


/* ====================================================================
   STAGE 2: CHANNEL NOISE
   ==================================================================== */

function applyNoise() {
    if (!pipelineState.modulated || pipelineState.modulated.time.length === 0) {
        alert('Please run modulation first (use "Run Static Simulation" or "Run Full Pipeline") before applying noise.');
        return;
    }

    const sigma = parseFloat(document.getElementById('noiseLevel').value) || 0.3;
    const original = pipelineState.modulated.modulated;
    const time = pipelineState.modulated.time;
    const noisy = [];

    for (let i = 0; i < original.length; i++) {
        noisy.push(original[i] + gaussianNoise(sigma));
    }

    pipelineState.noisy = { time, original, noisy };

    plotPipelineSignal('noiseOriginalChart', time, original, '#ff6b00', 'linear');
    plotPipelineSignal('noiseChart', time, noisy, '#dc2626', 'linear');
}


/* ====================================================================
   STAGE 3: ERROR DETECTION & CORRECTION
   ==================================================================== */

function applyParityCheck(bits, type) {
    const onesCount = bits.filter(b => b === 1).length;
    let parityBit;
    if (type === 'parity-even') {
        parityBit = onesCount % 2 === 0 ? 0 : 1;
    } else {
        parityBit = onesCount % 2 === 0 ? 1 : 0;
    }
    return {
        original: bits,
        encoded: [...bits, parityBit],
        parityBit: parityBit,
        type: type === 'parity-even' ? 'Even' : 'Odd'
    };
}

function applyCRC(bits) {
    const generator = [1, 0, 1, 1]; // x^3 + x + 1
    const crcLen = generator.length - 1;
    const augmented = [...bits, ...new Array(crcLen).fill(0)];
    const working = [...augmented];

    for (let i = 0; i <= working.length - generator.length; i++) {
        if (working[i] === 1) {
            for (let j = 0; j < generator.length; j++) {
                working[i + j] ^= generator[j];
            }
        }
    }

    const remainder = working.slice(working.length - crcLen);
    return {
        original: bits,
        encoded: [...bits, ...remainder],
        remainder: remainder,
        generator: '1011 (x³+x+1)',
        crcBits: crcLen
    };
}

function applyHamming(bits) {
    const results = [];
    for (let i = 0; i < bits.length; i += 4) {
        const chunk = bits.slice(i, i + 4);
        while (chunk.length < 4) chunk.push(0);

        const d1 = chunk[0], d2 = chunk[1], d3 = chunk[2], d4 = chunk[3];
        const p1 = d1 ^ d2 ^ d4;
        const p2 = d1 ^ d3 ^ d4;
        const p3 = d2 ^ d3 ^ d4;

        results.push({
            data: [...chunk],
            codeword: [p1, p2, d1, p3, d2, d3, d4]
        });
    }

    const encoded = [];
    results.forEach(r => encoded.push(...r.codeword));
    return { original: bits, encoded, blocks: results };
}

function hammingSyndromeCheck(received) {
    const r = received;
    const s1 = r[0] ^ r[2] ^ r[4] ^ r[6];
    const s2 = r[1] ^ r[2] ^ r[5] ^ r[6];
    const s3 = r[3] ^ r[4] ^ r[5] ^ r[6];
    const syndrome = s3 * 4 + s2 * 2 + s1;

    let corrected = [...received];
    let errorPos = -1;
    if (syndrome !== 0) {
        errorPos = syndrome - 1;
        corrected[errorPos] ^= 1;
    }
    return { syndrome, errorPosition: errorPos, corrected, hasError: syndrome !== 0 };
}

function runErrorDetection() {
    const bitInput = document.getElementById('bitStream').value;
    const bits = parseBits(bitInput);
    if (bits.length === 0) return;

    const errorMethod = document.querySelector('input[name="errorMethod"]:checked').value;
    const errorBitPos = parseInt(document.getElementById('errorBitPos').value);
    const resultBox = document.getElementById('errorResult');
    resultBox.style.display = 'block';

    let html = '';

    if (errorMethod === 'parity-even' || errorMethod === 'parity-odd') {
        const result = applyParityCheck(bits, errorMethod);
        const transmitted = [...result.encoded];
        let errorIntroduced = false;
        if (errorBitPos >= 0 && errorBitPos < transmitted.length) {
            transmitted[errorBitPos] ^= 1;
            errorIntroduced = true;
        }

        const receivedOnesCount = transmitted.filter(b => b === 1).length;
        let errorDetected = false;
        if (errorMethod === 'parity-even') {
            errorDetected = receivedOnesCount % 2 !== 0;
        } else {
            errorDetected = receivedOnesCount % 2 !== 1;
        }

        html += `<p><span class="label">${result.type} Parity Check</span></p>`;
        html += `<p><span class="label">Original Data:</span> <span class="value bit-display">${bits.join('')}</span></p>`;
        html += `<p><span class="label">Parity Bit:</span> <span class="value">${result.parityBit}</span></p>`;
        html += `<p><span class="label">Encoded (data + parity):</span> <span class="value bit-display">${result.encoded.join('')}</span></p>`;

        if (errorIntroduced) {
            let tStr = '';
            for (let i = 0; i < transmitted.length; i++) {
                tStr += i === errorBitPos
                    ? `<span class="bit-highlight-error">${transmitted[i]}</span>`
                    : transmitted[i];
            }
            html += `<p><span class="label">Transmitted (error at pos ${errorBitPos}):</span> <span class="value bit-display">${tStr}</span></p>`;
        } else {
            html += `<p><span class="label">Transmitted:</span> <span class="value bit-display">${transmitted.join('')}</span></p>`;
        }

        html += errorDetected
            ? `<p class="error">⚠ Error Detected! Parity check failed — count of 1s is ${receivedOnesCount} (expected ${errorMethod === 'parity-even' ? 'even' : 'odd'}).</p>`
            : `<p class="success">✓ No error detected. Parity check passed.</p>`;

    } else if (errorMethod === 'crc') {
        const result = applyCRC(bits);
        const transmitted = [...result.encoded];
        let errorIntroduced = false;
        if (errorBitPos >= 0 && errorBitPos < transmitted.length) {
            transmitted[errorBitPos] ^= 1;
            errorIntroduced = true;
        }

        const generator = [1, 0, 1, 1];
        const working = [...transmitted];
        for (let i = 0; i <= working.length - generator.length; i++) {
            if (working[i] === 1) {
                for (let j = 0; j < generator.length; j++) {
                    working[i + j] ^= generator[j];
                }
            }
        }
        const checkRemainder = working.slice(working.length - 3);
        const hasError = checkRemainder.some(b => b !== 0);

        html += `<p><span class="label">CRC Error Detection</span></p>`;
        html += `<p><span class="label">Generator:</span> <span class="value">${result.generator}</span></p>`;
        html += `<p><span class="label">Original Data:</span> <span class="value bit-display">${bits.join('')}</span></p>`;
        html += `<p><span class="label">CRC Remainder:</span> <span class="value bit-display">${result.remainder.join('')}</span></p>`;
        html += `<p><span class="label">Encoded (data + CRC):</span> <span class="value bit-display">${result.encoded.join('')}</span></p>`;

        if (errorIntroduced) {
            let tStr = '';
            for (let i = 0; i < transmitted.length; i++) {
                tStr += i === errorBitPos
                    ? `<span class="bit-highlight-error">${transmitted[i]}</span>`
                    : transmitted[i];
            }
            html += `<p><span class="label">Transmitted (error at pos ${errorBitPos}):</span> <span class="value bit-display">${tStr}</span></p>`;
        }

        html += `<p><span class="label">Receiver Remainder:</span> <span class="value bit-display">${checkRemainder.join('')}</span></p>`;
        html += hasError
            ? `<p class="error">⚠ Error Detected! CRC remainder is non-zero (${checkRemainder.join('')}).</p>`
            : `<p class="success">✓ No error detected. CRC remainder is 000.</p>`;

    } else if (errorMethod === 'hamming') {
        const result = applyHamming(bits);

        html += `<p><span class="label">Hamming (7,4) Code</span></p>`;
        html += `<p><span class="label">Original Data:</span> <span class="value bit-display">${bits.join('')}</span></p>`;
        html += `<p><span class="label">Encoded:</span> <span class="value bit-display">${result.encoded.join('')}</span></p>`;

        html += `<p><span class="label">Block Breakdown:</span></p>`;
        result.blocks.forEach((block, idx) => {
            html += `<p style="margin-left:20px;"><span class="value">Block ${idx + 1}: Data [${block.data.join('')}] → Codeword [${block.codeword.join('')}]</span></p>`;
        });

        if (result.blocks.length > 0) {
            const testBlock = [...result.blocks[0].codeword];
            let errorIntroduced = false;
            const effectiveErrorPos = errorBitPos >= 0 && errorBitPos < 7 ? errorBitPos : -1;

            if (effectiveErrorPos >= 0) {
                testBlock[effectiveErrorPos] ^= 1;
                errorIntroduced = true;
            }

            const syndromeResult = hammingSyndromeCheck(testBlock);

            html += `<hr style="margin: 12px 0; border-color: #e2e8f0;">`;
            html += `<p><span class="label">Error Simulation (Block 1):</span></p>`;

            if (errorIntroduced) {
                let rStr = '';
                for (let i = 0; i < testBlock.length; i++) {
                    rStr += i === effectiveErrorPos
                        ? `<span class="bit-highlight-error">${testBlock[i]}</span>`
                        : testBlock[i];
                }
                html += `<p><span class="label">Received (error at pos ${effectiveErrorPos}):</span> <span class="value bit-display">${rStr}</span></p>`;
            } else {
                html += `<p><span class="label">Received:</span> <span class="value bit-display">${testBlock.join('')}</span></p>`;
            }

            html += `<p><span class="label">Syndrome Value:</span> <span class="value">${syndromeResult.syndrome}</span></p>`;

            if (syndromeResult.hasError) {
                html += `<p class="error">⚠ Error detected at position ${syndromeResult.errorPosition} (0-indexed)!</p>`;
                html += `<p><span class="label">Corrected Codeword:</span> <span class="value bit-display">${syndromeResult.corrected.join('')}</span></p>`;
                html += `<p class="success">✓ Error corrected successfully.</p>`;
            } else {
                html += `<p class="success">✓ No error detected. Syndrome is 0.</p>`;
            }
        }
    }

    resultBox.innerHTML = html;
}


/* ====================================================================
   STAGE 4: MULTIPLEXING (TDM & FDM)
   ==================================================================== */

function performTDM(bits1, bits2) {
    const maxLen = Math.max(bits1.length, bits2.length);
    const interleaved = [];
    for (let i = 0; i < maxLen; i++) {
        if (i < bits1.length) interleaved.push(bits1[i]);
        if (i < bits2.length) interleaved.push(bits2[i]);
    }
    return interleaved;
}

function performFDM(bits1, bits2, freq1, freq2, amplitude) {
    const bitDuration = 1;
    const maxLen = Math.max(bits1.length, bits2.length);
    const totalTime = maxLen * bitDuration;
    const samplesPerSec = 1000;
    const totalSamples = Math.floor(totalTime * samplesPerSec);

    const time = [], signal1 = [], signal2 = [], combined = [];

    for (let i = 0; i < totalSamples; i++) {
        const t = i / samplesPerSec;
        const bitIdx = Math.min(Math.floor(t / bitDuration), maxLen - 1);
        time.push(t);

        const bit1 = bitIdx < bits1.length ? bits1[bitIdx] : 0;
        const s1 = bit1 * amplitude * Math.sin(2 * Math.PI * freq1 * t);
        signal1.push(s1);

        const bit2 = bitIdx < bits2.length ? bits2[bitIdx] : 0;
        const s2 = bit2 * amplitude * Math.sin(2 * Math.PI * freq2 * t);
        signal2.push(s2);

        combined.push(s1 + s2);
    }

    return { time, signal1, signal2, combined };
}

function runMultiplexing() {
    const bits1 = parseBits(document.getElementById('muxSignal1').value);
    const bits2 = parseBits(document.getElementById('muxSignal2').value);
    const muxType = document.getElementById('muxType').value;

    if (bits1.length === 0 || bits2.length === 0) {
        alert('Please enter valid bit streams for both signals.');
        return;
    }

    if (muxType === 'TDM') {
        const interleaved = performTDM(bits1, bits2);
        const spb = 100;

        const buildWave = (bits) => {
            const time = [], sig = [], bw = [];
            for (let i = 0; i < bits.length; i++) {
                for (let s = 0; s < spb; s++) {
                    time.push(i + s / spb);
                    sig.push(bits[i]);
                    bw.push(bits[i]);
                }
            }
            return { time, sig, bw };
        };

        const w1 = buildWave(bits1);
        const w2 = buildWave(bits2);
        const wOut = buildWave(interleaved);

        plotPipelineSegmented('muxChart1', w1.time, w1.sig, w1.bw, 'hv', [-0.2, 1.2]);
        plotPipelineSegmented('muxChart2', w2.time, w2.sig, w2.bw, 'hv', [-0.2, 1.2]);
        plotPipelineSegmented('muxChart', wOut.time, wOut.sig, wOut.bw, 'hv', [-0.2, 1.2]);

        document.getElementById('muxOutputLabel').textContent =
            `TDM Interleaved Output: ${interleaved.join('')}`;

    } else if (muxType === 'FDM') {
        const result = performFDM(bits1, bits2, 3, 8, 1);

        plotPipelineSignal('muxChart1', result.time, result.signal1, '#ff6b00', 'linear');
        plotPipelineSignal('muxChart2', result.time, result.signal2, '#0f172a', 'linear');
        plotPipelineSignal('muxChart', result.time, result.combined, '#7c3aed', 'linear');

        document.getElementById('muxOutputLabel').textContent =
            `FDM Combined Signal (f₁=3Hz + f₂=8Hz)`;
    }
}


/* ====================================================================
   FULL PIPELINE — Run all stages in sequence
   ==================================================================== */

function runFullPipeline() {
    syncMuxSignal();

    // Stage 0: Trigger the static simulation (modulation)
    const simBtn = document.getElementById('simulateBtn');
    if (simBtn) simBtn.click();

    // Stage 1: Line Coding
    runLineCoding();

    // Small delay so modulation state is ready for noise
    setTimeout(() => {
        // Stage 2: Noise
        applyNoise();

        // Stage 3: Error Detection
        runErrorDetection();

        // Stage 4: Multiplexing
        runMultiplexing();

        // Scroll to line coding
        document.getElementById('lineCodingSection').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}


/* ====================================================================
   EXISTING MODULATION UI — DOMContentLoaded block
   ====================================================================
   Preserved from original ModuLab script:
   - Modulation button selection (ASK/FSK/PSK)
   - Static simulation with segmented color charts
   - Live bit-by-bit animation
   - Reset functionality
   ==================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Current State
    let currentModulation = 'ASK';

    // DOM Elements
    const modulationButtons = document.querySelectorAll('.mod-btn');
    const modDescription = document.getElementById('modDescription');
    const bitStreamInput = document.getElementById('bitStream');
    const amplitudeInput = document.getElementById('amplitude');
    const carrierFreqInput = document.getElementById('carrierFreq');
    const bitRateInput = document.getElementById('bitRate');
    const simulateBtn = document.getElementById('simulateBtn');
    const startLiveBtn = document.getElementById('startLiveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const liveStatus = document.getElementById('liveStatus');
    const statusText = document.getElementById('statusText');
    const bitIndicators = document.getElementById('bitIndicators');

    let animationTimeout = null;
    let isAnimating = false;
    
    const descriptions = {
        'ASK': '<strong>ASK Selected:</strong> The amplitude of the carrier changes depending on the bit.',
        'FSK': '<strong>FSK Selected:</strong> The frequency of the carrier changes. High frequency for 1, low frequency for 0.',
        'PSK': '<strong>PSK Selected:</strong> The phase (start point) of the carrier changes based on the bit content.'
    };

    // Handle Modulation Selection
    if (modulationButtons) {
        modulationButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                stopAnimation();
                modulationButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentModulation = btn.getAttribute('data-type');
                if (modDescription) modDescription.innerHTML = descriptions[currentModulation];
            });
        });
    }

    // Initial Simulation
    if (bitStreamInput) {
        simulate();
    }

    if (simulateBtn) {
        simulateBtn.addEventListener('click', () => {
            stopAnimation();
            simulate();
        });
    }

    if (startLiveBtn) startLiveBtn.addEventListener('click', startLiveSimulation);
    if (resetBtn) resetBtn.addEventListener('click', resetSimulation);

    // Setup noise slider
    const noiseSlider = document.getElementById('noiseLevel');
    const noiseDisplay = document.getElementById('noiseLevelValue');
    if (noiseSlider && noiseDisplay) {
        noiseSlider.addEventListener('input', () => {
            noiseDisplay.textContent = noiseSlider.value;
        });
    }

    // Sync mux signal
    syncMuxSignal();
    if (bitStreamInput) {
        bitStreamInput.addEventListener('input', () => {
            syncMuxSignal();
        });
    }

    function stopAnimation() {
        if (animationTimeout) {
            clearTimeout(animationTimeout);
            animationTimeout = null;
        }
        isAnimating = false;
        if (liveStatus) liveStatus.style.display = 'none';
    }

    function resetSimulation() {
        stopAnimation();
        Plotly.purge('bitChart');
        Plotly.purge('carrierChart');
        Plotly.purge('modulatedChart');
        const graphExpl = document.getElementById('graphExplanation');
        if (graphExpl) graphExpl.innerHTML = "";
        if (bitIndicators) bitIndicators.innerHTML = "";
    }

    function createBitIndicators(bits) {
        if (!bitIndicators) return;
        bitIndicators.innerHTML = "";
        bits.forEach((bit, index) => {
            const box = document.createElement('div');
            box.className = `bit-box bit-${bit}`;
            box.innerText = bit;
            box.id = `bit-${index}`;
            bitIndicators.appendChild(box);
        });
    }

    function highlightBit(index) {
        const boxes = document.querySelectorAll('.bit-box');
        boxes.forEach(box => box.classList.remove('active'));
        const activeBox = document.getElementById(`bit-${index}`);
        if (activeBox) activeBox.classList.add('active');
    }

    async function startLiveSimulation() {
        if (isAnimating) return;
        stopAnimation();
        isAnimating = true;
        
        const type = currentModulation;
        const bits = bitStreamInput.value.split('').map(b => parseInt(b) === 1 ? 1 : 0);
        const amplitude = parseFloat(amplitudeInput.value) || 1;
        const carrierFreq = parseFloat(carrierFreqInput.value) || 5;
        const bitDuration = parseFloat(bitRateInput.value) || 1;
        
        if (bits.length === 0) {
            isAnimating = false;
            return;
        }

        createBitIndicators(bits);
        liveStatus.style.display = 'block';

        const samplesPerBit = 200;
        const samplesPerSec = samplesPerBit / bitDuration;
        const dt = 1 / samplesPerSec;
        
        let accumulatedTime = [];
        let accumulatedBitWave = [];
        let accumulatedCarrierWave = [];
        let accumulatedModulatedWave = [];
        let currentBitIndex = 0;
        let runningPhase = 0;

        function simulateNextBit() {
            if (currentBitIndex >= bits.length || !isAnimating) {
                isAnimating = false;
                return;
            }

            const currentBit = bits[currentBitIndex];
            highlightBit(currentBitIndex);
            statusText.innerHTML = `Transmitting bit: <strong style="color: ${currentBit === 1 ? '#ff6b00' : '#0f172a'}">${currentBit}</strong> using ${type} modulation`;

            for (let i = 0; i < samplesPerBit; i++) {
                const globalSampleIndex = currentBitIndex * samplesPerBit + i;
                const t = globalSampleIndex / samplesPerSec;
                
                accumulatedTime.push(t);
                accumulatedBitWave.push(currentBit);
                
                const carrier = amplitude * Math.sin(2 * Math.PI * carrierFreq * t);
                accumulatedCarrierWave.push(carrier);

                let modulated = 0;
                if (type === 'ASK') {
                    modulated = currentBit * carrier;
                } else if (type === 'FSK') {
                    const freq = currentBit === 1 ? carrierFreq * 1.5 : carrierFreq * 0.75;
                    modulated = amplitude * Math.sin(runningPhase);
                    runningPhase += 2 * Math.PI * freq * dt;
                } else if (type === 'PSK') {
                    const phase = currentBit === 1 ? 0 : Math.PI;
                    modulated = amplitude * Math.sin(2 * Math.PI * carrierFreq * t + phase);
                }
                accumulatedModulatedWave.push(modulated);
            }

            plotSegmentedSignal('bitChart', accumulatedTime, accumulatedBitWave, accumulatedBitWave, 'Input Digital Signal', 'hv', false);
            plotSignal('carrierChart', accumulatedTime, accumulatedCarrierWave, 'Carrier Signal', '#ff6b00', 'linear', false);
            plotSegmentedSignal('modulatedChart', accumulatedTime, accumulatedModulatedWave, accumulatedBitWave, `${type} Modulated Signal`, 'linear', false);

            currentBitIndex++;
            animationTimeout = setTimeout(simulateNextBit, 2000);
        }

        simulateNextBit();
    }

    function simulate() {
        const type = currentModulation;
        const bits = bitStreamInput.value.split('').map(b => parseInt(b) === 1 ? 1 : 0);
        const amplitude = parseFloat(amplitudeInput.value) || 1;
        const carrierFreq = parseFloat(carrierFreqInput.value) || 5;
        const bitDuration = parseFloat(bitRateInput.value) || 1;
        
        if (bits.length === 0) return;

        const totalTime = bits.length * bitDuration;
        const samplesPerSec = 2000;
        const dt = 1 / samplesPerSec;
        const totalSamples = Math.floor(totalTime * samplesPerSec);
        
        const time = [];
        const bitWave = [];
        const carrierWave = [];
        const modulatedWave = [];

        let runningPhase = 0;

        for (let i = 0; i < totalSamples; i++) {
            const t = i / samplesPerSec;
            const bitIndex = Math.floor(t / bitDuration);
            const currentBit = bitIndex < bits.length ? bits[bitIndex] : bits[bits.length - 1];
            
            time.push(t);
            bitWave.push(currentBit);
            
            const carrier = amplitude * Math.sin(2 * Math.PI * carrierFreq * t);
            carrierWave.push(carrier);

            let modulated = 0;
            if (type === 'ASK') {
                modulated = currentBit * carrier;
            } else if (type === 'FSK') {
                const freq = currentBit === 1 ? carrierFreq * 1.5 : carrierFreq * 0.75;
                modulated = amplitude * Math.sin(runningPhase);
                runningPhase += 2 * Math.PI * freq * dt;
            } else if (type === 'PSK') {
                const phase = currentBit === 1 ? 0 : Math.PI;
                modulated = amplitude * Math.sin(2 * Math.PI * carrierFreq * t + phase);
            }
            modulatedWave.push(modulated);
        }

        // Store modulation result in pipeline state
        pipelineState.bits = bits;
        pipelineState.modulated = {
            time: time,
            bitWave: bitWave,
            carrier: carrierWave,
            modulated: modulatedWave
        };

        // Plot charts
        plotSegmentedSignal('bitChart', time, bitWave, bitWave, 'Input Digital Signal', 'hv');
        plotSignal('carrierChart', time, carrierWave, 'Carrier Signal', '#ff6b00', 'linear');
        plotSegmentedSignal('modulatedChart', time, modulatedWave, bitWave, `${type} Modulated Signal`, 'linear');

        // Update Graph Explanation
        const graphExpl = document.getElementById('graphExplanation');
        if (graphExpl) {
            graphExpl.style.display = 'block';
            if (type === 'ASK') {
                graphExpl.innerHTML = "<strong>ASK Explanation:</strong> The amplitude of the carrier changes depending on the digital bit. When the bit is 1, the carrier is transmitted. When the bit is 0, nothing (zero amplitude) is transmitted.";
            } else if (type === 'FSK') {
                graphExpl.innerHTML = "<strong>FSK Explanation:</strong> The frequency of the carrier changes according to the digital bit. In this simulation, bit 1 uses a higher frequency f1 (1.5 &times; carrier) and bit 0 uses a lower frequency f2 (0.75 &times; carrier). The phase is maintained continuously.";
            } else if (type === 'PSK') {
                graphExpl.innerHTML = "<strong>PSK Explanation:</strong> The phase (starting point) of the carrier changes according to the digital bit. In this specific configuration, bit 1 has phase 0 and bit 0 has phase shift of &pi; (180°).";
            }
        }
    }

    // ---- ORIGINAL PLOTLY FUNCTIONS (used by modulation charts) ----

    function plotSegmentedSignal(elementId, x, y, bits, title, lineShape, isStatic = true) {
        const x1 = [], y1 = [], x0 = [], y0 = [];

        for (let i = 0; i < x.length; i++) {
            const currentBit = bits[i];
            const px = x[i];
            const py = y[i];
            
            if (i > 0 && currentBit !== bits[i-1]) {
                x1.push(px); y1.push(py);
                x0.push(px); y0.push(py);
                if (currentBit === 1) {
                    x0.push(null); y0.push(null);
                } else {
                    x1.push(null); y1.push(null);
                }
            } else {
                if (currentBit === 1) {
                    x1.push(px); y1.push(py);
                } else {
                    x0.push(px); y0.push(py);
                }
            }
        }

        const trace1 = {
            x: x1, y: y1,
            type: 'scatter', mode: 'lines',
            name: 'Bit 1',
            line: { color: '#ff6b00', width: 2, shape: lineShape },
            showlegend: false
        };

        const trace0 = {
            x: x0, y: y0,
            type: 'scatter', mode: 'lines',
            name: 'Bit 0',
            line: { color: '#0f172a', width: 2, shape: lineShape },
            showlegend: false
        };

        const layout = {
            height: 220,
            margin: elementId === 'bitChart' ? { t: 5, l: 10, r: 10, b: 35 } : { t: 5, l: 40, r: 20, b: 35 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            xaxis: {
                showgrid: true,
                gridcolor: "#f1f5f9",
                zeroline: false,
                tickfont: { size: 10, family: 'Inter' },
                range: isStatic ? null : [0, Math.max(...x) * 1.1]
            },
            yaxis: {
                showgrid: true,
                gridcolor: "#f1f5f9",
                zeroline: true,
                zerolinecolor: '#e2e8f0',
                tickfont: { size: 10, family: 'Inter' },
                range: elementId === 'bitChart' ? [-0.2, 1.2] : null
            },
            autosize: true
        };

        const config = { responsive: true, displayModeBar: false };
        if (isStatic) {
            Plotly.newPlot(elementId, [trace0, trace1], layout, config);
        } else {
            Plotly.react(elementId, [trace0, trace1], layout, config);
        }
    }

    function plotSignal(elementId, x, y, title, color, lineShape, isStatic = true) {
        const trace = {
            x: isStatic ? x : [...x],
            y: isStatic ? y : [...y],
            type: 'scatter',
            mode: 'lines',
            line: {
                color: '#ff6b00',
                width: 2,
                shape: lineShape
            }
        };

        const layout = {
            height: 220,
            margin: { t: 5, l: 40, r: 20, b: 35 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            xaxis: {
                showgrid: true,
                gridcolor: "#f1f5f9",
                zeroline: false,
                tickfont: { size: 10, family: 'Inter' },
                range: isStatic ? null : [0, Math.max(...x) * 1.1]
            },
            yaxis: {
                showgrid: true,
                gridcolor: "#f1f5f9",
                zeroline: true,
                zerolinecolor: '#e2e8f0',
                tickfont: { size: 10, family: 'Inter' }
            },
            autosize: true
        };

        const config = { responsive: true, displayModeBar: false };
        if (isStatic) {
            Plotly.newPlot(elementId, [trace], layout, config);
        } else {
            Plotly.react(elementId, [trace], layout, config);
        }
    }

    // Ensure charts resize correctly
    window.addEventListener('resize', () => {
        const chartIds = [
            'bitChart', 'carrierChart', 'modulatedChart',
            'lineInputChart', 'lineChart',
            'noiseOriginalChart', 'noiseChart',
            'muxChart1', 'muxChart2', 'muxChart'
        ];
        chartIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.data) {
                Plotly.Plots.resize(id);
            }
        });
    });
});
