#pragma once

#include <Arduino.h>
namespace Constants
{
    constexpr uint8_t ALL_SERVOS_ID = 0xFE;

    namespace Pins
    {
        constexpr uint8_t PCB_POWER_LED = 8;
        constexpr uint8_t MOTOR_DIRECTION = 1;
        constexpr uint8_t MOTOR_PWM = 2;
        constexpr uint8_t CURRENT_READING = 9;
        constexpr uint8_t MOTOR_FAULT = 10;
        constexpr uint8_t MOTOR_SLEEP = 11;
        constexpr uint8_t ENCODER_B = 41;
        constexpr uint8_t ENCODER_A = 42;
        constexpr uint8_t SERIAL_BUS_CTRL_DIR = 6;
        constexpr uint8_t SERIAL_BUS_CTRL_TX = 17;
        constexpr uint8_t SERIAL_BUS_CTRL_RX = 18;
        constexpr uint8_t LED_STRIP = 35;
        constexpr uint8_t FAN_CONTROL = 36;
    }

    enum class FanState : bool
    {
        OFF = LOW,
        ON = HIGH
    };

    enum class LinearDirection : bool
    {
        UP = 0,
        DOWN = 1
    };

    enum class GripperType : byte
    {
        ONE_DOF = 1,
        TWO_DOF = 2,
        OTHER = 255
    };

    constexpr float PID_KP = 1.5f;
    constexpr float PID_KI = 0.01f;
    constexpr float PID_KD = 1.5f;
    constexpr float R_PROP = 1200.0f;

    constexpr byte LED_COUNT = 11;
    constexpr uint16_t SERVO_RANGE = 4046;
    constexpr uint16_t HALF_SERVO_RANGE = SERVO_RANGE / 2;
    constexpr float DEGREE_TO_STS_SCALE = 4096.0f / 360.0f;
    constexpr float RADIAN_TO_STS_SCALE = 4096.0f / (2.0f * PI);

    constexpr float BASE_HEIGHT = 85.765f;
    constexpr float LEAD_SCREW_DISTANCE = 122.429f;
    constexpr float ARM_ONE_LENGTH = 277.458f;
    constexpr float ARM_TWO_LENGTH = 212.994f;
    constexpr float GRIPPER_HEIGHT = 237.550f;
    constexpr float MOVABLE_Z_DISTANCE = 373.889f;

    constexpr uint16_t MS_PER_SECOND = 1000;
    constexpr uint8_t MAX_NUMBER_OF_SERVOS = 5;

    constexpr uint16_t CALIBRATION_SPEED_STEPS = 750;  // steps/s
    constexpr uint16_t LIMIT_TORQUE_THRESHOLD = 300;   // 0.1% units
    constexpr uint16_t SERVO_INSTRUCTION_DELAY = 2000; // ms
    constexpr uint8_t SERVO_CALIBRATION_CONST = 20;    // Position units
    constexpr uint16_t TARGET_VELOCITY_STEPS = 1500;   // steps/s
    constexpr uint16_t TARGET_ACCELERATION = 25;       // 100 steps/s^2
    constexpr uint16_t TARGET_TORQUE = 1000;           // 0.1% units
    constexpr uint8_t PROTECTION_TORQUE_LIMIT = 20;    // 1% units
    constexpr uint8_t OVERLOAD_TORQUE_LIMIT = 20;      // 1% units
    constexpr uint16_t SERVO_REGISTER_DELAY_MS = 150;  // ms
    constexpr uint8_t SERVO_RESPONSE_DELAY = 100;      // 2us units
    constexpr uint8_t MAX_SERVO_TEMP_CELSIUS = 50;     // Degrees C
    constexpr uint8_t OVERLOAD_PROTECT_TIME = 10;      // 10ms units
    constexpr uint8_t OVER_CURRENT_TIME = 1;           // 10ms units
    constexpr uint16_t SERVO_3_HOME_POSITION = 1240;   // steps
    constexpr uint16_t GRIPPING_TORQUE_LIMIT = 450;    // steps
    constexpr uint16_t GRIPPING_VALUE = 500;           // steps
}