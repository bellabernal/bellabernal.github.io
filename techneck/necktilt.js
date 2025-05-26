// Elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('start-button');
const exerciseButton = document.getElementById('exercise-button');
const exerciseControls = document.getElementById('exercise-controls');
const statusElement = document.getElementById('status');
const instructionsElement = document.getElementById('instructions');
const progressBar = document.getElementById('progress-bar');
const repsElement = document.getElementById('reps');
const holdTimeElement = document.getElementById('hold-time');
const tiltAngleElement = document.getElementById('tilt-angle');

// Exercise parameters
const HOLD_TIME_THRESHOLD = 3; // seconds to hold
const ANGLE_THRESHOLD = 15; // degrees
const TARGET_REPS = 5;
const INITIAL_TILT_THRESHOLD = 90; // degrees - needs more tilt to start exercise

// State variables
let camera = null;
let pose = null;
let exerciseActive = false;
let exerciseInitialized = false;
let reps = 0;
let holdStartTime = 0;
let currentHoldTime = 0;
let currentTiltAngle = 90;
let tiltDirection = 'none'; 
let previousTiltDirection = 'none';
let repCompleted = false;
let initialTiltDirection = 'none';

// Sound effects - Using Web Audio API
let audioContext;
let soundsEnabled = true;

// Initialize audio context
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('Web Audio API not supported');
        soundsEnabled = false;
    }
}

// Sound generation functions
function playTone(frequency, duration, type = 'sine', volume = 0.1) {
    if (!soundsEnabled || !audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playChord(frequencies, duration, volume = 0.08) {
    frequencies.forEach(freq => {
        playTone(freq, duration, 'sine', volume);
    });
}

function playSequence(notes, interval = 0.2) {
    notes.forEach((note, index) => {
        setTimeout(() => {
            if (typeof note === 'number') {
                playTone(note, 0.3, 'sine', 0.1);
            } else if (Array.isArray(note)) {
                playChord(note, 0.3, 0.08);
            } else if (typeof note === 'object') {
                // Enhanced note object with frequency, type, and volume
                playTone(note.freq, 0.3, note.type || 'sine', note.vol || 0.1);
            }
        }, index * interval * 1000);
    });
}

// Sound effects
function playStartSound() {
    // Tech startup sequence
    playSequence([
        { freq: 800, type: 'square', vol: 0.08 },
        { freq: 1200, type: 'sawtooth', vol: 0.06 },
        { freq: 1600, type: 'square', vol: 0.08 }
    ], 0.2);
}

function playStopSound() {
    // Digital shutdown 
    playSequence([
        { freq: 1200, type: 'triangle', vol: 0.08 },
        { freq: 900, type: 'square', vol: 0.06 },
        { freq: 600, type: 'sawtooth', vol: 0.05 },
        { freq: 400, type: 'triangle', vol: 0.04 }
    ], 0.12);
}

function playExerciseStartSound() {
    // Robotic power-up sequence
    playSequence([
        { freq: 400, type: 'square', vol: 0.08 },
        { freq: 600, type: 'sawtooth', vol: 0.07 },
        { freq: 900, type: 'square', vol: 0.08 },
        { freq: 1200, type: 'triangle', vol: 0.09 }
    ], 0.15);
}

function playExerciseStopSound() {
    // Digital wind-down with modulated tones
    playSequence([
        { freq: 1000, type: 'sawtooth', vol: 0.08 },
        { freq: 750, type: 'square', vol: 0.06 },
        { freq: 500, type: 'triangle', vol: 0.05 },
        { freq: 300, type: 'sawtooth', vol: 0.04 }
    ], 0.18);
}

function playInitializedSound() {
    // Digital success - layered electronic tones
    setTimeout(() => playTone(800, 0.4, 'square', 0.08), 0);
    setTimeout(() => playTone(1200, 0.4, 'sawtooth', 0.06), 100);
    setTimeout(() => playTone(1600, 0.6, 'triangle', 0.08), 200);
}

function playRepCompletedSound() {
    // Achievement beep - rapid electronic ascension
    playSequence([
        { freq: 600, type: 'square', vol: 0.08 },
        { freq: 900, type: 'triangle', vol: 0.09 },
        { freq: 1200, type: 'sawtooth', vol: 0.08 },
        { freq: 1600, type: 'square', vol: 0.10 }
    ], 0.1);
}

function playExerciseCompleteSound() {
    // Digital victory - complex electronic fanfare
    playSequence([
        { freq: 800, type: 'square', vol: 0.08 },
        { freq: 1000, type: 'sawtooth', vol: 0.07 },
        { freq: 1200, type: 'triangle', vol: 0.09 },
        { freq: 1500, type: 'square', vol: 0.08 },
        { freq: 1800, type: 'sawtooth', vol: 0.10 }
    ], 0.25);
}

function playTickSound() {
    // Digital tick - sharp electronic pulse
    playTone(1200, 0.04, 'square', 0.04);
}

function playWarningSound() {
    // Tech warning - modulated electronic beep
    playTone(500, 0.15, 'sawtooth', 0.08);
    setTimeout(() => playTone(700, 0.15, 'triangle', 0.06), 200);
}

function playPositionSound() {
    // Soft digital feedback - quick electronic chirp
    playTone(900, 0.08, 'triangle', 0.05);
}

function playAngleReachedSound() {
    // Digital confirmation - synthetic tone
    playTone(1100, 0.25, 'sawtooth', 0.08);
}

// Enhanced feedback sounds
let lastTickTime = 0;
let lastAngleFeedbackTime = 0;

// Initialize MediaPipe Pose
function initPose() {
    pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });
    
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);
}

