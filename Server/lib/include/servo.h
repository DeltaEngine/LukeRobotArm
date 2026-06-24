#pragma once
#include "constants.h"
#include "STSServoDriver.h"
#include "Preferences.h"

namespace lukeRobot {
	using namespace Constants;
	class Servo {
public:
		Servo();
		bool calibServos;
		uint8_t numberOfServos = 0;
		uint16_t servoOneVelocity = 2 * Constants::TARGET_VELOCITY_STEPS;
		uint16_t servoOneAcceleration = 2 * Constants::TARGET_ACCELERATION;
		uint16_t minStepsToFullSpeed1 = (servoOneVelocity * servoOneVelocity) / (2 * 100 * servoOneAcceleration);
		uint16_t minStepsToFullSpeed2 = (Constants::TARGET_VELOCITY_STEPS * Constants::TARGET_VELOCITY_STEPS) / (2 * 100 * Constants::TARGET_ACCELERATION);
		STSServoDriver servos;
		Constants::GripperType gripperType = Constants::GripperType::ONE_DOF;

		struct ServoParameters{
			uint8_t servoId;
			int16_t currentPosition;
			int16_t minPosition;
			int16_t maxPosition;
			int16_t centerPosition;
			int16_t offset;
			};
		ServoParameters servoInfo[5];

				bool begin(Constants::GripperType GripperType);
		bool serial2Setup();
		void moveJoint(byte id, int position, int speed = TARGET_VELOCITY_STEPS);
		void moveJoints(byte numberofServos, byte id[], int position[], int speed[]);

		/**
		 * @brief Find the servo center position by moving it to its limits and calculating the midpoint.
		 */
		bool calibrateServos();

private:
		Preferences _preferences;
		void waitForServotoStop(byte id);
	};
}