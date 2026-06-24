#pragma once

namespace lukeRobot {
  namespace kinematics {
    struct Coordinates {
      float x;
      float y;
      float z;
    };

    struct JointParameters {
      float thetaOne;
      float thetaTwo;
      float displacementZ;
      bool zDirection;
      bool valid;
    };

    Coordinates forwardKinematics( float armOneDegree, float armTwoDegree, float leadScrewDisplacement);
    JointParameters inverseKinematics (float requiredX, float requiredY, float requiredZ, 
                            float thetaOne, float thetaTwo, float displacementZ, 
                            float leadScrewDisplacement, float currentPositionTwo, float centerPositionTwo);
    float currentZ(float leadScrewDisplacement);
  }
}