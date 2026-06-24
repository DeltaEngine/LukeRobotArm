#include "Luke.h"
#include "setup.h"
#include "kinematics.h"
#include <Preferences.h>

#define DEBUG
namespace lukeRobot {
	using namespace Constants;
	Luke::Luke()
		: strip(Adafruit_NeoPixel(LED_COUNT, Pins::LED_STRIP, NEO_GRB + NEO_KHZ800))
	{
	}

	bool Luke::begin(Constants::GripperType GripperType) {
		Preferences preferences;
		preferences.begin("lukeStorage", false);
		_dcMotor.begin();
  		_servo.calibServos = preferences.getBool("calibServos", false);
		_servo.begin(GripperType);
		_dcMotor.pulsesPerMM = preferences.getFloat("pulsesPerMM", 67.5 );
		preferences.end();
		Serial.println("Pulses per mm: " + String(_dcMotor.pulsesPerMM));
		pinMode(Pins::PCB_POWER_LED, OUTPUT);
		digitalWrite(Pins::PCB_POWER_LED, HIGH);
		pinMode(Pins::FAN_CONTROL, OUTPUT);
		strip.begin();
		strip.setBrightness(100);
		ledStrip(255, 255, 255);
		unsigned long currentMillis = 0;
		if (_servo.calibServos == false)  {
			_servo.calibrateServos();
		}
		char yesorno = 'n'; 
		Serial.print("Do you want to calibrate servos? (y/n): ");
		currentMillis = millis();
		while (Serial.available() == 0 && (millis() - currentMillis < 10000)) {
			delay(10); 
		}
		yesorno = Serial.read();
		if(yesorno == 'y' || yesorno == 'Y')  {
			_servo.calibrateServos();
		}
		while(Serial.available() > 0) {
			Serial.read(); 
		} 
		Serial.print("Do you want to calibrate dc motor? (y/n): ");
		currentMillis = millis();
		while (Serial.available() == 0 && (millis() - currentMillis < 10000)) {
			delay(10); 
		}
		yesorno = Serial.read();
		if(yesorno == 'y' || yesorno == 'Y')  {
			calibrateDC();
		}
		else {
			homeDC();
		}
		while(Serial.available() > 0) {
			Serial.read(); 
		}
		while(isRobotMoving())
		{
			delay(1);
		}
		moveRobotCartesian(380,0,150);
		byte targetId[] = {3};
		float targetAngle[] = {(float)0};
		moveRobotJoints(1, targetId, targetAngle, displacementZ);
		while(luke.isRobotMoving())
		{
			delay(1);
		}
		return true;
	}

	void Luke::calibrateDC() { 
		Preferences preferences;
		int pwmValue = 124;
		int64_t count = 0;
		if (_dcMotor.pulsesPerMM < 50)
			_dcMotor.pulsesPerMM = 67.5;
		_servo.moveJoint(_servo.servoInfo[2].servoId, 2200, TARGET_VELOCITY_STEPS);
		_servo.moveJoint(_servo.servoInfo[4].servoId, 100, TARGET_VELOCITY_STEPS);
		_dcMotor.pidEnable = false; 
		delay(50);
		digitalWrite(Pins::MOTOR_SLEEP, HIGH);     
		digitalWrite(Pins::MOTOR_DIRECTION, HIGH);            
		analogWrite(Pins::MOTOR_PWM, abs(pwmValue));
		for(int i=0;i<10;i++) {	
			_dcMotor.currentValue();
			delay(1);
		}
		while (_dcMotor.currentValue() < 4) {
			delay(1);
		}
		analogWrite(Pins::MOTOR_PWM, 0);
		delay(1000);
		for(int i=0;i<20;i++) {
			delay(1);
		}
		_dcMotor.targetPulses = 0;
		_dcMotor.encoder.clearCount();
		digitalWrite(Pins::MOTOR_SLEEP, HIGH);     
		digitalWrite(Pins::MOTOR_DIRECTION, LOW);            
		analogWrite(Pins::MOTOR_PWM, abs(pwmValue));
		for(int i=0;i<10;i++) {		
			_dcMotor.currentValue();
			delay(1);
		}
		while (_dcMotor.currentValue() < 4) {
			delay(1);
		}
		analogWrite(Pins::MOTOR_PWM, 0);
		delay(1000);
		_dcMotor.targetPulses = 0;
		_dcMotor.leadScrewDisplacement = 0;
		count = _dcMotor.encoder.getCount();
		_dcMotor.encoder.clearCount();
		_dcMotor.pulsesPerMM = abs(count) / MOVABLE_Z_DISTANCE;
		preferences.begin("lukeStorage", false);
		preferences.putFloat("pulsesPerMM", _dcMotor.pulsesPerMM);
		preferences.end();
		_dcMotor.pidEnable = true;
		_dcMotor.dcUpDown(200, 20, false); 
		_servo.moveJoint(_servo.servoInfo[2].servoId, SERVO_3_HOME_POSITION, TARGET_VELOCITY_STEPS);
	}

