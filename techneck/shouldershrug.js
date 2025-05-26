// DOM Elements
const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');
const instructionsElement = document.getElementById('instructions');
const startButton = document.getElementById('start-button');
const exerciseButton = document.getElementById('exercise-button');
const exerciseControls = document.getElementById('exercise-controls');
const progressBar = document.getElementById('progress-bar');
const repsElement = document.getElementById('reps');
const holdTimeElement = document.getElementById('hold-time');
const tiltAngleElement = document.getElementById('tilt-angle');

// Configuration
const HOLD_TIME_THRESHOLD = 3;
const SHRUG_THRESHOLD = 0.03;
const MAX_TILT_ANGLE = 15;
const TARGET_REPS = 10;

// State variables
let camera;
let pose;
let exerciseActive = false;
let shrugDetected = false;
let shrugHoldStartTime = 0;
let currentHoldTime = 0;
let repCount = 0;
let shoulderRestPosition = null;
let leftShoulderY, rightShoulderY;
let tiltAngle = 0;
let waitingForReset = false;

// Audio System (keeping your existing AudioFeedback class)
class AudioFeedback {
  constructor() {
    this.audioContext = null;
    this.isEnabled = true;
    this.lastSoundTime = 0;
    this.soundCooldown = 100;
    this.init();
  }

  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Audio not supported:', error);
      this.isEnabled = false;
    }
  }

  async ensureAudioContext() {
    if (!this.isEnabled || !this.audioContext) return false;
    
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
        return false;
      }
    }
    return true;
  }

  canPlaySound() {
    const now = Date.now();
    if (now - this.lastSoundTime < this.soundCooldown) return false;
    this.lastSoundTime = now;
    return true;
  }

  async playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!await this.ensureAudioContext() || !this.canPlaySound()) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Failed to play tone:', error);
    }
  }

  async playClick() {
    await this.playTone(800, 0.05, 'square', 0.2);
  }

  async playStartup() {
    if (!await this.ensureAudioContext()) return;
    
    try {
      const frequencies = [220, 330, 440, 550];
      for (let i = 0; i < frequencies.length; i++) {
        setTimeout(() => this.playTone(frequencies[i], 0.1, 'sine', 0.15), i * 50);
      }
    } catch (error) {
      console.warn('Failed to play startup sound:', error);
    }
  }

  async playSuccess() {
    if (!await this.ensureAudioContext()) return;
    
    try {
      const frequencies = [523, 659, 784];
      for (let i = 0; i < frequencies.length; i++) {
        setTimeout(() => this.playTone(frequencies[i], 0.2, 'sine', 0.2), i * 100);
      }
    } catch (error) {
      console.warn('Failed to play success sound:', error);
    }
  }

  async playError() {
    await this.playTone(150, 0.3, 'sawtooth', 0.15);
  }

  async playProgress() {
    await this.playTone(600, 0.05, 'sine', 0.1);
  }

  async playHold() {
    await this.playTone(400, 0.15, 'sine', 0.12);
  }

  async playPositionLost() {
    if (!await this.ensureAudioContext()) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.2);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Failed to play position lost sound:', error);
    }
  }

  async playCompleted() {
    if (!await this.ensureAudioContext()) return;
    
    try {
      const melody = [523, 659, 784, 1047];
      for (let i = 0; i < melody.length; i++) {
        setTimeout(() => this.playTone(melody[i], 0.3, 'sine', 0.25), i * 150);
      }
      setTimeout(() => {
        this.playTone(523, 0.8, 'sine', 0.15);
        this.playTone(659, 0.8, 'sine', 0.15);
        this.playTone(784, 0.8, 'sine', 0.15);
      }, 600);
    } catch (error) {
      console.warn('Failed to play completion sound:', error);
    }
  }

  async playReset() {
    await this.playTone(300, 0.1, 'sine', 0.15);
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }
}

// Initialize audio system
const audioFeedback = new AudioFeedback();

// DEFINE FUNCTIONS FIRST - BEFORE EVENT LISTENERS

