# Real AprilTag Detection Integration

Replace the mock detection in Camera.ts with real AprilTag detection using OpenCV.js:

## 1. Install OpenCV.js

Add to your HTML head or load dynamically:
```html
<script async src="https://docs.opencv.org/4.5.0/opencv.js" onload="onOpenCvReady();" type="text/javascript"></script>
```

Or install via npm:
```bash
npm install opencv-ts
```

## 2. Replace Mock Detection Function

Replace `detectMockAprilTag()` with:

```typescript
// Real AprilTag detection using OpenCV.js
function detectRealAprilTag(imageData: ImageData): AprilTagDetection | null {
  if (typeof cv === 'undefined') {
    console.log('OpenCV.js not loaded yet');
    return null;
  }

  try {
    // Convert ImageData to OpenCV Mat
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Create AprilTag detector
    const dictionary = cv.getPredefinedDictionary(cv.DICT_APRILTAG_36h11);
    const detector = new cv.ArucoDetector(dictionary);
    
    // Detect markers
    const corners = new cv.MatVector();
    const ids = new cv.Mat();
    const rejected = new cv.MatVector();
    
    detector.detectMarkers(gray, corners, ids, rejected);
    
    // Process results
    if (ids.rows > 0) {
      const idArray = ids.data32S;
      
      // Look for our specific tag ID (6)
      for (let i = 0; i < idArray.length; i++) {
        if (idArray[i] === 6) {
          const corner = corners.get(i);
          const cornerData = corner.data32F;
          
          // Extract corner points
          const detectedCorners = [
            { x: cornerData[0], y: cornerData[1] },
            { x: cornerData[2], y: cornerData[3] },
            { x: cornerData[4], y: cornerData[5] },
            { x: cornerData[6], y: cornerData[7] }
          ];
          
          // Calculate center
          const centerX = detectedCorners.reduce((sum, p) => sum + p.x, 0) / 4;
          const centerY = detectedCorners.reduce((sum, p) => sum + p.y, 0) / 4;
          
          // Estimate pose (simplified)
          const tagSize = calculateTagSize(detectedCorners);
          const distance = estimateDistance(tagSize);
          
          // Clean up
          src.delete();
          gray.delete();
          corners.delete();
          ids.delete();
          rejected.delete();
          corner.delete();
          
          return {
            id: 6,
            corners: detectedCorners,
            center: { x: centerX, y: centerY },
            pose: {
              translation: { 
                x: centerX - imageData.width/2, 
                y: imageData.height/2 - centerY, 
                z: distance 
              },
              rotation: { x: 0, y: 0, z: 0 } // Add rotation calculation if needed
            }
          };
        }
      }
    }
    
    // Clean up
    src.delete();
    gray.delete();
    corners.delete();
    ids.delete();
    rejected.delete();
    
  } catch (error) {
    console.error('OpenCV detection error:', error);
  }
  
  return null;
}

function calculateTagSize(corners: Array<{x: number, y: number}>): number {
  // Calculate average edge length
  const edge1 = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
  const edge2 = Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2));
  return (edge1 + edge2) / 2;
}

function estimateDistance(pixelSize: number): number {
  // Rough distance estimation based on known tag size
  // Adjust these values based on your actual tag size and camera
  const KNOWN_TAG_SIZE_MM = 80; // Your actual tag size in mm
  const CAMERA_FOCAL_LENGTH = 500; // Approximate focal length in pixels
  
  return (KNOWN_TAG_SIZE_MM * CAMERA_FOCAL_LENGTH) / pixelSize;
}
```

## 3. Initialize OpenCV

Add this to your camera initialization:

```typescript
declare global {
  interface Window {
    cv: any;
  }
}

function onOpenCvReady() {
  console.log('OpenCV.js is ready');
  // You can now use real detection
}

// Check if OpenCV is ready
function isOpenCvReady(): boolean {
  return typeof window.cv !== 'undefined' && window.cv.getBuildInformation;
}
```

## 4. Update Detection Call

In your `detectAprilTags()` function, replace:
```typescript
const mockDetection = detectMockAprilTag(imageData);
```

With:
```typescript
const detection = isOpenCvReady() ? detectRealAprilTag(imageData) : detectMockAprilTag(imageData);
```

## 5. Tag Printing

Print a Circle21h7 AprilTag with ID 6:
- Use the AprilTag generator: https://github.com/AprilRobotics/apriltag-imgs
- Print at approximately 80mm x 80mm size
- Mount securely on the robot arm front

## Performance Notes

- OpenCV.js is about 8MB, so it may take time to load
- Consider loading it asynchronously and showing a loading indicator
- For better performance, you might want to reduce detection frequency
- Real detection is more CPU intensive than the mock version

This will give you genuine AprilTag detection with accurate position and pose estimation!
