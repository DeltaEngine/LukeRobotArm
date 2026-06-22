# Luke Robot Arm Server ESP32 Arduino Project

## Getting Started

1. **Use PlatformIO in VSCode**
   For a normal end user there is no need to use VSCode or PlatformIO to work with Luke, you can do everything from your phone or PC without any installation, but if you want to change something on the ESP32, use this repository as your starting point and feel free to change whatever you like. This is the exact code that runs on every Luke we ship.
2. **Configure WiFi**
   The line in the main.cpp file with wifiManager.autoConnect will try to connect with credentials previously setup, if that fails it opens an AP (wifi access point) with the name Luke-<id>, which you can connect to and then enter your own Wifi credentials.
3. **OTA Updates**
   Once connected to WiFi, future uploads can use OTA via --upload-port <device-ip>, which is more convenient than using an USB-C cable, which you always can do as well. Just make sure the robot is also powered by 12V, the USB-C cable is just for uploading and communiation, it won't power the whole robot (it still will start, but it can't detect the motors if they are off or do anything useful).