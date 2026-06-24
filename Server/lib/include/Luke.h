#pragma once
#include <constants.h>
#include <Adafruit_NeoPixel.h>
#include <Arduino.h>
#include "dcMotor.h"
#include "servo.h"

namespace lukeRobot {
	class Luke
	{
	public:

		float thetaOne = 0, thetaTwo = 0, displacementZ = 0;
		float requiredX = 350, requiredY = 0, requiredZ = 150;

		
		Adafruit_NeoPixel strip;

		/**
		 * @brief Constructor to initialize memory, kinematics, and structural state profiles.
		 */
		Luke();

		/**
		 * @brief Initializing function to setup the robot.
		 * @param gripperType 0 for 1-DOF, 1 for 2-DOF.
		 */
		bool begin(Constants::GripperType GripperType);

		/**
		 * @brief Home the DC motor and find it's zero.
		 */
		bool homeDC();

		/**
		 * @brief Calculates the pulses per mm required by counting the number of pulses for a given lead screw distance.
		 * @note Goes up until it hits the top, then moves down and counts the number of pulses.
		 */
		void calibrateDC();

		/**
		 * @brief Set the LED strip to the given RGB color.
		 * @param r Red value for the LED strip (0-255).
		 * @param g Green value for the LED strip (0-255).
		 * @param b Blue value for the LED strip (0-255).
		 */
		void ledStrip(int r, int g, int b);

		/**
		 * @brief Turns the cooling fan on or off.
		 * @param state fanOn turns the fan on, fanOff turns the fan off.
		 */
		void fanControl(bool state);

		/**
		 * @brief Controls the gripper to open or close.
		 * @note Limit is initialised internally if left blank.
		 * @param openLimit Sets the amount the gripper opens. 0 is fully closed, servoInfo[4].centerPosition is center position and servoInfo[4].maxPosition is fully open.
		 * @param gripTorque Set the target torque for gripping.
		 */
		void grip(int openLimit = -1, int gripTorque = Constants::GRIPPING_TORQUE_LIMIT);

		/**
		 * @brief Moves the gripper to a specific  cartesian position.
		 * @param requiredX X position relative to base center in mm.
		 * @param requiredY Y position relative to base center in mm.
		 * @param requiredZ Z position relative to base center in mm.
		 */
		bool moveRobotCartesian(float requiredX, float requiredY, float requiredZ);

		/**
		 * @brief Moves the joints of the robot to specific angles and displacement.
		 * @param numberOfServos The number of servos to move.
		 * @param id An array of servo IDs to move.
		 * @param angles An array of target angles for each servo.
		 * @param displacement The target displacement for the lead screw.
		 */
		bool moveRobotJoints(byte numberOfServos, byte id[], float angles[], float displacement);


		/**
		 * @brief Inquires whether the servos or the dc motor are currently moving.
		 * @note If one of the servos is disconnected, it will return true.
		 * @return true if the robot is currently moving.
		 * @return false if the robot is currently not moving.
		 */
		bool isRobotMoving();

		/**
		 * @brief Gets the current position of a servo in steps.
		 * @note Motor 1 has an angular resolution of 2, which means 2048 can mean 1024 or 3072.
		 * @param id Servo motor ID.
		 * @return Number of steps the servo is at (0-4096).
		 */
		float getPosition(byte id);

		
	private:
		DcMotor _dcMotor;
		Servo _servo;
		bool _zDirection;
		bool _isGripperOpen = false;
		float _delayTime;
		float _calculatedX = 0, _calculatedY = 0, _calculatedZ = 178, _calculatedAlpha = 0, _calculatedBeta = 0, _calculatedGamma = 0;
		unsigned long _timeRequired    = 0, _startTime     = 0;
	
		static constexpr int _maxSpeed = 100;
		static constexpr int _minSpeed = 0;
		static constexpr int _positionToleranceInDegrees = 2;
		
		void forwardKinematics( float armOneDegree, float armTwoDegree);
		bool inverseKinematics(float requiredX, float requiredY, float requiredZ);
		float currentZ();
	};
}