	bool Luke::homeDC() {
		_servo.moveJoint(_servo.servoInfo[2].servoId, 2200, TARGET_VELOCITY_STEPS);
		_servo.moveJoint(_servo.servoInfo[4].servoId, 100, TARGET_VELOCITY_STEPS);
		_dcMotor.pidEnable = false; 
		delay(50);
		digitalWrite(Pins::MOTOR_SLEEP, HIGH);     
		digitalWrite(Pins::MOTOR_DIRECTION, LOW);            
		analogWrite(Pins::MOTOR_PWM, 124);
		for(int i=0;i<10;i++)
		{		
			_dcMotor.currentValue();
			delay(1);
		}
		while (_dcMotor.currentValue() < 4) {
			delay(1);
		}
		analogWrite(Pins::MOTOR_PWM, 0);
		_dcMotor.encoder.clearCount();
		_dcMotor.targetPulses = 0;
		_dcMotor.leadScrewDisplacement = 0;
		_dcMotor.pidEnable = true;
		_dcMotor.dcUpDown(200, 20, false);
		_servo.moveJoint(_servo.servoInfo[2].servoId, SERVO_3_HOME_POSITION, TARGET_VELOCITY_STEPS);
		return true;
	}

	bool Luke::moveRobotCartesian(float requiredX, float requiredY, float requiredZ) {
		byte ids[2] = {1, 2};
		int numberOfServos = sizeof(ids) / sizeof(ids[0]);
		int positions[numberOfServos], speeds[numberOfServos], deltaAngle[numberOfServos];
		float servoTimes[numberOfServos];
		float deltaDisplacement, speedDisplacement, stepperTime, dcTime;
		float timeNeeded = 0;
		float tempTime = 0;
		int maxStepsAtFullTime1 = 0 , maxStepsAtFullTime2 = 0;
		kinematics::JointParameters jointParameter = kinematics::inverseKinematics(requiredX, requiredY, requiredZ, thetaOne, thetaTwo, displacementZ, _dcMotor.leadScrewDisplacement, _servo.servoInfo[1].currentPosition, _servo.servoInfo[1].centerPosition);
		if(!jointParameter.valid) {
			return false;
		}
		else {
			thetaOne = jointParameter.thetaOne;
			thetaTwo = jointParameter.thetaTwo;
			displacementZ = jointParameter.displacementZ;
			_zDirection = jointParameter.zDirection;
		}
		int initialPositions[2] = { _servo.servoInfo[0].currentPosition, _servo.servoInfo[1].currentPosition };
		deltaAngle[0] = ( _servo.servoInfo[0].centerPosition - thetaOne * DEGREE_TO_STS_SCALE  - initialPositions[0]);
		deltaAngle[1] = ( _servo.servoInfo[1].centerPosition - thetaTwo * DEGREE_TO_STS_SCALE - initialPositions[1]);
		deltaDisplacement = abs(displacementZ - _dcMotor.leadScrewDisplacement);
		if (abs(deltaAngle[0]) > _servo.minStepsToFullSpeed1)
			servoTimes[0] = ((float)_servo.servoOneVelocity / (100 * (float)_servo.servoOneAcceleration)) + ((abs(deltaAngle[0]) - _servo.minStepsToFullSpeed1) / (float)_servo.servoOneVelocity);
		else
			servoTimes[0] = sqrt(abs(deltaAngle[0]) / (100 * (float)_servo.servoOneAcceleration));
		if (abs(deltaAngle[1]) > _servo.minStepsToFullSpeed2)
			servoTimes[1] = ((float)TARGET_VELOCITY_STEPS / (100 * (float)TARGET_ACCELERATION)) + ((abs(deltaAngle[1]) - _servo.minStepsToFullSpeed2) / (float)TARGET_VELOCITY_STEPS);
		else
			servoTimes[1] = sqrt(abs(deltaAngle[1]) / (100 * (float)TARGET_ACCELERATION));
		dcTime = deltaDisplacement / 144.9;
		timeNeeded = dcTime;
		if (servoTimes[0] > timeNeeded)
			timeNeeded = servoTimes[0];
		if (servoTimes[1] > timeNeeded)
			timeNeeded = servoTimes[1];
		positions[0] = (int)(initialPositions[0] + deltaAngle[0] );
		positions[1] =  (int)(initialPositions[1] + deltaAngle[1] );
		tempTime = (2 * _servo.servoOneVelocity / (100 * (float)_servo.servoOneAcceleration));
		if(timeNeeded > tempTime)
			maxStepsAtFullTime1 = (int)( (_servo.servoOneVelocity * _servo.servoOneVelocity) / (100 * (float)_servo.servoOneAcceleration) + (_servo.servoOneVelocity * (timeNeeded - tempTime)) + (0.5 * 100 * (float)_servo.servoOneAcceleration * (timeNeeded - tempTime) * (timeNeeded - tempTime)));
		else
			maxStepsAtFullTime1 = (int)( ((float)timeNeeded) * ((float)timeNeeded) * (100 * (float)_servo.servoOneAcceleration));
		tempTime = (2 * TARGET_VELOCITY_STEPS / (100 * (float)TARGET_ACCELERATION));
		if(timeNeeded > tempTime)
			maxStepsAtFullTime2 = (int)( (TARGET_VELOCITY_STEPS * TARGET_VELOCITY_STEPS) / (100 * (float)TARGET_ACCELERATION) + (TARGET_VELOCITY_STEPS * (timeNeeded - tempTime)) + (0.5 * 100 * (float)TARGET_ACCELERATION * (timeNeeded - tempTime) * (timeNeeded - tempTime)));
		else
			maxStepsAtFullTime2 = (int)( ((float)timeNeeded) * ((float)timeNeeded) * (100 * (float)TARGET_ACCELERATION));
		if(abs(deltaAngle[0]) >= maxStepsAtFullTime1)
			speeds[0] = _servo.servoOneVelocity;
		else
			speeds[0] = sqrt(abs(deltaAngle[0]) * 100 * _servo.servoOneAcceleration);
		if(abs(deltaAngle[1]) >= maxStepsAtFullTime2)
			speeds[1] = TARGET_VELOCITY_STEPS;
		else
			speeds[1] = sqrt(abs(deltaAngle[1]) * 100 * TARGET_ACCELERATION);
		timeNeeded = timeNeeded * 1000;
		_dcMotor.dcUpDown(deltaDisplacement, ((dcTime * 1000)/ timeNeeded), _zDirection);
		_servo.moveJoints(2, ids, positions, speeds);
		while(isRobotMoving()) {
			delay(10);
		}
		//delay(timeNeeded + 200);
		return true;
	}