// Create completion popup
function createCompletionPopup() {
    // Remove existing popup if any
    const existingPopup = document.getElementById('completion-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.id = 'completion-popup';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: 'Courier New', monospace;
        animation: fadeIn 0.5s ease-in;
    `;

    // Create popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: #000000;
        border: 3px solid #00FF00;
        border-radius: 12px;
        padding: 3rem 2rem;
        text-align: center;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
        animation: slideUp 0.6s ease-out;
    `;

    // Success message
    const title = document.createElement('h2');
    title.textContent = 'Exercise Complete!';
    title.style.cssText = `
        color: #00FF00;
        font-size: 2.5rem;
        margin-bottom: 1rem;
        text-shadow: 0 0 10px rgba(0, 255, 0, 0.7);
        animation: glow 2s ease-in-out infinite alternate;
    `;

    // Completion message
    const message = document.createElement('p');
    message.textContent = 'Another hour seated! Your chair appreciates the loyalty!';
    message.style.cssText = `
        color: #66FF66;
        font-size: 1.3rem;
        margin-bottom: 2rem;
        line-height: 1.6;
    `;

    // Stats display
    const stats = document.createElement('div');
    stats.innerHTML = `
        <div style="color: #88FF88; font-size: 1.1rem; margin-bottom: 2rem;">
            <div style="margin-bottom: 0.5rem;">✓ Completed ${TARGET_REPS * 2} neck tilts</div>
            <div style="margin-bottom: 0.5rem;">✓ Held positions for ${HOLD_TIME_THRESHOLD} seconds each</div>
            <div>✓ Chair loyalty maintained: 100%</div>
        </div>
    `;

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
    `;

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Try Another Exercise';
    continueBtn.style.cssText = `
        background: transparent;
        border: 2px solid #00FF00;
        color: #00FF00;
        padding: 1rem 2rem;
        font-family: 'Courier New', monospace;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.3s ease;
        letter-spacing: 0.5px;
    `;

    continueBtn.addEventListener('mouseenter', () => {
        continueBtn.style.background = 'rgba(0, 255, 0, 0.1)';
        continueBtn.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.4)';
        continueBtn.style.transform = 'translateY(-2px)';
    });

    continueBtn.addEventListener('mouseleave', () => {
        continueBtn.style.background = 'transparent';
        continueBtn.style.boxShadow = 'none';
        continueBtn.style.transform = 'translateY(0)';
    });

    continueBtn.addEventListener('click', () => {
        playTone(1200, 0.08, 'square', 0.06);
        // Check if shouldershrugs.html exists, otherwise use shouldershrug.html
        window.location.href = 'shouldershrug.html';
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Done for Now';
    closeBtn.style.cssText = `
        background: transparent;
        border: 2px solid #66FF66;
        color: #66FF66;
        padding: 1rem 2rem;
        font-family: 'Courier New', monospace;
        font-size: 1rem;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.3s ease;
        letter-spacing: 0.5px;
    `;

    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(102, 255, 102, 0.1)';
        closeBtn.style.transform = 'translateY(-2px)';
    });

    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'transparent';
        closeBtn.style.transform = 'translateY(0)';
    });

    closeBtn.addEventListener('click', () => {
        playTone(1000, 0.12, 'sawtooth', 0.08);
        overlay.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => overlay.remove(), 300);
    });

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes slideUp {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes glow {
            from { text-shadow: 0 0 10px rgba(0, 255, 0, 0.7); }
            to { text-shadow: 0 0 20px rgba(0, 255, 0, 1), 0 0 30px rgba(0, 255, 0, 0.5); }
        }
    `;
    document.head.appendChild(style);

    // Assemble popup
    buttonContainer.appendChild(continueBtn);
    buttonContainer.appendChild(closeBtn);
    popup.appendChild(title);
    popup.appendChild(message);
    popup.appendChild(stats);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Play completion sound
    playExerciseCompleteSound();
}

// Navigation functions
function showMainContent() {
    // Hide title section
    const titleSection = document.querySelector('.title-section') || 
                        document.querySelector('.intro-section') ||
                        document.querySelector('#title-section') ||
                        document.querySelector('#intro-section');
    
    if (titleSection) {
        titleSection.style.display = 'none';
        console.log('Title section hidden');
    } else {
        console.warn('Title section not found - check your HTML structure');
    }
    
    // Show main content
    const mainContent = document.querySelector('.main-content') || 
                       document.querySelector('#main-content') ||
                       document.querySelector('.content') ||
                       document.querySelector('#content');
    
    if (mainContent) {
        mainContent.style.display = 'block';
        console.log('Main content shown');
    } else {
        console.warn('Main content not found - check your HTML structure');
    }
    
    // Alternative: try to find and hide/show by common class names
    document.querySelectorAll('.title, .intro, .landing').forEach(el => {
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.exercise, .webcam, .camera').forEach(el => {
        el.style.display = 'block';
    });
    
    playStartSound();
}

function returnToTitle() {
    // Show title section
    const titleSection = document.querySelector('.title-section') || 
                        document.querySelector('.intro-section') ||
                        document.querySelector('#title-section') ||
                        document.querySelector('#intro-section');
    
    if (titleSection) {
        titleSection.style.display = 'block';
        console.log('Title section shown');
    }
    
    // Hide main content
    const mainContent = document.querySelector('.main-content') || 
                       document.querySelector('#main-content') ||
                       document.querySelector('.content') ||
                       document.querySelector('#content');
    
    if (mainContent) {
        mainContent.style.display = 'none';
        console.log('Main content hidden');
    }
    
    // Alternative: try to find and show/hide by common class names
    document.querySelectorAll('.title, .intro, .landing').forEach(el => {
        el.style.display = 'block';
    });
    
    document.querySelectorAll('.exercise, .webcam, .camera').forEach(el => {
        el.style.display = 'none';
    });
    
    // Stop camera and exercise if active
    if (camera) stopCamera();
    
    playStopSound();
}

// Alias for backward compatibility
function scrollToMainContent() {
    showMainContent();
}

// Start the webcam
startButton.onclick = function() {
    if (startButton.textContent === 'Start Camera') {
        startCamera();
        startButton.textContent = 'Stop Camera';
        statusElement.textContent = 'Camera active. Position yourself so your face and shoulders are visible.';
        exerciseButton.classList.remove('hidden');
        playStartSound();
    } else {
        stopCamera();
        startButton.textContent = 'Start Camera';
        statusElement.textContent = 'Camera stopped.';
        exerciseButton.classList.add('hidden');
        exerciseControls.classList.add('hidden');
        playStopSound();
    }
};

// Start the exercise
exerciseButton.onclick = function() {
    if (!exerciseActive) {
        startExercise();
        exerciseButton.textContent = 'Stop Exercise';
        exerciseControls.classList.remove('hidden');
        playExerciseStartSound();
    } else {
        stopExercise();
        exerciseButton.textContent = 'Start Exercise';
        exerciseControls.classList.add('hidden');
        playExerciseStopSound();
    }
};

function startCamera() {
    if (!pose) {
        initPose();
    }
    
    if (!audioContext) {
        initAudio();
    }
    
    if (camera) {
        camera.stop();
    }
    
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await pose.send({image: videoElement});
        },
        width: 640,
        height: 480
    });
    camera.start();
}

