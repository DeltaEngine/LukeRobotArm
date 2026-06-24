#include "constants.h"
#include "kinematics.h"

namespace lukeRobot {
  namespace kinematics {
    using namespace Constants;

    Coordinates forwardKinematics( float armOneDegree, float armTwoDegree, float leadScrewDisplacement) {
      Coordinates calculated;
      calculated.x = (ARM_ONE_LENGTH - ((LEAD_SCREW_DISTANCE + leadScrewDisplacement) * sin(20 * PI / 180))) * cos(radians(armOneDegree)) + ARM_TWO_LENGTH * cos(radians(armOneDegree + armTwoDegree));
      calculated.y = (ARM_ONE_LENGTH - ((LEAD_SCREW_DISTANCE + leadScrewDisplacement) * sin(20 * PI / 180))) * sin(radians(armOneDegree)) + ARM_TWO_LENGTH * sin(radians(armOneDegree + armTwoDegree));
      calculated.z = BASE_HEIGHT + (LEAD_SCREW_DISTANCE + leadScrewDisplacement) * cos(20 * PI / 180) - GRIPPER_HEIGHT; 
      return calculated;
    }

    JointParameters inverseKinematics (float requiredX, float requiredY, float requiredZ, 
                            float thetaOne, float thetaTwo, float displacementZ, 
                            float leadScrewDisplacement, float currentPositionTwo, float centerPositionTwo) {
      JointParameters jointParameter;
      float tempThetaOne = thetaOne, tempThetaTwo = thetaTwo, tempDisplacementZ = displacementZ;
      float c2, s2, thetaTwoa, thetaTwob, currentThetaTwo;
      displacementZ = ((requiredZ - BASE_HEIGHT + GRIPPER_HEIGHT) / cos(20 * PI / 180)) - LEAD_SCREW_DISTANCE;
      c2 = (sq(requiredX) + sq(requiredY) - sq(ARM_ONE_LENGTH - ((LEAD_SCREW_DISTANCE + displacementZ) * sin(20 * PI / 180))) - sq(ARM_TWO_LENGTH)) / (2.0f * (ARM_ONE_LENGTH - ((LEAD_SCREW_DISTANCE + displacementZ) * sin(20 * PI / 180))) * ARM_TWO_LENGTH);
      c2 = constrain(c2, -1.0f, 1.0f);
      s2 = sqrt(1.0f - c2*c2); 
      thetaTwoa = degrees(atan2(s2, c2));
      thetaTwob = degrees(atan2(-s2, c2));
      currentThetaTwo = -(currentPositionTwo - centerPositionTwo ) / DEGREE_TO_STS_SCALE ;
      if(abs(thetaTwoa-currentThetaTwo) < abs(thetaTwob-currentThetaTwo))		
        thetaTwo = thetaTwoa;
      else
        thetaTwo = thetaTwob;
      thetaOne = degrees(atan2(requiredY, requiredX) - atan2( ARM_TWO_LENGTH * sin(radians(thetaTwo)), (ARM_ONE_LENGTH - ((LEAD_SCREW_DISTANCE + displacementZ) * sin(20 * PI / 180))) + ARM_TWO_LENGTH * cos(radians(thetaTwo)) ));
      if (isnan(thetaOne) || isnan(thetaTwo) || displacementZ>MOVABLE_Z_DISTANCE || displacementZ<0) {
        jointParameter.thetaOne = tempThetaOne;
        jointParameter.thetaTwo = tempThetaTwo;
        jointParameter.displacementZ = tempDisplacementZ;
        jointParameter.valid = false;
        return jointParameter;
      }
      if (requiredZ > currentZ(leadScrewDisplacement))
        jointParameter.zDirection = false;
      else
        jointParameter.zDirection = true;
      jointParameter.thetaOne = thetaOne;
      jointParameter.thetaTwo = thetaTwo;
      jointParameter.displacementZ = displacementZ;
      jointParameter.valid = true;
      return jointParameter;
    }

    float currentZ(float leadScrewDisplacement) {
      return BASE_HEIGHT + (LEAD_SCREW_DISTANCE + leadScrewDisplacement) * cos(20 * PI / 180) - GRIPPER_HEIGHT;
    }
  }
}