	bool Luke::moveRobotJoints(byte numberOfServos, byte id[], float angles[], float displacement) {
		int i = 0;
		int stepsAngle[MAX_NUMBER_OF_SERVOS] = {0}, speeds[MAX_NUMBER_OF_SERVOS] = {0};
		for(i=0; i<numberOfServos; i++) {
			if(id[i] == 1) {
				stepsAngle[i] = (int)(-angles[i] * DEGREE_TO_STS_SCALE + _servo.servoInfo[id[i]-1].centerPosition);
				thetaOne = angles[i];
				speeds[i] = TARGET_VELOCITY_STEPS;
			}
			else if(id[i] == 2) {
				stepsAngle[i] = (int)(-angles[i] * DEGREE_TO_STS_SCALE + _servo.servoInfo[id[i]-1].centerPosition);
				thetaTwo = angles[i];
				speeds[i] = TARGET_VELOCITY_STEPS/2;
			}
			else if(id[i] == 3 || id[i] == 5) {
				stepsAngle[i] = (int)(angles[i] * DEGREE_TO_STS_SCALE + _servo.servoInfo[id[i]-1].centerPosition);
				speeds[i] = TARGET_VELOCITY_STEPS/2;
			}
			else {
				return false;
			}
		}
		displacementZ = displacement;
		bool _zDirection = (displacementZ - _dcMotor.leadScrewDisplacement) < 0;
		kinematics::Coordinates calculatedPosition = kinematics::forwardKinematics(thetaOne, thetaTwo, _dcMotor.leadScrewDisplacement);
		_calculatedX = calculatedPosition.x;
		_calculatedY = calculatedPosition.y;
		_calculatedZ = calculatedPosition.z;
		_dcMotor.dcUpDown(abs(displacementZ - _dcMotor.leadScrewDisplacement), 0.5, _zDirection);
		displacementZ = displacement;
		requiredX = _calculatedX;
		requiredY = _calculatedY;
		requiredZ = _calculatedZ;
		_servo.moveJoints(numberOfServos, id, stepsAngle, speeds);
		while(isRobotMoving()) {
			delay(1);
		}
		return true;
	}

