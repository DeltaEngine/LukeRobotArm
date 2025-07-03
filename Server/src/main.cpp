#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <TFT_eSPI.h>

#define USER_SETUP_LOADED 
//important for our ttgo, TFT_BL must be setup in User_Setup.h
#define ST7789_DRIVER      // Full configuration option, define additional parameters below for this display
#define TFT_WIDTH  135
#define TFT_HEIGHT 240
#define TFT_MISO -1       // Not connected
#define TFT_MOSI 19
#define TFT_SCLK 18
#define TFT_CS    5    // Chip select control pin (GPIO 5 on the TTGO)
#define TFT_DC    16   // Data Command control pin (GPIO 16 on the TTGO)
#define TFT_RST   23   // Reset pin (GPIO 23 on the TTGO, or you can use -1 if you want to omit reset)
#define TFT_BL    4
TFT_eSPI tft = TFT_eSPI();

void setupDisplay() {
  Serial.begin(250000);
  tft.init();
  tft.setRotation(1);
  pinMode(TFT_BL, OUTPUT);  // Set backlight pin as output
  digitalWrite(TFT_BL, HIGH);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.drawString("Booting...", 10, 10);
}

void setupWifi() {
  WiFiManager wifiManager;
  tft.drawString("Connecting WiFi", 10, 40);
  String apName = "Luke-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  if (!wifiManager.autoConnect(apName.c_str())) {
    tft.drawString("WiFi Failed!", 10, 70);
    Serial.println("\nWiFi connection failed");
    return;
  }
  tft.drawString("WiFi OK", 10, 70);
  tft.drawString(WiFi.localIP().toString(), 10, 100);
  Serial.println("\nWiFi connected");
  Serial.println(WiFi.localIP()); 
}

void setupOTA() {
  ArduinoOTA.onStart([]() {
    tft.fillScreen(TFT_BLACK);
    tft.drawString("OTA Start", 10, 10);
    Serial.println("OTA Start");
  });
  ArduinoOTA.onEnd([]() {
    tft.drawString("OTA End", 10, 40);
    Serial.println("OTA End");
  });
  ArduinoOTA.onError([](ota_error_t error) {
    tft.drawString("OTA Error!", 10, 70);
    Serial.printf("OTA Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR) Serial.println("End Failed");
  });
  ArduinoOTA.begin();
}

void setup() {
  setupDisplay();
  setupWifi();
  setupOTA();
}

void loop() {
  ArduinoOTA.handle();
}