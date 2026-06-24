#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <esp_task_wdt.h>

String GetLukeName()
{
  return "Luke-" + String((uint32_t)ESP.getEfuseMac(), HEX);
}

void setupWifi()
{
  WiFiManager wifiManager;
  if (!wifiManager.autoConnect(GetLukeName().c_str()))
  {
    Serial.println("\nWiFi connection failed");
    return;
  }
  WiFi.setSleep(false);
  Serial.println("\nWiFi connected");
  Serial.println(WiFi.localIP());
}

void setupOTA()
{
  ArduinoOTA.setHostname(GetLukeName().c_str());
  ArduinoOTA.setTimeout(30000);
  ArduinoOTA.onStart([]()
{
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else { // U_SPIFFS
      type = "filesystem";
    }
    esp_task_wdt_deinit();
    Serial.println("Start updating " + type);
  });
  ArduinoOTA.onEnd([]()
  {
    Serial.println("\nEnd");
    esp_task_wdt_init(20, true);
    esp_task_wdt_add(NULL);
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total)
  {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    esp_task_wdt_reset();
  });

  ArduinoOTA.onError([](ota_error_t error)
  {
    Serial.printf("Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) {
      Serial.println("Auth Failed");
    } else if (error == OTA_BEGIN_ERROR) {
      Serial.println("Begin Failed");
    } else if (error == OTA_CONNECT_ERROR) {
      Serial.println("Connect Failed");
    } else if (error == OTA_RECEIVE_ERROR) {
      Serial.println("Receive Failed");
    } else if (error == OTA_END_ERROR) {
      Serial.println("End Failed");
    }
    esp_task_wdt_init(20, true);
    esp_task_wdt_add(NULL); });
  ArduinoOTA.begin();
  Serial.println("OTA Ready");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void setup()
{
  Serial.begin(115200);
  esp_task_wdt_init(20, true);
  esp_task_wdt_add(NULL);
  setupWifi();
  setupOTA();
}

void loop()
{
  esp_task_wdt_reset();
  ArduinoOTA.handle();
  delay(1);
}