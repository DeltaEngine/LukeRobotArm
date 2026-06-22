import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

import * as Base64 from "./base64.js";

var detections=[];
var imgSaveRequested=0;
var enhancedProcessingEnabled=true; // Default to enhanced processing
var currentDecimation=1.0; // Current decimation level (1.0 = full res, 2.0 = half res)
var oneShotMode=false; // One-shot high-quality detection mode
var lastDetectionTime=0; // For performance measurement

window.onload = (event) => {
  init();
  loadImg('saved_det');
}

async function init() {  // Wait for video and canvas elements to be available
  while (!window.video || !window.canvas) {
    if (!window.initWaitLogged) {
      console.log("Waiting for video and canvas elements...");
      window.initWaitLogged = true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
    // WebWorkers use `postMessage` and therefore work with Comlink.
  const Apriltag = Comlink.wrap(new Worker("apriltag.js"));
  
  // must call this to init apriltag detector; argument is a callback for when the detector is ready
  window.apriltag = await new Apriltag(Comlink.proxy(() => {    // Configure detector for better performance under challenging conditions
    
    // Decimation options for different quality/performance trade-offs:
    // 1.0 = Full resolution (1280x720 → 1280x720, best quality, slower)
    // 1.5 = 2/3 resolution (1280x720 → 853x480, good balance)
    // 2.0 = Half resolution (1280x720 → 640x360, faster, lower quality)
    let decimation = 1.0; // Start with full resolution (will be updated by UI controls)
    
    // Enable edge refinement for better detection at angles
    window.apriltag._set_detector_options(
      decimation,  // quad_decimate: Full resolution for maximum detail
      0.8,  // quad_sigma: Some blur to reduce noise but preserve edges
      1,    // nthreads: Single thread (no effect in WASM)
      1,    // refine_edges: Enable for better angle detection
      0,    // max_detections: Return all detections
      0,    // return_pose: Disabled for now to reduce JSON size
      0     // return_solutions: Disabled for now
    );
    
    console.log("🔧 AprilTag detector configured for high-resolution detection");
    console.log(`   - Processing resolution: ${decimation}x (${decimation === 1.0 ? 'Full' : decimation === 2.0 ? 'Half' : 'Reduced'} resolution)`);
    console.log("   - Edge refinement enabled for angled detection");
    console.log("   - Enhanced contrast processing enabled in video pipeline");
    
    // set camera info; we must define these according to the device and image resolution for pose computation
    //window.apriltag.set_camera_info(double fx, double fy, double cx, double cy)

    //already done for all: window.apriltag.set_tag_size(5, .04);
    // start processing frames
    console.log("AprilTag detector ready, starting frame processing...");
    window.requestAnimationFrame(process_frame);
  }));
}

async function process_frame() {
  const video = window.video;
  const canvas = window.canvas;
    // Check if video is ready before processing
  if (!video || !video.videoWidth || !video.videoHeight) {
    // Only log waiting message every 50 attempts to reduce spam
    if (!window.waitCounter) window.waitCounter = 0;
    if (window.waitCounter % 50 === 0) {
      console.log("Video not ready yet, waiting...");
    }
    window.waitCounter++;
    setTimeout(process_frame, 100); // try again in 0.1s
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  let ctx = canvas.getContext("2d");

  let imageData;
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  } catch (err) {
    console.log("Failed to get video frame. Video not started? "+err);
    setTimeout(process_frame, 500); // try again in 0.5 s
    return;  }  let imageDataPixels = imageData.data;
  let grayscalePixels = new Uint8Array(ctx.canvas.width * ctx.canvas.height);

  if (enhancedProcessingEnabled) {
    // Enhanced image processing for better AprilTag detection
    let rawGrayscale = new Uint8Array(ctx.canvas.width * ctx.canvas.height);
    
    // Step 1: Convert to grayscale with proper luminance weighting
    for (var i = 0, j = 0; i < imageDataPixels.length; i += 4, j++) {
      // Use proper luminance formula instead of simple average
      let grayscale = Math.round(0.299 * imageDataPixels[i] + 0.587 * imageDataPixels[i + 1] + 0.114 * imageDataPixels[i + 2]);
      rawGrayscale[j] = grayscale;
    }
    
    // Step 2: Apply contrast enhancement using histogram stretching
    let min = 255, max = 0;
    for (let i = 0; i < rawGrayscale.length; i++) {
      if (rawGrayscale[i] < min) min = rawGrayscale[i];
      if (rawGrayscale[i] > max) max = rawGrayscale[i];
    }
    
    // Stretch contrast only if there's meaningful dynamic range
    let range = max - min;
    if (range > 30) { // Only enhance if there's sufficient contrast
      for (let i = 0; i < rawGrayscale.length; i++) {
        // Stretch histogram to full 0-255 range
        let stretched = Math.round(((rawGrayscale[i] - min) * 255) / range);
        // Apply additional contrast boost for better edge detection
        let boosted = Math.round(128 + (stretched - 128) * 1.3); // 30% contrast boost
        grayscalePixels[i] = Math.max(0, Math.min(255, boosted));
      }
    } else {
      // If low contrast, copy original but apply gamma correction
      for (let i = 0; i < rawGrayscale.length; i++) {
        // Apply gamma correction to brighten mid-tones
        let gamma = 0.7; // < 1.0 brightens mid-tones
        let normalized = rawGrayscale[i] / 255;
        let corrected = Math.pow(normalized, gamma) * 255;
        grayscalePixels[i] = Math.round(corrected);
      }
    }
  } else {
    // Basic grayscale conversion (original method)
    for (var i = 0, j = 0; i < imageDataPixels.length; i += 4, j++) {
      let grayscale = Math.round((imageDataPixels[i] + imageDataPixels[i + 1] + imageDataPixels[i + 2]) / 3);
      grayscalePixels[j] = grayscale;
    }
  }
  
  // Update display canvas with processed image
  for (var i = 0, j = 0; i < imageDataPixels.length; i += 4, j++) {
    let processedGray = grayscalePixels[j];
    imageDataPixels[i] = processedGray;     // R
    imageDataPixels[i + 1] = processedGray; // G
    imageDataPixels[i + 2] = processedGray; // B
    // Keep alpha unchanged
  }
  ctx.putImageData(imageData, 0, 0);

  // draw previous detection
  detections.forEach(det => {
    // draw tag borders
    ctx.beginPath();
      ctx.lineWidth = "5";
      ctx.strokeStyle = "blue";
      ctx.moveTo(det.corners[0].x, det.corners[0].y);
      ctx.lineTo(det.corners[1].x, det.corners[1].y);
      ctx.lineTo(det.corners[2].x, det.corners[2].y);
      ctx.lineTo(det.corners[3].x, det.corners[3].y);
      ctx.lineTo(det.corners[0].x, det.corners[0].y);
      ctx.font = "bold 20px Arial";
      var txt = ""+det.id;
      ctx.fillStyle = "blue";
      ctx.textAlign = "center";
      ctx.fillText(txt, det.center.x, det.center.y+5);
    ctx.stroke();
  });  // detect aprilTag in the grayscale image given by grayscalePixels
  if (!window.apriltag) {    // Only log every 100 attempts to reduce spam
    if (!window.apriltagWaitCounter) window.apriltagWaitCounter = 0;
    if (window.apriltagWaitCounter % 100 === 0) {
      console.log("⏳ Waiting for AprilTag detector...");
    }
    window.apriltagWaitCounter++;
    setTimeout(process_frame, 100);
    return;  }
  
  // Performance measurement
  let detectionStart = performance.now();
  let newDetections = await window.apriltag.detect(grayscalePixels, ctx.canvas.width, ctx.canvas.height);
  let detectionTime = performance.now() - detectionStart;
  lastDetectionTime = detectionTime;
  
  // Handle error cases
  if (newDetections && (newDetections.error || newDetections.result)) {
    console.error("AprilTag detection error:", newDetections.error || newDetections.result);
    newDetections = []; // Set to empty array to prevent further errors
  } else if (!Array.isArray(newDetections)) {
    console.error("Unexpected detection result:", newDetections);
    newDetections = [];
  }
  // Use the new detections (replace the old ones each frame - this is actually correct behavior)
  detections = newDetections;
    // Only log detection results when something changes
  if (detections.length > 0) {
    if (!window.lastDetectionState) window.lastDetectionState = "";
    
    // Create a state string to detect changes
    let currentState = `${detections.length}:${detections.map(d => d.id).sort().join(',')}`;
    let stateChanged = currentState !== window.lastDetectionState;
      // Only log when detection state changes (not every frame)
    if (stateChanged) {
      let performanceInfo = oneShotMode ? ` ⚡${detectionTime.toFixed(1)}ms (ONE-SHOT)` : '';
      console.log(`🎯 ${detections.length} tag(s): ${detections.map(d => `ID ${d.id}`).join(', ')}${performanceInfo}`);
      window.lastDetectionState = currentState;
      
      // Log detailed performance for one-shot or significant detections
      if (oneShotMode || detections.length > 1) {
        let resolution = `${ctx.canvas.width}x${ctx.canvas.height}`;
        let decimation = oneShotMode ? '0.8x (oversampled)' : `${currentDecimation}x`;
        console.log(`📊 Performance: ${detectionTime.toFixed(1)}ms @ ${resolution} (decimation: ${decimation})`);
      }
    }
  }

  if (imgSaveRequested && detections.length > 0) {
      let savep = Base64.bytesToBase64(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data);
      var det = JSON.stringify({
        det_data: detections, // Save ALL detections, not just the first one
        img_data: LZString.compressToUTF16(savep),
        img_width:  ctx.canvas.width,
        img_height: ctx.canvas.height
      });

      //console.log("Saving detection data.");
      localStorage.setItem("detectData", det);
      buttonToggle();
      loadImg('saved_det');
  }

  window.requestAnimationFrame(process_frame);
}

async function loadImg(targetHtmlElemId) {
  var detectData = localStorage.getItem('detectData');
  if (detectData) {
     let detectDataObj = JSON.parse(detectData);
     let savedPixels = Base64.base64ToBytes(LZString.decompressFromUTF16(detectDataObj.img_data));
     delete detectDataObj.img_data;

     const canvasSaved = document.getElementById(targetHtmlElemId+"_canvas");
     let ctx = canvasSaved.getContext("2d");
     canvasSaved.width = detectDataObj.img_width;
     canvasSaved.height = detectDataObj.img_height;
     let imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
     imageData.data.set(savedPixels);
     ctx.putImageData(imageData, 0, 0);

     //console.log(detectDataObj.det_data);
     let detDataSaved = document.getElementById(targetHtmlElemId+"_data");
     detDataSaved.value=JSON.stringify(detectDataObj, null, 2);
  } else console.log("detectData not found");
}

var button = document.getElementById('req_save');
button.addEventListener('click', function() {
  buttonToggle();
  //console.log("setImgSaveRequested", imgSaveRequested);
});

// Image Enhancement Toggle Button
var enhancementButton = document.getElementById('toggle_enhancement');
enhancementButton.addEventListener('click', function() {
  enhancementToggle();
});

// Resolution Quality Toggle Button
var resolutionButton = document.getElementById('toggle_resolution');
resolutionButton.addEventListener('click', function() {
  resolutionToggle();
});

// One-Shot Detection Button
var oneShotButton = document.getElementById('one_shot_detect');
oneShotButton.addEventListener('click', function() {
  triggerOneShotDetection();
});

function triggerOneShotDetection() {
  oneShotMode = true;
  oneShotButton.innerHTML = "🔍 Processing... (Max Quality)";
  oneShotButton.className = "processing";
  oneShotButton.disabled = true;
  
  // Temporarily set to maximum quality settings
  let originalDecimation = currentDecimation;
  let originalEnhanced = enhancedProcessingEnabled;
  
  // Force maximum quality for one-shot
  currentDecimation = 0.8; // Even higher resolution than full (slight oversampling)
  enhancedProcessingEnabled = true;
  
  console.log("📸 ONE-SHOT DETECTION: Maximum quality mode activated");
  console.log("   - Decimation: 0.8x (oversampling for maximum detail)");
  console.log("   - Enhanced processing: ENABLED");
  console.log("   - Edge refinement: ENABLED");
  console.log("   - Waiting for next frame...");
  
  // Apply ultra-high-quality settings
  if (window.apriltag && window.apriltag._set_detector_options) {
    window.apriltag._set_detector_options(
      0.8,  // quad_decimate: Oversample for maximum detail
      0.5,  // quad_sigma: Minimal blur for maximum edge preservation
      1,    // nthreads
      1,    // refine_edges: Essential for accuracy
      0,    // max_detections: Return all
      0,    // return_pose: Disabled for now
      0     // return_solutions: Disabled for now
    );
  }
  
  // Reset after one detection
  setTimeout(() => {
    currentDecimation = originalDecimation;
    enhancedProcessingEnabled = originalEnhanced;
    oneShotMode = false;
    
    oneShotButton.innerHTML = "📸 One-Shot Detection (Max Quality)";
    oneShotButton.className = "one-shot";
    oneShotButton.disabled = false;
    
    // Restore original settings
    if (window.apriltag && window.apriltag._set_detector_options) {
      window.apriltag._set_detector_options(
        originalDecimation,
        0.8,
        1, 1, 0, 0, 0
      );
    }
    
    console.log("📱 One-shot detection complete, restored normal settings");
  }, 3000); // Give 3 seconds for detection
}

function resolutionToggle() {
  // Cycle through: Full (1.0) → Balanced (1.5) → Fast (2.0) → Full
  if (currentDecimation === 1.0) {
    currentDecimation = 1.5;
    resolutionButton.innerHTML = "Detection Quality: BALANCED";
    resolutionButton.className = "resolution-balanced";
    console.log("🎯 Switched to balanced resolution (2/3 detail, faster processing)");
  } else if (currentDecimation === 1.5) {
    currentDecimation = 2.0;
    resolutionButton.innerHTML = "Detection Quality: FAST";
    resolutionButton.className = "resolution-fast";
    console.log("⚡ Switched to fast mode (1/2 resolution, fastest processing)");
  } else {
    currentDecimation = 1.0;
    resolutionButton.innerHTML = "Detection Quality: FULL RES";
    resolutionButton.className = "resolution-full";
    console.log("🔍 Switched to full resolution (best quality, slower processing)");
  }
  
  // Apply the new settings immediately
  if (window.apriltag && window.apriltag._set_detector_options) {
    window.apriltag._set_detector_options(
      currentDecimation,  // quad_decimate
      0.8,               // quad_sigma
      1,                 // nthreads
      1,                 // refine_edges
      0,                 // max_detections
      0,                 // return_pose
      0                  // return_solutions
    );
    
    let resolutionDesc = currentDecimation === 1.0 ? 'Full' : 
                        currentDecimation === 1.5 ? 'Balanced (2/3)' : 'Fast (1/2)';
    console.log(`📐 Resolution updated: ${resolutionDesc} - Decimation factor: ${currentDecimation}x`);
  }
}

function enhancementToggle() {
  enhancedProcessingEnabled = !enhancedProcessingEnabled;
  
  if (enhancedProcessingEnabled) {
    enhancementButton.innerHTML = "Enhanced Image Processing: ON";
    enhancementButton.className = "enhancement-enabled";
    console.log("🔧 Enhanced image processing enabled");
  } else {
    enhancementButton.innerHTML = "Enhanced Image Processing: OFF";
    enhancementButton.className = "enhancement-disabled";
    console.log("📸 Using basic image processing");
  }
}

function buttonToggle() {
  if (imgSaveRequested == 0) {
    button.innerHTML = "Saving next detection... (press to cancel)";
    imgSaveRequested = 1;
    button.className += " active";
  } else {
    button.innerHTML = "Save next detection (local storage)";
    imgSaveRequested = 0;
    button.className.replace(" active", "");
  }
}
