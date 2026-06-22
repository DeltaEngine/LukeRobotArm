importScripts('apriltag_wasm.js');
importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

/**
 * This is a wrapper class that calls apriltag_wasm to load the WASM module and wraps the c implementation calls.
 * The apriltag dectector uses the tag36h11 family.
 * For tag pose estimation, call set_tag_size allows to indicate the size of known tags.
 * If size is not defined using set_tag_size() will default to the defaukt tag size of 0.15 meters
 *
 */
class Apriltag {

  /**
   * Contructor
   * @param {function} onDetectorReadyCallback Callback when the detector is ready
   */    constructor(onDetectorReadyCallback) {
        //detectorOptions = detectorOptions || {};

        this.onDetectorReadyCallback = onDetectorReadyCallback;
        this.isInitialized = false; // Track initialization status        // detector options
        this._opt = {
          // Decimate input image by this factor (1.0 = full resolution, 2.0 = half resolution)
          quad_decimate: 1.0,  // Changed from 2.0 for better detail at higher resolutions
          // What Gaussian blur should be applied to the segmented image; standard deviation in pixels
          quad_sigma: 0.0,
           // Use this many CPU threads (no effect)
          nthreads: 1,
          // Spend more time trying to align edges of tags
          refine_edges: 1,
          // Maximum detections to return (0=return all)
          max_detections: 0,// Return pose (requires camera parameters)
          return_pose: 1,
          // Return pose solutions details
          return_solutions: 1
        };

        let _this = this;
        AprilTagWasm().then(function (Module) {
            _this.onWasmInit(Module);
        }).catch(function(error) {
            console.error("Failed to load AprilTag WASM module:", error);
        });
    }

    /**
     * Init warapper calls
     * @param {*} Module WASM module instance
     */
    onWasmInit(Module) {// save a reference to the module here
        this._Module = Module;
          // Check if we need to initialize the heap views
        if (!Module.HEAPU8 && Module.wasmMemory) {
            Module.HEAP8 = new Int8Array(Module.wasmMemory.buffer);
            Module.HEAPU8 = new Uint8Array(Module.wasmMemory.buffer);
            Module.HEAP16 = new Int16Array(Module.wasmMemory.buffer);
            Module.HEAPU16 = new Uint16Array(Module.wasmMemory.buffer);
            Module.HEAP32 = new Int32Array(Module.wasmMemory.buffer);
            Module.HEAPU32 = new Uint32Array(Module.wasmMemory.buffer);
        } else if (!Module.HEAPU8 && Module.memory && Module.memory.buffer) {
            Module.HEAP8 = new Int8Array(Module.memory.buffer);
            Module.HEAPU8 = new Uint8Array(Module.memory.buffer);
            Module.HEAP16 = new Int16Array(Module.memory.buffer);
            Module.HEAPU16 = new Uint16Array(Module.memory.buffer);
            Module.HEAP32 = new Int32Array(Module.memory.buffer);
            Module.HEAPU32 = new Uint32Array(Module.memory.buffer);
        }
        
        //int atagjs_init(); Init the apriltag detector with default options
        this._init = Module.cwrap('atagjs_init', 'number', []);
        //int atagjs_destroy(); Releases resources allocated by the wasm module
        this._destroy = Module.cwrap('atagjs_destroy', 'number', []);
        //int atagjs_set_detector_options(float decimate, float sigma, int nthreads, int refine_edges, int max_detections, int return_pose, int return_solutions); Sets the given detector options
        this._set_detector_options = Module.cwrap('atagjs_set_detector_options', 'number', ['number', 'number', 'number', 'number', 'number', 'number', 'number']);
        //int atagjs_set_pose_info(double fx, double fy, double cx, double cy); Sets the tag size (meters) and camera intrinsics (in pixels) for tag pose estimation
        this._set_pose_info = Module.cwrap('atagjs_set_pose_info', 'number', ['number', 'number', 'number', 'number']);
        //uint8_t* atagjs_set_img_buffer(int width, int height, int stride); Creates/changes size of the image buffer where we receive the images to process
        this._set_img_buffer = Module.cwrap('atagjs_set_img_buffer', 'number', ['number', 'number', 'number']);
        //void *atagjs_set_tag_size(int tagid, double size)
        this._atagjs_set_tag_size = Module.cwrap('atagjs_set_tag_size', null, ['number', 'number']);
        //t_str_json* atagjs_detect(); Detect tags in image previously stored in the buffer.
        //returns pointer to buffer starting with an int32 indicating the size of the remaining buffer (a string of chars with the json describing the detections)
        this._detect = Module.cwrap('atagjs_detect', 'number', []);

        // inits detector
        this._init();        // set max_detections = 0, meaning no max; will return all detections
        //options: float decimate, float sigma, int nthreads, int refine_edges, int max_detections, int return_pose, int return_solutions
        this._set_detector_options(
          this._opt.quad_decimate,
          this._opt.quad_sigma,
          this._opt.nthreads,
          this._opt.refine_edges,
          this._opt.max_detections,
          this._opt.return_pose,
          this._opt.return_solutions);        this.isInitialized = true; // Mark as initialized
        
        // Double-check heap availability after a short delay
        setTimeout(() => {
            console.log("Post-init heap check:");
            console.log("HEAPU8 available:", !!this._Module.HEAPU8);
            console.log("HEAP8 available:", !!this._Module.HEAP8);
            if (this._Module.HEAPU8) {
                console.log("HEAPU8 length:", this._Module.HEAPU8.length);
            }
        }, 100);
        
        this.onDetectorReadyCallback();
      }