function stopCamera() {
    if (camera) {
        camera.stop();
        camera = null;
    }
    
    if (exerciseActive) {
        stopExercise();
    }
    
    // Clear canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
}

function startExercise() {
    exerciseActive = true;
    exerciseInitialized = false;
    initialTiltDirection = 'none';
    reps = 0;
    holdStartTime = 0;
    currentHoldTime = 0;
    tiltDirection = 'none';
    previousTiltDirection = 'none';
    repCompleted = false;
    
    updateStats();
    statusElement.textContent = 'To begin the exercise, tilt your head significantly to either side.';
    instructionsElement.textContent = `Tilt your head to either side at least ${INITIAL_TILT_THRESHOLD}° to start the exercise.`;
}

function stopExercise() {
    exerciseActive = false;
    exerciseInitialized = false;
    statusElement.textContent = 'Exercise stopped.';
    instructionsElement.textContent = 'Time since last stretch: 72 hours - new personal best!';
}

function updateStats() {
    repsElement.textContent = `Reps: ${reps}/${TARGET_REPS*2}`;
    holdTimeElement.textContent = `Hold: ${currentHoldTime.toFixed(1)}s`;
    tiltAngleElement.textContent = `Angle: ${Math.abs(currentTiltAngle).toFixed(1)}°`;
    
    // Update progress bar
    const progress = (reps / (TARGET_REPS * 2)) * 100;
    progressBar.style.width = `${progress}%`;
    
    // Check if exercise is complete
    if (reps >= TARGET_REPS * 2) {
        exerciseActive = false;
        exerciseInitialized = false;
        statusElement.textContent = 'Another hour seated! Your chair appreciates the loyalty!';
        exerciseButton.textContent = 'Start Exercise';
        
        // Show completion popup
        setTimeout(() => {
            createCompletionPopup();
        }, 1000); // Delay for effect
    }
}

