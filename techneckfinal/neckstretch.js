// Neck Stretch Exercise Tracker JavaScript
class NeckStretchTracker {
    constructor() {
        this.pose = null;
        this.camera = null;
        this.videoElement = document.getElementById('videoElement');
        this.canvasElement = document.getElementById('canvasElement');
        this.canvasCtx = this.canvasElement.getContext('2d');
        
        // Exercise state
        this.isExercising = false;
        this.currentDirection = null;
        this.repsCompleted = 0;
        this.leftReps = 0;
        this.rightReps = 0;
        this.targetRepsPerSide = 5;
        this.currentHoldTime = 0;
        this.holdStartTime = null;
        this.isHolding = false;
        this.lastPoseTime = 0;
        this.exerciseComplete = false;
        
        // Thresholds and parameters for seated desk exercise
        this.TILT_THRESHOLD = 12; // Reduced for seated position
        this.ARM_THRESHOLD = 70; // More lenient for desk constraints
        this.HOLD_DURATION = 3000; // 3 seconds in milliseconds
        this.MIN_CONFIDENCE = 0.5;
        this.SEATED_POSTURE_THRESHOLD = 0.15; // For detecting seated position
        
        // UI elements
        this.statusElement = document.getElementById('exerciseStatus');
        this.progressElement = document.getElementById('progressFill');
        this.repsElement = document.getElementById('repsCount');
        this.holdTimeElement = document.getElementById('holdTime');
        this.headTiltElement = document.getElementById('headTilt');
        this.armPositionElement = document.getElementById('armPosition');
        this.feedbackElement = document.getElementById('feedback');
        this.celebrationOverlay = document.getElementById('celebrationOverlay');
        this.leftBtn = document.getElementById('leftStretchBtn');
        this.rightBtn = document.getElementById('rightStretchBtn');
        
        this.initializePose();
        this.setupEventListeners();
    }
    
    initializePose() {
        this.pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        
        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.pose.onResults(this.onResults.bind(this));
    }
    
    setupEventListeners() {
        // Celebration overlay click
        if (this.celebrationOverlay) {
            this.celebrationOverlay.addEventListener('click', () => {
                this.celebrationOverlay.style.display = 'none';
            });
        }
        
        // Resize canvas when window resizes
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }
    
