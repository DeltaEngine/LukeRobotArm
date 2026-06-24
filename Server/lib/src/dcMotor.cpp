#include "dcMotor.h"

namespace lukeRobot
{
    using namespace Constants;
    DcMotor::DcMotor()
    {
    }

    void DcMotor::begin()
    {
        pinMode(Pins::CURRENT_READING, INPUT);
        pinMode(Pins::MOTOR_FAULT, INPUT);
        pinMode(Pins::MOTOR_PWM, OUTPUT);
        pinMode(Pins::MOTOR_SLEEP, OUTPUT);
        pinMode(Pins::MOTOR_DIRECTION, OUTPUT);
        encoder.attachFullQuad(Pins::ENCODER_A, Pins::ENCODER_B);
        encoder.clearCount();
        zeroCurrentSensor();
        setupPIDTask();
    }

    void DcMotor::zeroCurrentSensor()
    {
        _currentReadingOffset = 0;
        int i;
        long temp = 0;
        analogWrite(Pins::MOTOR_PWM, 0);
        for (i = 0; i < 10; i++)
        {
            analogRead(Pins::CURRENT_READING);
            delay(1);
        }
        for (i = 0; i < 100; i++)
        {
            temp += analogRead(Pins::CURRENT_READING);
            delay(2);
        }
        _currentReadingOffset = (temp / i);
    }

    void DcMotor::setupPIDTask()
    {
        xTaskCreatePinnedToCore(
            calculatePIDWrapper,
            "PID_Task",
            4096,
            this,
            1,
            &PIDTask,
            0);
    }

    void DcMotor::calculatePIDWrapper(void *parameter)
    {
        DcMotor *instance = (DcMotor *)parameter;
        instance->calculatePID();
    }

    void DcMotor::calculatePID()
    {
        long previousError = 0;
        long integral = 0;
        int stallCounter = 0;
        long lastPulses = 0;
        int maxPWM = 255;
        for (;;)
        {
            if (!pidEnable)
            {
                previousError = 0;
                integral = 0;
                stallCounter = 0;
                lastPulses = encoder.getCount();
                vTaskDelay(10 / portTICK_PERIOD_MS);
                continue;
            }
            long currentPulses = encoder.getCount();
            long error = targetPulses - currentPulses;
            long derivative = error - previousError;
            if (abs(error) < 50)
            {
                integral += error;
            }
            else
            {
                integral = 0;
            }
            float motorPower = ((PID_KP * error) + (PID_KI * integral) + (PID_KD * derivative));
            int minPWM = 124;
            int dynamicMaxPWM = maxPWM * dcSpeedFactor;
            if (dynamicMaxPWM < minPWM)
                dynamicMaxPWM = minPWM;
            if (motorPower > dynamicMaxPWM)
                motorPower = dynamicMaxPWM;
            if (motorPower < -dynamicMaxPWM)
                motorPower = -dynamicMaxPWM;
            if (abs(error) > 20 && currentValueFast() > 4)
            {
                if (abs(currentPulses - lastPulses) < 5)
                {
                    stallCounter++;
                }
                else
                {
                    stallCounter = 0;
                }
                if (stallCounter >= 15)
                {
                    pidEnable = false;
                    motorPower = 0;
                    integral = 0;
                    stallCounter = 0;
                }
            }
            else
            {
                stallCounter = 0;
            }
            if (abs(error) <= 12)
            {
                motorPower = 0;
                integral = 0;
            }
            else
            {
                if (motorPower > 0 && motorPower < minPWM)
                    motorPower = minPWM;
                if (motorPower < 0 && motorPower > -minPWM)
                    motorPower = -minPWM;
            }
            if (motorPower > 0)
            {
                digitalWrite(Pins::MOTOR_SLEEP, HIGH);
                digitalWrite(Pins::MOTOR_DIRECTION, HIGH);
                analogWrite(Pins::MOTOR_PWM, abs(motorPower));
            }
            else if (motorPower < 0)
            {
                digitalWrite(Pins::MOTOR_SLEEP, HIGH);
                digitalWrite(Pins::MOTOR_DIRECTION, LOW);
                analogWrite(Pins::MOTOR_PWM, abs(motorPower));
            }
            else
            {
                analogWrite(Pins::MOTOR_PWM, 0);
            }
            previousError = error;
            lastPulses = currentPulses;
            vTaskDelay(10 / portTICK_PERIOD_MS);
        }
    }

    bool DcMotor::dcUpDown(float mm, float speed, bool dir)
    {
        if (dir)
        {
            leadScrewDisplacement -= mm;
        }
        else
        {
            leadScrewDisplacement += mm;
        }
        dcSpeedFactor = speed;
        targetPulses = leadScrewDisplacement * pulsesPerMM;
        return true;
    }

    float DcMotor::currentValueFast()
    {
        int raw = analogRead(Pins::CURRENT_READING);
        long diff = abs(raw - _currentReadingOffset);
        return ((diff * (3.3 / 4095.0)) / (1.2 * 0.450));
    }

    float DcMotor::currentValue()
    {
        int i, temp = 0;
        double sumSquared = 0;
        for (i = 0; i < 200; i++)
        {
            int raw = analogRead(Pins::CURRENT_READING);
            long diff = raw - _currentReadingOffset;
            sumSquared += (diff * diff);
            delayMicroseconds(100);
        }
        float rmsCounts = sqrt(sumSquared / i);
        return (((rmsCounts) * (3.3 / 4095.0)) / (1.2 * 0.450));
    }
}