function onResults(results) {
    // Draw the pose landmarks on the canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw the webcam feed on the canvas
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height);
        
    // Draw pose landmarks
    if (results.poseLandmarks) {
        // Draw only upper body landmarks with green color
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                      {color: '#00FF00', lineWidth: 2});
        drawLandmarks(canvasCtx, results.poseLandmarks,
                     {color: '#00FF00', lineWidth: 1});
        
        // Process pose for neck tilt exercise
        if (exerciseActive) {
            processPose(results.poseLandmarks);
        }
    }
    
    canvasCtx.restore();
}

function processPose(landmarks) {
    // Get landmarks for neck tilt
    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    
    // Check if all required landmarks are detected
    if (nose && leftEar && rightEar && leftShoulder && rightShoulder &&
        Math.min(nose.visibility, leftEar.visibility, rightEar.visibility, 
                leftShoulder.visibility, rightShoulder.visibility) > 0.7) {
        
        // Calculate shoulder midpoint (reference line)
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
        
        // Calculate neck midpoint
        const neckMidX = (leftEar.x + rightEar.x) / 2;
        const neckMidY = (leftEar.y + rightEar.y) / 2;
        
        // Calculate angle between vertical line from shoulders and the line to the nose
        const dx = nose.x - shoulderMidX;
        const dy = nose.y - shoulderMidY;
        
        // Calculate tilt angle (positive for right tilt, negative for left tilt)
        // Convert to degrees and adjust scale
        currentTiltAngle = Math.atan2(dx, dy) * (180 / Math.PI) * -1;
        
        // Determine tilt direction
        previousTiltDirection = tiltDirection;
        if (currentTiltAngle > ANGLE_THRESHOLD) {
            tiltDirection = 'right';
        } else if (currentTiltAngle < -ANGLE_THRESHOLD) {
            tiltDirection = 'left';
        } else {
            tiltDirection = 'none';
        }

        // Handle initialization phase
        if (!exerciseInitialized) {
            // Check if the initial tilt is strong enough to begin exercise
            if (Math.abs(currentTiltAngle) >= INITIAL_TILT_THRESHOLD) {
                exerciseInitialized = true;
                initialTiltDirection = currentTiltAngle > 0 ? 'right' : 'left';
                statusElement.textContent = `Exercise initialized! Initial tilt to the ${initialTiltDirection} side detected.`;
                instructionsElement.textContent = `Return to center, then start tilting to either side to ${ANGLE_THRESHOLD}° and hold for ${HOLD_TIME_THRESHOLD} seconds.`;
                playInitializedSound();
            } else {
                // Still waiting for initial tilt - provide audio feedback for positioning
                const now = Date.now();
                if (now - lastAngleFeedbackTime > 2000) { // Every 2 seconds
                    if (Math.abs(currentTiltAngle) > 30) {
                        playPositionSound();
                    } else {
                        playWarningSound();
                    }
                    lastAngleFeedbackTime = now;
                }
                
                statusElement.textContent = 'Tilt your head further to begin exercise.';
                instructionsElement.textContent = `Tilt your head to either side at least ${INITIAL_TILT_THRESHOLD}° to start the exercise.`;
                
                // Draw feedback but don't process hold times or reps
                drawFeedback(canvasCtx, nose, shoulderMidX, shoulderMidY, currentTiltAngle, tiltDirection);
                updateStats();
                return;
            }
        }
        
        // Process hold time and reps only if initialized
        if (exerciseInitialized) {
            const now = Date.now();
            
            if (tiltDirection !== 'none') {
                // Play sound when angle threshold is first reached
                if (previousTiltDirection === 'none' && tiltDirection !== 'none') {
                    playAngleReachedSound();
                }
                
                if (holdStartTime === 0 || previousTiltDirection !== tiltDirection) {
                    holdStartTime = now;
                    currentHoldTime = 0;
                    repCompleted = false;
                } else {
                    currentHoldTime = (now - holdStartTime) / 1000; // convert to seconds
                    
                    // Play tick sounds during hold (every 0.5 seconds)
                    if (now - lastTickTime > 500 && currentHoldTime < HOLD_TIME_THRESHOLD) {
                        playTickSound();
                        lastTickTime = now;
                    }
                    
                    // Check if hold time threshold is reached
                    if (currentHoldTime >= HOLD_TIME_THRESHOLD && !repCompleted) {
                        reps++;
                        repCompleted = true;
                        const side = tiltDirection === 'left' ? 'left' : 'right';
                        statusElement.textContent = `Good! ${side} tilt completed. ${reps}/${TARGET_REPS*2} reps done.`;
                        playRepCompletedSound();
                    }
                }
            } else {
                holdStartTime = 0;
                currentHoldTime = 0;
            }
                
            // Update instructions based on state
            if (!repCompleted) {
                if (tiltDirection === 'none') {
                    instructionsElement.textContent = `Tilt your head to either side until you reach ${ANGLE_THRESHOLD}° and hold for ${HOLD_TIME_THRESHOLD} seconds.`;
                } else {
                    const remaining = Math.max(0, HOLD_TIME_THRESHOLD - currentHoldTime).toFixed(1);
                    instructionsElement.textContent = `Good! Hold your ${tiltDirection} tilt for ${remaining} more seconds.`;
                }
            } else {
                instructionsElement.textContent = 'Return to center, then tilt to the other side.';
            }
        }
        
        // Draw visual feedback
        drawFeedback(canvasCtx, nose, shoulderMidX, shoulderMidY, currentTiltAngle, tiltDirection);
        
        // Update stats display
        updateStats();
        
    } else {
        // Not all landmarks detected with confidence
        statusElement.textContent = 'Please position yourself so your face and shoulders are clearly visible.';
        
        // Play positioning warning occasionally
        const now = Date.now();
        if (now - lastAngleFeedbackTime > 3000) {
            playWarningSound();
            lastAngleFeedbackTime = now;
        }
    }
}