// Scroll to main content function - MOVED UP HERE
function scrollToMainContent() {
  console.log('scrollToMainContent called');
  
  const titleSection = document.querySelector('.title-section');
  const mainContent = document.querySelector('.main-content');
  
  console.log('Title section:', titleSection);
  console.log('Main content:', mainContent);
  
  if (titleSection && mainContent) {
    titleSection.classList.add('hidden');
    mainContent.classList.add('active');
    
    console.log('Classes updated successfully');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    console.error('Could not find title section or main content elements');
  }
}

// Return to title screen function
function returnToTitle() {
  console.log('returnToTitle called');
  
  const titleSection = document.querySelector('.title-section');
  const mainContent = document.querySelector('.main-content');
  
  if (titleSection && mainContent) {
    // Stop any active exercise
    if (exerciseActive) {
      exerciseActive = false;
      shoulderRestPosition = null;
      shrugDetected = false;
      waitingForReset = false;
      repCount = 0;
    }
    
    // Stop camera if running
    if (camera) {
      try {
        camera.stop();
      } catch (error) {
        console.warn('Error stopping camera:', error);
      }
    }
    
    // Reset UI elements
    if (exerciseButton) {
      exerciseButton.textContent = "Start Exercise";
      exerciseButton.classList.add("hidden");
    }
    if (startButton) {
      startButton.style.display = "block";
    }
    if (exerciseControls) {
      exerciseControls.classList.add("hidden");
    }
    if (statusElement) {
      statusElement.textContent = "Loading...";
    }
    if (instructionsElement) {
      instructionsElement.textContent = "Let's guide you through shoulder shrug exercises.";
    }
    
    // Show title, hide main content
    mainContent.classList.remove('active');
    titleSection.classList.remove('hidden');
    
    console.log('Returned to title screen');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    console.error('Could not find title section or main content elements');
  }
}

// Update the instruction text
function updateInstructions(text) {
  instructionsElement.textContent = text;
}

// Initialize the MediaPipe Pose solution
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

  pose.onResults(onPoseResults);
}

// Handle pose detection results
function onPoseResults(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw the camera feed first
  ctx.save();
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  
  // Draw skeleton overlay
  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(ctx, results.poseLandmarks, {color: '#00FF00', lineWidth: 2});
    
    if (exerciseActive) {
      processShoulderShrug(results.poseLandmarks);
      
      // Draw progress circle when shrugging
      if (shrugDetected && currentHoldTime > 0) {
        drawProgressCircle(results.poseLandmarks);
      }
    }
  }
  
  ctx.restore();
}

// Draw progress circle on webcam during shoulder shrug
function drawProgressCircle(landmarks) {
  // Get shoulder positions to center the circle
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  
  // Calculate center point between shoulders
  const centerX = ((leftShoulder.x + rightShoulder.x) / 2) * canvas.width;
  const centerY = ((leftShoulder.y + rightShoulder.y) / 2) * canvas.height - 80; // Slightly above shoulders
  
  const radius = 60;
  const progressPercent = Math.min(currentHoldTime / HOLD_TIME_THRESHOLD, 1);
  const progressAngle = progressPercent * 2 * Math.PI;
  
  // Save current context
  ctx.save();
  
  // Draw background circle (semi-transparent dark)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fill();
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw progress arc
  if (progressAngle > 0) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 5, -Math.PI / 2, -Math.PI / 2 + progressAngle);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Add inner glow effect
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 5, -Math.PI / 2, -Math.PI / 2 + progressAngle);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 12;
    ctx.stroke();
  }
  
  // Draw center text
  ctx.fillStyle = '#00ff00';
  ctx.font = 'bold 16px Courier New';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Display hold time
  const timeText = `${currentHoldTime.toFixed(1)}s`;
  ctx.fillText(timeText, centerX, centerY - 8);
  
  // Display "HOLD" text
  ctx.font = 'bold 12px Courier New';
  ctx.fillText('HOLD', centerX, centerY + 10);
  
  // Add pulsing effect when near completion
  if (progressPercent > 0.8) {
    const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 20 * pulseIntensity;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(0, 255, 0, ${pulseIntensity * 0.5})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  // Restore context
  ctx.restore();
}

