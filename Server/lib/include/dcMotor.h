#pragma once
#include <ESP32Encoder.h>
#include <driver/adc.h>
#include <ArduinoJson.h>
#include "constants.h"

namespace lukeRobot {
class DcMotor {
public:
    DcMotor();
    ESP32Encoder encoder;
    TaskHandle_t PIDTask;
    float leadScrewDisplacement = 0;
    float pulsesPerMM = 0;
    float dcSpeedFactor = 1;
    volatile bool pidEnable = false;
    volatile long targetPulses = 0;
    void begin();

    /**
     * @brief Move the robot in the lead screw direction by a specific distance in mm.
     * @param mm Moves a given mm distance 20 degree inclined to the vertical.
     * @param speed The speed at which to move the robot in the z direction (0-1).
     * @param dir The direction to move: 0 for up (moveUp), 1 for down (moveDown).
     * @return true if processed.
     */
    bool dcUpDown(float mm, float speed, bool dir);
    float currentValue();
    float currentValueFast();

private:
    uint16_t _currentReadingOffset = 0;
    static void calculatePIDWrapper(void * parameter);
    void setupPIDTask();
    void calculatePID();
    void zeroCurrentSensor(); 
};
}