	void Luke::grip(int openLimit, int gripTorque)	{
	_servo.servos.writeTwoBytesRegister(_servo.servoInfo[4].servoId, STSRegisters::TORQUE_LIMIT, gripTorque);   delay(SERVO_REGISTER_DELAY_MS);
	if(openLimit == -1)	{
		openLimit = _servo.servoInfo[4].centerPosition;
		if(_isGripperOpen)	{
		_servo.moveJoint(_servo.servoInfo[4].servoId, _servo.servoInfo[4].minPosition, TARGET_VELOCITY_STEPS);		//close gripper
		_isGripperOpen = false;
		}
		else	{
		_servo.moveJoint(_servo.servoInfo[4].servoId, openLimit, TARGET_VELOCITY_STEPS);							//open gripper
		_isGripperOpen = true;
		}
	}
	else	{
		_servo.moveJoint(_servo.servoInfo[4].servoId, openLimit, TARGET_VELOCITY_STEPS);							//set to specific position
		_isGripperOpen = true;
	}
	while(isRobotMoving()) {
		delay(10);
	}
	}

	float Luke::getPosition(byte id) {
		return _servo.servos.getCurrentPosition(id);
	}

	bool Luke::isRobotMoving() {
		if(_servo.gripperType == Constants::GripperType::ONE_DOF) {
			for(int i=0; i<2; i++) {
				if(		_servo.servos.isMoving(_servo.servoInfo[0].servoId) || _servo.servos.isMoving(_servo.servoInfo[1].servoId)
					|| 	_servo.servos.isMoving(_servo.servoInfo[2].servoId) || _servo.servos.isMoving(_servo.servoInfo[4].servoId))
				return true;
				delay(10);
			}
		}
		else if (_servo.gripperType == Constants::GripperType::TWO_DOF) {
			for(int i=0; i<2 ; i++) {
				if(		_servo.servos.isMoving(_servo.servoInfo[0].servoId) || _servo.servos.isMoving(_servo.servoInfo[1].servoId) 
					|| 	_servo.servos.isMoving(_servo.servoInfo[2].servoId) || _servo.servos.isMoving(_servo.servoInfo[3].servoId) 
					|| 	_servo.servos.isMoving(_servo.servoInfo[4].servoId))
				return true;
				delay(10);
			}
		}
		float current = 0;
		for(int i=0; i<20; i++) {
			current += _dcMotor.currentValueFast();
			delay(1);
		}
		current = current / 20;
		if(current > 0.75)
			return true;
		return false;
	}

	void Luke::ledStrip(int r, int g, int b) {
		strip.fill(strip.Color(r, g, b), 0, LED_COUNT);
		strip.show();
	}

	void Luke::fanControl(bool state) {
		digitalWrite(Pins::FAN_CONTROL, state);
	}

}
 