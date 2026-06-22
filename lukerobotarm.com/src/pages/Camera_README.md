# Camera Page - AprilTag Detection

## Overview
The Camera page provides real-time AprilTag detection for your Luke Robot Arm. It uses your phone's camera to detect the Circle21h7 AprilTag (ID: 6) mounted on the front of your robot arm and calculates its 3D position relative to your phone.

## Features
- Real-time camera feed from phone/device
- AprilTag Circle21h7 detection (ID: 6)
- 3D pose estimation (position and rotation)
- Visual overlay showing detected tag with coordinate axes
- Distance measurement in mm/cm
- Relative position calculation (left/right/up/down)
- Camera controls (start/stop/flash)

## Current Implementation
The current code includes:
1. **Mock Detection**: A simplified detection algorithm for demonstration
2. **Camera Management**: Full camera access and control
3. **Visual Overlay**: Drawing detected tags with coordinate axes
4. **Position Calculation**: Converting pixel coordinates to real-world estimates

## Upgrading to Real AprilTag Detection

### Option 1: OpenCV.js (Recommended)
```bash
npm install opencv-ts
```

Replace the mock detection with:
```typescript
import cv from 'opencv-ts';

// Load OpenCV and AprilTag detector
const detector = new cv.aruco.ArucoDetector(...);
```

### Option 2: js-aruco (Alternative)
```bash
npm install js-aruco
```

### Option 3: WebAssembly AprilTag
Use a compiled WebAssembly version of the AprilTag C++ library.

## Hardware Setup
1. Print and mount a Circle21h7 AprilTag with ID 6 on the front of your robot arm
2. Ensure the tag is clearly visible and well-lit
3. The tag should be approximately 50-100mm in size for optimal detection

## Usage
1. Navigate to the Camera page
2. Allow camera access when prompted
3. Point your phone camera at the robot arm
4. The system will automatically detect the AprilTag and show:
   - Real-time position overlay
   - Distance from camera
   - Relative position (direction to move)
   - Rotation angle

## Calibration
For accurate measurements, you may need to:
1. Measure your AprilTag size and update the detection parameters
2. Calibrate your camera's intrinsic parameters
3. Fine-tune the pixel-to-mm conversion ratio

## Integration with Robot Control
The position data can be used to:
- Guide the robot arm to pick up objects relative to the camera view
- Provide visual feedback for manual control
- Create augmented reality overlays for object interaction
- Implement computer vision-guided automation

## Browser Compatibility
- Chrome/Edge: Full support including camera access
- Safari: Camera access supported, some WebGL limitations
- Firefox: Good support with getUserMedia API
- Mobile browsers: Optimized for phone cameras

## Troubleshooting
- **No camera access**: Check browser permissions
- **Poor detection**: Ensure good lighting and tag visibility
- **Inaccurate positioning**: Verify tag size and calibration
- **Flash not working**: Feature limited to certain devices/browsers