      /**
       * **public** detect method
       * @param {Array} grayscaleImg grayscale image buffer
       * @param {Number} imgWidth image with
       * @param {Number} imgHeight image height
       * @return {detection} detection object
       */    detect(grayscaleImg, imgWidth, imgHeight) {
        // Check if module is properly initialized
        if (!this.isInitialized || !this._Module) {
            console.error("WASM module not initialized");
            return { error: "WASM module not initialized" };
        }        // Alternative approach: Use the allocated buffer directly
        // Since we can allocate memory but can't access heap views, we'll use a different strategy
        
        // Allocate buffer for the image
        let imgBuffer = this._set_img_buffer(imgWidth, imgHeight, imgWidth);
        if (imgWidth * imgHeight < grayscaleImg.length) return { result: "Image data too large." };
        
        // Try to copy data byte by byte using setValue
        try {
            // Only log once to reduce console spam
            if (!this._copyMethodLogged) {
                console.log("Using setValue method to copy", grayscaleImg.length, "bytes to buffer at", imgBuffer);
                this._copyMethodLogged = true;
            }
            
            for (let i = 0; i < grayscaleImg.length && i < imgWidth * imgHeight; i++) {
                this._Module.setValue(imgBuffer + i, grayscaleImg[i], "i8");
            }
        } catch (error) {
            console.error("Error setting image data byte by byte:", error);
            return { error: "Failed to set image data: " + error.message };
        }        // Call detect
        let strJsonPtr = this._detect();
        
        /* detect returns a pointer to a t_str_json c struct as follows
            size_t len; // string length
            char *str;
            size_t alloc_size */
        let strJsonLen = this._Module.getValue(strJsonPtr, "i32"); // get len from struct
        
        if (strJsonLen == 0) { // returned empty string
            return [];
        }

        let strJsonStrPtr = this._Module.getValue(strJsonPtr + 4, "i32"); // get *str from struct
          // Read the JSON string byte by byte
        let detectionsJson = '';
        try {
            for (let i = 0; i < strJsonLen; i++) {
                let charCode = this._Module.getValue(strJsonStrPtr + i, "i8");
                if (charCode < 0) charCode += 256; // Convert signed to unsigned
                detectionsJson += String.fromCharCode(charCode);
            }            // Silent operation - only log on critical errors
            if (detectionsJson.length > 2950) {
                console.error("⚠️ JSON buffer nearly full:", detectionsJson.length);
            }
            
            if (!detectionsJson.endsWith(']')) {
                console.error("❌ JSON truncated at", detectionsJson.length, "chars");
            }
        } catch (error) {
            console.error("Error reading JSON string:", error);
            return { error: "Failed to read detection results: " + error.message };
        }        let detections;
        try {
            detections = JSON.parse(detectionsJson);
            // Silent operation - no logging unless critical error
        } catch (error) {
            console.error("Error parsing JSON:", error);
            console.error("JSON string was:", detectionsJson);
              // Try to recover from truncated JSON by attempting to fix it
            try {
                console.log("Attempting to fix truncated JSON...");
                let fixedJson = detectionsJson;
                  // If it doesn't end with ] or }, try to close it properly
                if (!fixedJson.endsWith(']') && !fixedJson.endsWith('}')) {
                    // Find all complete objects (ending with })
                    let completeObjects = [];
                    let startIndex = fixedJson.indexOf('{');
                    
                    while (startIndex !== -1) {
                        let braceCount = 0;
                        let endIndex = startIndex;
                        
                        // Find the matching closing brace
                        for (let i = startIndex; i < fixedJson.length; i++) {
                            if (fixedJson[i] === '{') braceCount++;
                            else if (fixedJson[i] === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    endIndex = i;
                                    break;
                                }
                            }
                        }
                        
                        // If we found a complete object
                        if (braceCount === 0 && endIndex > startIndex) {
                            completeObjects.push(fixedJson.substring(startIndex, endIndex + 1));
                            startIndex = fixedJson.indexOf('{', endIndex + 1);
                        } else {
                            break; // Incomplete object, stop here
                        }
                    }
                    
                    if (completeObjects.length > 0) {
                        fixedJson = '[ ' + completeObjects.join(', ') + ' ]';
                        detections = JSON.parse(fixedJson);
                    } else {
                        throw new Error("Could not find any complete objects in truncated JSON");
                    }
                } else {
                    throw error; // Re-throw original error
                }
            } catch (recoveryError) {
                console.error("Could not recover from JSON parsing error:", recoveryError);
                return { error: "Failed to parse detection JSON: " + error.message };
            }
        }