// Process shoulder shrug detection logic (keeping your existing function)
function processShoulderShrug(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftEar = landmarks[7];
  const rightEar = landmarks[8];
  
  if (leftShoulder.visibility < 0.7 || rightShoulder.visibility < 0.7) {
    updateInstructions("Please position yourself so your shoulders are visible");
    return;
  }
  
  if (shoulderRestPosition === null) {
    shoulderRestPosition = (leftShoulder.y + rightShoulder.y) / 2;
    updateInstructions("Starting position recorded. Shrug your shoulders up and hold.");
    audioFeedback.playClick();
  }
  
  leftShoulderY = leftShoulder.y;
  rightShoulderY = rightShoulder.y;
  const currentShoulderPosition = (leftShoulderY + rightShoulderY) / 2;
  
  const shoulderLift = shoulderRestPosition - currentShoulderPosition;
  
  const deltaY = leftShoulderY - rightShoulderY;
  const deltaX = leftShoulder.x - rightShoulder.x;
  tiltAngle = Math.abs(Math.atan2(deltaY, deltaX) * (180 / Math.PI));
  tiltAngleElement.textContent = `Angle: ${tiltAngle.toFixed(1)}°`;
  
  if (waitingForReset) {
    if (shoulderLift <= SHRUG_THRESHOLD * 0.5) {
      waitingForReset = false;
      updateInstructions(`Ready for next rep! Shrug your shoulders up. (${repCount}/${TARGET_REPS})`);
      audioFeedback.playReset();
    } else {
      updateInstructions(`Lower your shoulders to rest position before next rep. (${repCount}/${TARGET_REPS})`);
    }
    return;
  }
  
  if (shoulderLift > SHRUG_THRESHOLD && tiltAngle < MAX_TILT_ANGLE) {
    if (!shrugDetected) {
      shrugDetected = true;
      shrugHoldStartTime = Date.now();
      updateInstructions("Good! Hold that position...");
      audioFeedback.playHold();
    } else {
      const prevHoldTime = currentHoldTime;
      currentHoldTime = (Date.now() - shrugHoldStartTime) / 1000;
      holdTimeElement.textContent = `Hold: ${currentHoldTime.toFixed(1)}s`;
      
      const progressPercent = Math.min((currentHoldTime / HOLD_TIME_THRESHOLD) * 100, 100);
      progressBar.style.width = `${progressPercent}%`;
      
      if (Math.floor(currentHoldTime) > Math.floor(prevHoldTime) && currentHoldTime < HOLD_TIME_THRESHOLD) {
        audioFeedback.playProgress();
      }
      
      if (currentHoldTime >= HOLD_TIME_THRESHOLD) {
        repCount++;
        repsElement.textContent = `Reps: ${repCount}`;
        shrugDetected = false;
        waitingForReset = true;
        
        if (repCount >= TARGET_REPS) {
          showCompletionPopup();
          audioFeedback.playCompleted();
          exerciseActive = false;
          exerciseButton.textContent = "Start Exercise";
          updateInstructions("Exercise completed! Great job!");
          waitingForReset = false;
        } else {
          updateInstructions(`Great rep! Now lower your shoulders completely before the next one. (${repCount}/${TARGET_REPS})`);
          audioFeedback.playSuccess();
        }
        
        progressBar.style.width = "0%";
      }
    }
  } else {
    if (shrugDetected) {
      shrugDetected = false;
      updateInstructions("Position lost. Shrug your shoulders up and keep them level.");
      progressBar.style.width = "0%";
      audioFeedback.playPositionLost();
    } else if (!waitingForReset) {
      if (shoulderLift <= SHRUG_THRESHOLD) {
        updateInstructions("Lift your shoulders higher toward your ears.");
      } else if (tiltAngle >= MAX_TILT_ANGLE) {
        updateInstructions("Keep your shoulders level. They're currently tilted.");
      }
    }
  }
}

