#include "servo.h"

namespace lukeRobot {
    using namespace Constants;
    Servo::Servo() {
    }
    
    bool Servo::begin(Constants::GripperType GripperType) {
        Servo::serial2Setup();
		_preferences.begin("lukeStorage", false);
		gripperType = GripperType;
		for (int i = 0; i < 5; ++i) {
			servoInfo[i].servoId = i+1;
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::TARGET_ACCELERATION, TARGET_ACCELERATION);											delay(SERVO_REGISTER_DELAY_MS);
			if(i==0){
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::TARGET_ACCELERATION, servoOneAcceleration);										delay(SERVO_REGISTER_DELAY_MS);
			}

			if(calibServos) {
				servoInfo[i].minPosition = SERVO_CALIBRATION_CONST;
				servoInfo[i].maxPosition = _preferences.getInt(("maxPos" + String(servoInfo[i].servoId)).c_str(), SERVO_RANGE);
				if (i != 0)
					servoInfo[i].centerPosition = ( servoInfo[i].maxPosition + servoInfo[i].minPosition) / 2;
				else
					servoInfo[i].centerPosition = ( servoInfo[i].maxPosition + servoInfo[i].minPosition) / 2 + (SERVO_CALIBRATION_CONST * 2);
				Serial.printf("Servo %d min: %d max: %d center: %d\n", servoInfo[i].servoId, servoInfo[i].minPosition, servoInfo[i].maxPosition, servoInfo[i].centerPosition);
			}
			#if defined(DEBUG)
				Serial.printf("Pinging Servo %d ", i+1);
				#endif
			bool pingResult = servos.ping(i);
			if (pingResult) {
				Serial.printf("Servo %d found\n", servoInfo[i].servoId);
			}
			++numberOfServos;
		}
		_preferences.putBool("calibServos", true);
		_preferences.end();
        return true;
    }

	bool Servo::serial2Setup() {
		Serial2.begin(1000000, SERIAL_8N1, Pins::SERIAL_BUS_CTRL_RX, Pins::SERIAL_BUS_CTRL_TX, false, 4096);
		if (!servos.init(Pins::SERIAL_BUS_CTRL_DIR, &Serial2)) {
			return false;
			}
		return true;
	}

	bool Servo::calibrateServos() {
		_preferences.begin("lukeStorage", false);
		int fiveCalibrated = 0;
		//Calibrate servos 1, 2, 3 and 5
		for (int i = 0; i < 4; ++i) {
			if(i == 2 && fiveCalibrated == 0) {
				i = 4;
			}
			if(i == 3) {
				break;
			}
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::WRITE_LOCK, 0);											delay(SERVO_REGISTER_DELAY_MS);
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::RESPONSE_DELAY, SERVO_RESPONSE_DELAY);						delay(SERVO_REGISTER_DELAY_MS);
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::MAXIMUM_TEMPERATURE, MAX_SERVO_TEMP_CELSIUS);				delay(SERVO_REGISTER_DELAY_MS);
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::TORQUE_PROTECTION_TH, PROTECTION_TORQUE_LIMIT);			delay(SERVO_REGISTER_DELAY_MS);
			servos.writeTwoBytesRegister(servoInfo[i].servoId, STSRegisters::TORQUE_LIMIT, LIMIT_TORQUE_THRESHOLD);				delay(SERVO_REGISTER_DELAY_MS);
			servos.writeTwoBytesRegister(servoInfo[i].servoId, STSRegisters::POSITION_CORRECTION, 0);							delay(SERVO_REGISTER_DELAY_MS);
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::OVERLOAD_TORQUE, OVERLOAD_TORQUE_LIMIT);					delay(SERVO_REGISTER_DELAY_MS);
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::TORQUE_PROTECTION_TIME, OVERLOAD_PROTECT_TIME);			delay(SERVO_REGISTER_DELAY_MS);
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::OVERCURRENT_TIME, OVER_CURRENT_TIME);						delay(SERVO_REGISTER_DELAY_MS);
			servos.setMode(servoInfo[i].servoId, STSMode::VELOCITY);
			servos.setTargetVelocity(servoInfo[i].servoId, CALIBRATION_SPEED_STEPS);
			waitForServotoStop(servoInfo[i].servoId);
			servoInfo[i].maxPosition = servos.getCurrentPosition(servoInfo[i].servoId);
			servos.setTargetVelocity(servoInfo[i].servoId, -CALIBRATION_SPEED_STEPS);
			waitForServotoStop(servoInfo[i].servoId);
			servoInfo[i].minPosition = servos.getCurrentPosition(servoInfo[i].servoId);
			//offset range is -2047 to 2047, position correction only works in position mode not velocity mode
			if(servoInfo[i].minPosition < HALF_SERVO_RANGE) {
					servoInfo[i].offset = servoInfo[i].minPosition;
				}
			else {
					servoInfo[i].offset = HALF_SERVO_RANGE + (SERVO_RANGE - servoInfo[i].minPosition);
				}
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::TORQUE_SWITCH, 0);											delay(SERVO_REGISTER_DELAY_MS);
			servos.writeTwoBytesRegister(servoInfo[i].servoId, STSRegisters::POSITION_CORRECTION, servoInfo[i].offset);			delay(SERVO_REGISTER_DELAY_MS);
			servos.writeTwoBytesRegister(servoInfo[i].servoId, STSRegisters::TORQUE_LIMIT, TARGET_TORQUE);						delay(SERVO_REGISTER_DELAY_MS);
			servos.setMode(servoInfo[i].servoId, STSMode::POSITION);
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::TORQUE_SWITCH, 1);											delay(SERVO_REGISTER_DELAY_MS);
			
			if(i==2 || i==4) {
				if(servoInfo[i].maxPosition > servoInfo[i].minPosition) {
					servoInfo[i].maxPosition = servoInfo[i].maxPosition - servoInfo[i].minPosition - SERVO_CALIBRATION_CONST;
				}
				else {
					servoInfo[i].maxPosition = SERVO_RANGE - servoInfo[i].minPosition + servoInfo[i].maxPosition - SERVO_CALIBRATION_CONST * 2;
				}
				_preferences.putInt(("maxPos" + String(servoInfo[i].servoId)).c_str(), servoInfo[i].maxPosition);
				servoInfo[i].minPosition = SERVO_CALIBRATION_CONST;
				if(i==2) {
					delay(200);
					moveJoint(servoInfo[i].servoId, SERVO_3_HOME_POSITION, TARGET_VELOCITY_STEPS);
				}
				else {
					moveJoint(servoInfo[i].servoId, servoInfo[i].minPosition, TARGET_VELOCITY_STEPS);
					fiveCalibrated = 1	;
					waitForServotoStop(servoInfo[i].servoId);
					servoInfo[i].centerPosition = ( servoInfo[i].maxPosition + servoInfo[i].minPosition) / 2;
					servos.writeRegister(servoInfo[i].servoId, STSRegisters::WRITE_LOCK, 1);
					i=1;
				}
			}
			else if(i==0 || i==1) {
				if(i==0) {
					servos.writeRegister(servoInfo[i].servoId, STSRegisters::MINIMUM_ANGLE, 0);									delay(SERVO_REGISTER_DELAY_MS);
					servos.writeRegister(servoInfo[i].servoId, STSRegisters::MAXIMUM_ANGLE, 0);									delay(SERVO_REGISTER_DELAY_MS);
					servos.writeRegister(servoInfo[i].servoId, STSRegisters::ANGULAR_RESOLUTION, 2);							delay(SERVO_REGISTER_DELAY_MS);
				}
				
				if(i == 0) {
					servoInfo[i].maxPosition = SERVO_RANGE - abs(servoInfo[i].maxPosition - servoInfo[i].minPosition) - SERVO_CALIBRATION_CONST;
					servoInfo[i].minPosition = SERVO_CALIBRATION_CONST;
					servoInfo[i].centerPosition = ( servoInfo[i].maxPosition + servoInfo[i].minPosition) / 2 + (SERVO_CALIBRATION_CONST * 2);
				}
				else {
					if(abs(servoInfo[i].maxPosition - servoInfo[i].minPosition) > HALF_SERVO_RANGE)
						servoInfo[i].maxPosition = abs(servoInfo[i].maxPosition - servoInfo[i].minPosition) - SERVO_CALIBRATION_CONST;
					else
						servoInfo[i].maxPosition = SERVO_RANGE - abs(servoInfo[i].maxPosition - servoInfo[i].minPosition) - SERVO_CALIBRATION_CONST;
					servoInfo[i].minPosition = SERVO_CALIBRATION_CONST;
					servoInfo[i].centerPosition = ( servoInfo[i].maxPosition + servoInfo[i].minPosition) / 2;
				}
				moveJoint(servoInfo[i].servoId, servoInfo[i].centerPosition, TARGET_VELOCITY_STEPS);
				_preferences.putInt(("maxPos" + String(servoInfo[i].servoId)).c_str(), servoInfo[i].maxPosition);
			}
			else {
			}
			waitForServotoStop(servoInfo[i].servoId);
			
			servos.writeRegister(servoInfo[i].servoId, STSRegisters::WRITE_LOCK, 1);
		}
		//Calibrate servo 4
		_preferences.putBool("calibServos", true);
		_preferences.end();
		return true;
	}

	void Servo::moveJoint(byte id, int position, int speed) {
		delay(10);
		servos.setTargetPosition(id, position, speed);
		servoInfo[id-1].currentPosition = position;
		return;
	}

	void Servo::moveJoints(byte numberofServos, byte id[], int position[], int speed[]) {
		servos.setTargetPositions(numberofServos, id, position, speed);
		for(int i=0; i<numberofServos; i++){
			servoInfo[id[i]-1].currentPosition = position[i];
		}
		return;
	}
    
	void Servo::waitForServotoStop(byte id) {
		delay(SERVO_INSTRUCTION_DELAY);
		while(servos.isMoving(id))
		{
			}
	}

}