    async startCamera() {
        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.pose.send({image: this.videoElement});
            },
            width: 640,
            height: 480
        });
        
        await this.camera.start();
        this.resizeCanvas();
        this.updateStatus('CAMERA READY - Select stretch direction');
    }
    
    resizeCanvas() {
        const video = this.videoElement;
        if (this.canvasElement && video) {
            this.canvasElement.width = video.videoWidth || 640;
            this.canvasElement.height = video.videoHeight || 480;
        }
    }
    
    onResults(results) {
        if (!this.canvasCtx) return;
        
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Draw the camera feed
        this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.poseLandmarks && this.isExercising) {
            this.drawPose(results.poseLandmarks);
            this.analyzePose(results.poseLandmarks);
        } else if (results.poseLandmarks) {
            this.drawPose(results.poseLandmarks);
        }
        
        this.canvasCtx.restore();
    }
    
    drawPose(landmarks) {
        // Draw pose connections in green
        drawConnectors(this.canvasCtx, landmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        
        // Draw pose landmarks in green
        drawLandmarks(this.canvasCtx, landmarks, {color: '#00FF00', lineWidth: 1, radius: 3});
        
        const keyPoints = [
            landmarks[POSE_LANDMARKS.NOSE],
            landmarks[POSE_LANDMARKS.LEFT_EAR],
            landmarks[POSE_LANDMARKS.RIGHT_EAR],
            landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
            landmarks[POSE_LANDMARKS.RIGHT_SHOULDER],
            landmarks[POSE_LANDMARKS.LEFT_ELBOW],
            landmarks[POSE_LANDMARKS.RIGHT_ELBOW]
        ];
        
        keyPoints.forEach(point => {
            if (point && point.visibility > this.MIN_CONFIDENCE) {
                this.drawCircle(point.x * this.canvasElement.width, 
                               point.y * this.canvasElement.height, 6, '#00FF00');
            }
        });
    }
    
    drawCircle(x, y, radius, color) {
        this.canvasCtx.beginPath();
        this.canvasCtx.arc(x, y, radius, 0, 2 * Math.PI);
        this.canvasCtx.fillStyle = color;
        this.canvasCtx.fill();
    }
    
    analyzePose(landmarks) {
        const nose = landmarks[POSE_LANDMARKS.NOSE];
        const leftEar = landmarks[POSE_LANDMARKS.LEFT_EAR];
        const rightEar = landmarks[POSE_LANDMARKS.RIGHT_EAR];
        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
        const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
        
        if (!this.hasRequiredLandmarks(landmarks)) {
            this.updateFeedback('Position yourself in frame - upper body visible');
            return;
        }
        
        // Check if user appears to be seated
        if (!this.checkSeatedPosture(landmarks)) {
            this.updateFeedback('Please sit upright at your desk for this exercise');
            return;
        }
        
        // Calculate head tilt
        const headTilt = this.calculateHeadTilt(nose, leftEar, rightEar, leftShoulder, rightShoulder);
        if (this.headTiltElement) {
            this.headTiltElement.textContent = `${Math.abs(headTilt).toFixed(1)}°`;
        }
        
        // Calculate arm position score for seated desk stretch
        const armScore = this.calculateSeatedArmPosition(leftShoulder, rightShoulder, leftElbow, rightElbow);
        if (this.armPositionElement) {
            this.armPositionElement.textContent = `${armScore.toFixed(0)}%`;
        }
        
        // Check exercise form
        this.checkExerciseForm(headTilt, armScore);
    }
    
    hasRequiredLandmarks(landmarks) {
        const required = [
            POSE_LANDMARKS.NOSE,
            POSE_LANDMARKS.LEFT_EAR,
            POSE_LANDMARKS.RIGHT_EAR,
            POSE_LANDMARKS.LEFT_SHOULDER,
            POSE_LANDMARKS.RIGHT_SHOULDER,
            POSE_LANDMARKS.LEFT_ELBOW,
            POSE_LANDMARKS.RIGHT_ELBOW
        ];
        
        return required.every(idx => 
            landmarks[idx] && landmarks[idx].visibility > this.MIN_CONFIDENCE
        );
    }
    
    checkSeatedPosture(landmarks) {
        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
        const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
        
        // If hips are not visible or are very low in frame, assume seated
        if (!leftHip || !rightHip || 
            leftHip.visibility < this.MIN_CONFIDENCE || 
            rightHip.visibility < this.MIN_CONFIDENCE ||
            leftHip.y > 0.85 || rightHip.y > 0.85) {
            return true;
        }
        
        // Check if torso is upright (shoulders above hips)
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const avgHipY = (leftHip.y + rightHip.y) / 2;
        
        return avgShoulderY < avgHipY - this.SEATED_POSTURE_THRESHOLD;
    }
    
    calculateHeadTilt(nose, leftEar, rightEar, leftShoulder, rightShoulder) {
        // Calculate the angle between ear line and shoulder line
        const earAngle = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x);
        const shoulderAngle = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x);
        
        // Convert to degrees
        let tiltAngle = (earAngle - shoulderAngle) * (180 / Math.PI);
        
        // Normalize to -180 to 180
        while (tiltAngle > 180) tiltAngle -= 360;
        while (tiltAngle < -180) tiltAngle += 360;
        
        return tiltAngle;
    }
    
    calculateSeatedArmPosition(leftShoulder, rightShoulder, leftElbow, rightElbow) {
        let score = 0;
        let maxScore = 100;
        
        if (this.currentDirection === 'left') {
            // For left neck stretch, right arm assists by placing hand on head
            const shoulderToElbow = {
                x: rightElbow.x - rightShoulder.x,
                y: rightElbow.y - rightShoulder.y
            };
            
            // Check if elbow is raised (arm lifted)
            if (shoulderToElbow.y < -0.05) score += 50; // Elbow above shoulder level
            if (shoulderToElbow.x < -0.02) score += 25; // Elbow positioned to assist tilt
            
            // Check arm positioning for desk-friendly stretch
            const elbowHeight = Math.abs(shoulderToElbow.y);
            if (elbowHeight > 0.08) score += 25; // Good arm elevation
            
        } else if (this.currentDirection === 'right') {
            // For right neck stretch, left arm assists by placing hand on head
            const shoulderToElbow = {
                x: leftElbow.x - leftShoulder.x,
                y: leftElbow.y - leftShoulder.y
            };
            
            // Check if elbow is raised (arm lifted)
            if (shoulderToElbow.y < -0.05) score += 50; // Elbow above shoulder level
            if (shoulderToElbow.x > 0.02) score += 25; // Elbow positioned to assist tilt
            
            // Check arm positioning for desk-friendly stretch
            const elbowHeight = Math.abs(shoulderToElbow.y);
            if (elbowHeight > 0.08) score += 25; // Good arm elevation
        }
        
        return Math.min(score, maxScore);
    }
    
    checkExerciseForm(headTilt, armScore) {
        const correctTilt = this.isCorrectTilt(headTilt);
        const correctArm = armScore >= this.ARM_THRESHOLD;
        
        if (correctTilt && correctArm) {
            if (!this.isHolding) {
                this.startHold();
            } else {
                this.updateHoldTime();
            }
        } else {
            if (this.isHolding) {
                this.stopHold();
            }
            this.provideFeedback(correctTilt, correctArm, headTilt, armScore);
        }
    }
    
    isCorrectTilt(headTilt) {
        if (this.currentDirection === 'left') {
            return headTilt < -this.TILT_THRESHOLD;
        } else if (this.currentDirection === 'right') {
            return headTilt > this.TILT_THRESHOLD;
        }
        return false;
    }
    
    startHold() {
        this.isHolding = true;
        this.holdStartTime = Date.now();
        this.updateStatus('HOLDING STRETCH');
        this.updateFeedback('Great! Hold this position...');
        
        // Play click sound when hold starts
        playTone(1200, 0.08, 'square', 0.06);
    }
    
    updateHoldTime() {
        const elapsed = Date.now() - this.holdStartTime;
        this.currentHoldTime = elapsed / 1000;
        if (this.holdTimeElement) {
            this.holdTimeElement.textContent = `${this.currentHoldTime.toFixed(1)}s`;
        }
        
        // Update progress bar
        const progress = Math.min((elapsed / this.HOLD_DURATION) * 100, 100);
        if (this.progressElement) {
            this.progressElement.style.width = `${progress}%`;
        }
        
        if (elapsed >= this.HOLD_DURATION) {
            this.completeRep();
        }
    }
    
    stopHold() {
        this.isHolding = false;
        this.holdStartTime = null;
        if (this.progressElement) {
            this.progressElement.style.width = '0%';
        }
        this.updateStatus('ADJUST POSITION');
    }
    
    completeRep() {
        // Increment reps for current direction
        if (this.currentDirection === 'left') {
            this.leftReps++;
        } else if (this.currentDirection === 'right') {
            this.rightReps++;
        }
        
        this.repsCompleted++;
        this.updateRepsDisplay();
        
        this.showCelebration();
        
        // Check if current direction is complete
        const currentDirectionReps = this.currentDirection === 'left' ? this.leftReps : this.rightReps;
        
        if (currentDirectionReps >= this.targetRepsPerSide) {
            // Check if both sides are complete
            if (this.leftReps >= this.targetRepsPerSide && this.rightReps >= this.targetRepsPerSide) {
                this.completeExercise();
            } else {
                this.promptSideSwitch();
            }
        }
        
        // Reset for next rep
        this.isHolding = false;
        this.holdStartTime = null;
        this.currentHoldTime = 0;
        if (this.holdTimeElement) {
            this.holdTimeElement.textContent = '0s';
        }
        if (this.progressElement) {
            this.progressElement.style.width = '0%';
        }
        
        if (!this.exerciseComplete) {
            this.updateStatus('REP COMPLETED - Ready for next');
        }
    }
    
    updateRepsDisplay() {
        if (this.repsElement) {
            this.repsElement.textContent = `L:${this.leftReps}/5 R:${this.rightReps}/5`;
        }
    }
    
    promptSideSwitch() {
        const completedSide = this.currentDirection;
        const nextSide = completedSide === 'left' ? 'right' : 'left';
        
        setTimeout(() => {
            this.updateStatus(`${completedSide.toUpperCase()} SIDE COMPLETE!`);
            this.updateFeedback(`Great! Now switch to ${nextSide} side stretches. Click the ${nextSide.toUpperCase()} button.`);
            
            // Highlight the next button
            if (this.leftBtn && this.rightBtn) {
                if (nextSide === 'left') {
                    this.leftBtn.style.animation = 'pulse 1.5s infinite';
                    this.rightBtn.style.animation = 'none';
                } else {
                    this.rightBtn.style.animation = 'pulse 1.5s infinite';
                    this.leftBtn.style.animation = 'none';
                }
            }
        }, 2000);
    }
    
    completeExercise() {
        this.exerciseComplete = true;
        this.updateStatus('🎉 EXERCISE COMPLETE! 🎉');
        this.updateFeedback('Excellent work! You completed 5 reps on each side. Great job!');
        
        setTimeout(() => {
            this.showFinalCelebration();
        }, 1000);
    }
    
    showFinalCelebration() {
        // Create completion popup matching other exercises
        createCompletionPopup();
    }
    
    showCelebration() {
        const messages = [
            'Excellent form!',
            'Perfect stretch!',
            'Great job!',
            'Well done!',
            'Outstanding!'
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        const celebrationMsg = document.getElementById('celebrationMessage');
        if (celebrationMsg) {
            celebrationMsg.textContent = message;
        }
        
        const currentDirectionReps = this.currentDirection === 'left' ? this.leftReps : this.rightReps;
        const celebrationStats = document.getElementById('celebrationStats');
        if (celebrationStats) {
            celebrationStats.textContent = 
                `${this.currentDirection.toUpperCase()} rep ${currentDirectionReps}/5 completed in ${this.currentHoldTime.toFixed(1)}s`;
        }
        
        if (this.celebrationOverlay) {
            this.celebrationOverlay.style.display = 'flex';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                this.celebrationOverlay.style.display = 'none';
            }, 3000);
        }
    }
    
    provideFeedback(correctTilt, correctArm, headTilt, armScore) {
        let feedback = '';
        
        if (!correctTilt && !correctArm) {
            feedback = `Tilt head more ${this.currentDirection} and lift your ${this.currentDirection === 'left' ? 'right' : 'left'} elbow higher`;
        } else if (!correctTilt) {
            feedback = `Gently tilt your head more to the ${this.currentDirection}`;
        } else if (!correctArm) {
            feedback = `Raise your ${this.currentDirection === 'left' ? 'right' : 'left'} elbow and place hand near your head`;
        }
        
        this.updateFeedback(feedback);
    }
    
    updateStatus(status) {
        if (this.statusElement) {
            this.statusElement.textContent = status;
        }
    }
    
    updateFeedback(feedback) {
        if (this.feedbackElement) {
            this.feedbackElement.textContent = feedback;
        }
    }
  }
  
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
  
  // Create completion popup matching other exercises
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
      message.textContent = 'Congratulations! You completed 10 neck stretches (5 left + 5 right). Your neck tension has decreased by approximately 0.2%!';
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
              <div style="margin-bottom: 0.5rem;">✓ Completed 10 neck stretches</div>
              <div style="margin-bottom: 0.5rem;">✓ 5 reps each direction</div>
              <div>✓ Chair slouch level: Still maximum</div>
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
          window.location.href = 'bodyposture.html';
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
      
      playTone(800, 0.15, 'square', 0.08);
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
      if (tracker && tracker.camera) {
          try {
              tracker.camera.stop();
          } catch (error) {
              console.warn('Error stopping camera:', error);
          }
      }
      
      playTone(600, 0.15, 'sawtooth', 0.08);
  }
  
  // Alias for backward compatibility
  function scrollToMainContent() {
      showMainContent();
  }
  
  // Global variables
  let tracker = null;
  
  // Global functions for HTML buttons
  function setStretchDirection(direction) {
    if (!tracker) return;
    
    // Clear any button animations
    if (tracker.leftBtn) tracker.leftBtn.style.animation = 'none';
    if (tracker.rightBtn) tracker.rightBtn.style.animation = 'none';
    
    tracker.currentDirection = direction;
    
    // Update button states
    if (tracker.leftBtn) tracker.leftBtn.classList.toggle('active', direction === 'left');
    if (tracker.rightBtn) tracker.rightBtn.classList.toggle('active', direction === 'right');
    
    const currentDirectionReps = direction === 'left' ? tracker.leftReps : tracker.rightReps;
    const remaining = tracker.targetRepsPerSide - currentDirectionReps;
    
    if (remaining > 0) {
        tracker.updateStatus(`${direction.toUpperCase()} STRETCH SELECTED`);
        tracker.updateFeedback(`${remaining} reps remaining on ${direction} side. Position yourself and continue.`);
    } else {
        tracker.updateStatus(`${direction.toUpperCase()} SIDE COMPLETE`);
        tracker.updateFeedback(`${direction.toUpperCase()} side already complete! Try the other side.`);
    }
    
    playTone(1200, 0.08, 'square', 0.06);
  }
  
  async function startExercise() {
    if (!tracker) {
        tracker = new NeckStretchTracker();
        await tracker.startCamera();
    }
    
    if (!tracker.currentDirection) {
        tracker.updateFeedback('Please select a stretch direction first');
        return;
    }
    
    tracker.isExercising = true;
    tracker.updateStatus('EXERCISE STARTED');
    tracker.updateFeedback('Position yourself seated at your desk for the stretch');
    
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.textContent = 'STOP EXERCISE';
        startButton.onclick = stopExercise;
    }
    
    playTone(800, 0.15, 'square', 0.08);
  }
  
  function stopExercise() {
    if (!tracker) return;
    
    tracker.isExercising = false;
    tracker.isHolding = false;
    tracker.holdStartTime = null;
    if (tracker.progressElement) {
        tracker.progressElement.style.width = '0%';
    }
    
    tracker.updateStatus('EXERCISE STOPPED');
    tracker.updateFeedback('Click START to begin exercising');
    
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.textContent = 'START EXERCISE';
        startButton.onclick = startExercise;
    }
    
    playTone(600, 0.15, 'sawtooth', 0.08);
  }
  
  function returnToHome() {
      // Stop camera and exercise if active
      if (tracker && tracker.camera) {
          try {
              tracker.camera.stop();
          } catch (error) {
              console.warn('Error stopping camera:', error);
          }
      }
      
      // Stop exercise
      if (tracker) {
          tracker.isExercising = false;
          tracker.isHolding = false;
      }
      
      playTone(800, 0.15, 'square', 0.08);
      window.location.href = 'index.html';
  }
  
  function resetExercise() {
    if (tracker) {
        tracker.isExercising = false;
        tracker.isHolding = false;
        tracker.holdStartTime = null;
        tracker.repsCompleted = 0;
        tracker.leftReps = 0;
        tracker.rightReps = 0;
        tracker.currentHoldTime = 0;
        tracker.currentDirection = null;
        tracker.exerciseComplete = false;
        
        // Reset UI
        if (tracker.repsElement) tracker.repsElement.textContent = 'L:0/5 R:0/5';
        if (tracker.holdTimeElement) tracker.holdTimeElement.textContent = '0s';
        if (tracker.headTiltElement) tracker.headTiltElement.textContent = '--°';
        if (tracker.armPositionElement) tracker.armPositionElement.textContent = '--%';
        if (tracker.progressElement) tracker.progressElement.style.width = '0%';
        if (tracker.celebrationOverlay) tracker.celebrationOverlay.style.display = 'none';
        
        // Reset buttons
        if (tracker.leftBtn) {
            tracker.leftBtn.classList.remove('active');
            tracker.leftBtn.style.animation = 'none';
        }
        if (tracker.rightBtn) {
            tracker.rightBtn.classList.remove('active');
            tracker.rightBtn.style.animation = 'none';
        }
        
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.textContent = 'START EXERCISE';
            startButton.onclick = startExercise;
        }
        
        tracker.updateStatus('RESET COMPLETE');
        tracker.updateFeedback('Select a stretch direction and sit upright at your desk');
    }
    
    playTone(1000, 0.12, 'triangle', 0.08);
  }
  
  // EVENT LISTENERS AND INITIALIZATION
  document.addEventListener('DOMContentLoaded', () => {
      // Initialize audio
      initAudio();
      
      // Set up click indicator links 
      document.querySelectorAll('.click-indicator').forEach(indicator => {
          indicator.addEventListener('click', () => {
              playTone(1200, 0.08, 'square', 0.06); // Play click sound
              const text = indicator.textContent.trim();
              console.log('Clicked indicator with text:', text);
              
              if (text === "Return") {
                  console.log('Return clicked - going back to title');
                  returnToTitle();
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
  
      // Add some initial styling feedback
      const exerciseStatus = document.getElementById('exerciseStatus');
      const feedback = document.getElementById('feedback');
      
      if (exerciseStatus) {
          exerciseStatus.textContent = 'LOADING...';
      }
      if (feedback) {
          feedback.textContent = 'Initializing camera and pose detection...';
      }
  });