function drawFeedback(ctx, nose, shoulderMidX, shoulderMidY, angle, direction) {
    ctx.save();
    
    // Draw vertical reference line
    ctx.beginPath();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.moveTo(shoulderMidX * canvasElement.width, 0);
    ctx.lineTo(shoulderMidX * canvasElement.width, canvasElement.height);
    ctx.stroke();
    
    // Draw current angle line
    ctx.beginPath();
    let color;
    
    if (!exerciseInitialized) {
        // Different color indication for initialization phase
        color = Math.abs(angle) >= INITIAL_TILT_THRESHOLD ? '#00FFFF' : '#FF9900';
    } else {
        color = direction === 'none' ? '#FFFF00' : 
              (Math.abs(angle) > ANGLE_THRESHOLD && currentHoldTime >= HOLD_TIME_THRESHOLD) ? '#00FF00' : '#FF9900';
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.moveTo(shoulderMidX * canvasElement.width, shoulderMidY * canvasElement.height);
    ctx.lineTo(nose.x * canvasElement.width, nose.y * canvasElement.height);
    ctx.stroke();
    
    // Draw angle text
    ctx.font = '24px "Courier New"';
    ctx.fillStyle = '#00FF00';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.abs(angle).toFixed(1)}°`, nose.x * canvasElement.width, (nose.y * canvasElement.height) - 20);
    
    // Draw initialization threshold indicator if not initialized
    if (!exerciseInitialized) {
        // Draw threshold arcs for initial tilt requirement
        ctx.beginPath();
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        
        // Right threshold arc
        const arcRadius = 100;
        ctx.beginPath();
        ctx.arc(shoulderMidX * canvasElement.width, 
               shoulderMidY * canvasElement.height,
               arcRadius, 
               -Math.PI/2, 
               -Math.PI/2 + (INITIAL_TILT_THRESHOLD * Math.PI / 180));
        ctx.stroke();
        
        // Left threshold arc
        ctx.beginPath();
        ctx.arc(shoulderMidX * canvasElement.width, 
               shoulderMidY * canvasElement.height,
               arcRadius, 
               -Math.PI/2, 
               -Math.PI/2 - (INITIAL_TILT_THRESHOLD * Math.PI / 180),
               true);
        ctx.stroke();
        
        // Label the threshold
        ctx.fillStyle = '#00FFFF';
        ctx.fillText(`${INITIAL_TILT_THRESHOLD}°`, 
                    (shoulderMidX * canvasElement.width) + arcRadius * Math.sin(INITIAL_TILT_THRESHOLD * Math.PI / 180), 
                    (shoulderMidY * canvasElement.height) - arcRadius * Math.cos(INITIAL_TILT_THRESHOLD * Math.PI / 180));
        ctx.fillText(`${INITIAL_TILT_THRESHOLD}°`, 
                    (shoulderMidX * canvasElement.width) - arcRadius * Math.sin(INITIAL_TILT_THRESHOLD * Math.PI / 180), 
                    (shoulderMidY * canvasElement.height) - arcRadius * Math.cos(INITIAL_TILT_THRESHOLD * Math.PI / 180));
    }
    
    // If actively holding a pose and exercise is initialized, show a progress circle
    if (direction !== 'none' && exerciseInitialized) {
        const progress = Math.min(currentHoldTime / HOLD_TIME_THRESHOLD, 1);
        const radius = 30;
        
        ctx.beginPath();
        ctx.arc((shoulderMidX + (nose.x - shoulderMidX) * 0.5) * canvasElement.width, 
               (shoulderMidY + (nose.y - shoulderMidY) * 0.5) * canvasElement.height,
               radius, 0, 2 * Math.PI);
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // Draw progress
        if (progress > 0) {
            ctx.beginPath();
            ctx.arc((shoulderMidX + (nose.x - shoulderMidX) * 0.5) * canvasElement.width, 
                   (shoulderMidY + (nose.y - shoulderMidY) * 0.5) * canvasElement.height,
                   radius, -Math.PI / 2, (2 * Math.PI * progress) - Math.PI / 2);
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 5;
            ctx.stroke();
        }
    }
    
    ctx.restore();
}

// Event listeners for navigation
document.addEventListener('DOMContentLoaded', function() {
    // Set up click indicator links 
    document.querySelectorAll('.click-indicator').forEach(indicator => {
        indicator.addEventListener('click', () => {
            playTone(1200, 0.08, 'square', 0.06); // Play click sound
            const text = indicator.textContent.trim();
            console.log('Clicked indicator with text:', text);
            
            if (text === "Return") {
                console.log('Return clicked - navigating to shouldershrug.html');
                window.location.href = 'shouldershrug.html';
            } else if (text === "Lets Begin" || text === "Let's Begin") {
                console.log('Lets Begin clicked - showing main content');
                showMainContent();
            }
        });
    });
    
    // Enable audio context on first user interaction
    document.addEventListener('click', () => {
        initAudio();
    }, { once: true });

    // Count exercise navigation 
    let exerciseCount = 0;
    const countDisplay = document.getElementById('exercise-count');
    const buttons = document.querySelectorAll('.action-button');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            exerciseCount += 1;
            if (countDisplay) {
                countDisplay.textContent = exerciseCount;
            }
            
            // Play button click sound
            playTone(1200, 0.08, 'square', 0.06);
        });
    });

    // Action button with sound
    const actionButton = document.getElementById('action-button');
    const clickSound = document.getElementById('clickSound');

    if (actionButton) {
        actionButton.addEventListener('click', () => {
            if (clickSound) {
                clickSound.currentTime = 0; // Rewind to start
                clickSound.play().catch(e => console.log('Audio play failed:', e));
            }
            // Also play our generated sound as backup
            playTone(1000, 0.12, 'sawtooth', 0.08);
        });
    }

    // Set canvas dimensions
    resizeCanvas();
});

// Set canvas dimensions
function resizeCanvas() {
    if (canvasElement && videoElement) {
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;
    }
}

// Add sound toggle functionality
function toggleSound() {
    soundsEnabled = !soundsEnabled;
    console.log(`Sound effects ${soundsEnabled ? 'enabled' : 'disabled'}`);
}