// Start the webcam
function startCamera() {
  camera = new Camera(video, {
    onFrame: async () => {
      await pose.send({image: video});
    },
    width: 640,
    height: 480
  });
  
  camera.start()
    .then(() => {
      statusElement.textContent = "Camera ready";
      startButton.style.display = "none";
      exerciseButton.classList.remove("hidden");
      audioFeedback.playStartup();
    })
    .catch(error => {
      statusElement.textContent = `Error: ${error.message}`;
      console.error('Error starting camera:', error);
      audioFeedback.playError();
    });
}

// Start the exercise
function startExercise() {
  exerciseActive = true;
  shoulderRestPosition = null;
  shrugDetected = false;
  waitingForReset = false;
  repCount = 0;
  repsElement.textContent = `Reps: 0/${TARGET_REPS}`;
  holdTimeElement.textContent = "Hold: 0s";
  tiltAngleElement.textContent = "Angle: 0°";
  progressBar.style.width = "0%";
  
  updateInstructions("Stand straight and face the camera. I'll detect your starting position.");
  exerciseControls.classList.remove("hidden");
  exerciseButton.textContent = "Reset Exercise";
  audioFeedback.playClick();
}

// Updated completion popup to match neck tilt exercise styling
function showCompletionPopup() {
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
  message.textContent = `Congratulations! You've successfully completed ${TARGET_REPS} shoulder shrugs. Look at you, moving your body and everything. Inspirational!`;
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
      <div style="margin-bottom: 0.5rem;">✓ Completed ${TARGET_REPS} shoulder shrugs</div>
      <div style="margin-bottom: 0.5rem;">✓ Held positions for ${HOLD_TIME_THRESHOLD} seconds each</div>
      <div>✓ Desk slouch resistance: +0.1%</div>
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
    audioFeedback.playClick();
    window.location.href = 'neckstretch.html';
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
    audioFeedback.playClick();
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
}

// Create audio toggle button
function createAudioToggle() {
  const audioToggle = document.createElement('button');
  audioToggle.id = 'audio-toggle';
  audioToggle.textContent = '🔊 Audio: ON';
  audioToggle.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 255, 0, 0.8);
    color: black;
    border: none;
    padding: 10px 15px;
    border-radius: 25px;
    cursor: pointer;
    font-weight: bold;
    z-index: 1000;
    transition: all 0.3s ease;
  `;
  
  audioToggle.addEventListener('click', () => {
    const isEnabled = audioFeedback.toggle();
    audioToggle.textContent = isEnabled ? '🔊 Audio: ON' : '🔇 Audio: OFF';
    audioToggle.style.background = isEnabled ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
    
    if (isEnabled) {
      audioFeedback.playClick();
    }
  });
  
  document.body.appendChild(audioToggle);
}

// EVENT LISTENERS - NOW AT THE BOTTOM
document.addEventListener('DOMContentLoaded', () => {
  // Initialize pose detection
  initPose();
  
  // Create audio toggle
  createAudioToggle();
  
  // Set up button event listeners
  startButton.addEventListener('click', () => {
    audioFeedback.playClick();
    startCamera();
  });
  
  exerciseButton.addEventListener('click', () => {
    audioFeedback.playClick();
    if (exerciseActive) {
      exerciseActive = false;
      shoulderRestPosition = null;
      shrugDetected = false;
      waitingForReset = false;
      repCount = 0;
      exerciseButton.textContent = "Start Exercise";
      exerciseControls.classList.add("hidden");
      updateInstructions("Click 'Start Exercise' when ready.");
    } else {
      startExercise();
    }
  });
  
  // Set up click indicator links 
  document.querySelectorAll('.click-indicator').forEach(indicator => {
    indicator.addEventListener('click', () => {
      audioFeedback.playClick();
      const text = indicator.textContent.trim();
      console.log('Clicked indicator with text:', text);
      
      if (text === "Return") {
        console.log('Return clicked - going back to title');
        returnToTitle();
      } else if (text === "Lets Begin") {
        console.log('Lets Begin clicked - calling scrollToMainContent');
        scrollToMainContent();
      }
    });
  });
  
  // Enable audio context on first user interaction
  document.addEventListener('click', () => {
    audioFeedback.ensureAudioContext();
  }, { once: true });
});