        return detections;
    }

    /**
     * **public** set camera parameters
     * @param {Number} fx camera focal length
     * @param {Number} fy camera focal length
     * @param {Number} cx camera principal point
     * @param {Number} cy camera principal point
     */
    set_camera_info(fx, fy, cx, cy) {
        this._set_pose_info(fx, fy, cx, cy);
    }

    /**
     * **public** set size of known tag (size in meters)
     * @param {Number} tagid the tag id
     * @param {Number} size the size of the tag in meters
     */
    set_tag_size(tagid, size) {
        this._atagjs_set_tag_size(tagid, size);
    }

    /**
     * **public** set maximum detections to return (0=return all)
     * @param {Number} maxDetections
     */
    set_max_detections(maxDetections) {
        this._opt.max_detections = maxDetections;
        this._set_detector_options(
          this._opt.quad_decimate,
          this._opt.quad_sigma,
          this._opt.nthreads,
          this._opt.refine_edges,
          this._opt.max_detections,
          this._opt.return_pose,
          this._opt.return_solutions);
    }

    /**
     * **public** set return pose estimate (0=do not return; 1=return)
     * @param {Number} returnPose
     */
    set_return_pose(returnPose) {
        this._opt.return_pose = returnPose;
        this._set_detector_options(
          this._opt.quad_decimate,
          this._opt.quad_sigma,
          this._opt.nthreads,
          this._opt.refine_edges,
          this._opt.max_detections,
          this._opt.return_pose,
          this._opt.return_solutions);
    }

    /**
     * **public** set return pose estimate alternative solution details (0=do not return; 1=return)
     * @param {Number} returnSolutions
     */
    set_return_solutions(returnSolutions) {
        this._opt.return_solutions = returnSolutions;
        this._set_detector_options(
          this._opt.quad_decimate,
          this._opt.quad_sigma,
          this._opt.nthreads,
          this._opt.refine_edges,
          this._opt.max_detections,
          this._opt.return_pose,
          this._opt.return_solutions);
    }

    /**
     * **public** disable pose estimation temporarily (for debugging multiple detections)
     */
    disable_pose_estimation() {
        console.log("Disabling pose estimation to debug multiple detections");
        this._opt.return_pose = 0;
        this._opt.return_solutions = 0;
        this._set_detector_options(
          this._opt.quad_decimate,
          this._opt.quad_sigma,
          this._opt.nthreads,
          this._opt.refine_edges,
          this._opt.max_detections,
          this._opt.return_pose,
          this._opt.return_solutions);
    }

    /**
     * **public** re-enable pose estimation
     */
    enable_pose_estimation() {
        console.log("Re-enabling pose estimation");
        this._opt.return_pose = 1;
        this._opt.return_solutions = 1;
        this._set_detector_options(
          this._opt.quad_decimate,
          this._opt.quad_sigma,
          this._opt.nthreads,
          this._opt.refine_edges,
          this._opt.max_detections,
          this._opt.return_pose,
          this._opt.return_solutions);
    }

    /**
     * **public** test method to verify WASM functionality
     */    testWasmModule() {
        console.log("Testing WASM module...");
        console.log("Module initialized:", this.isInitialized);
        console.log("Module object:", !!this._Module);
        
        if (this._Module) {
            console.log("Available functions:");
            console.log("- _init:", typeof this._init);
            console.log("- _set_img_buffer:", typeof this._set_img_buffer);
            console.log("- _detect:", typeof this._detect);
            
            console.log("Memory heaps after potential creation:");
            console.log("- HEAPU8:", !!this._Module.HEAPU8, typeof this._Module.HEAPU8);
            console.log("- HEAP8:", !!this._Module.HEAP8, typeof this._Module.HEAP8);
            console.log("- buffer:", !!this._Module.buffer, typeof this._Module.buffer);
            console.log("- wasmMemory:", !!this._Module.wasmMemory, typeof this._Module.wasmMemory);
            
            if (this._Module.HEAPU8) {
                console.log("- HEAPU8 length:", this._Module.HEAPU8.length);
            }
            
            // Try to allocate a small test buffer
            try {
                let testBuffer = this._set_img_buffer(10, 10, 10);
                console.log("Test buffer allocation successful:", testBuffer);
                
                if (this._Module.HEAPU8) {
                    console.log("HEAPU8 test access successful");
                    // Try to write to the buffer
                    let testData = new Uint8Array(100);
                    testData.fill(128); // Fill with gray value
                    this._Module.HEAPU8.set(testData, testBuffer);
                    console.log("Test data write successful");
                } else if (this._Module.HEAP8) {
                    console.log("HEAP8 available as fallback");
                }
            } catch (error) {
                console.error("Test buffer allocation failed:", error);
            }
        }
    }

}

Comlink.expose(Apriltag);

/**
 * IMPORTANT: Fixed compatibility issue when switching from tag36h11 to tagCircle21h7
 * 
 * The original WASM module (tag36h11) had heap views (HEAPU8, HEAP8, etc.) automatically
 * created by Emscripten. The new tagCircle21h7 WASM module doesn't have these views
 * created automatically, so we need to create them manually from the underlying
 * WebAssembly memory buffer.
 * 
 * This affects both image data input (writing to HEAPU8) and result reading (HEAP8).
 * 
 */
