# LukeRobotArm
Luke is a low cost robot arm for your home, garage, kitchen or workbench to help you out doing simple tasks. It runs on a simple ESP32-S3 chip that is built in and you can control the robot with your phone or laptop using voice, camera, gamepad, controls or AI via the web app. You can also go to one of the programming examples (Python/C++/JS/C#/..) as a starting point to customize Luke to your needs.

The industry had struggled to get low cost automation since the introduction of robotics. Luke helps in solving the problem of automation at an affordable price. Whether you are a hobbyist, a tech enthusiast or a professional, Luke is the solution. It provides you with ready made examples, high level control and even if you are from the geeks, you could go to the low level control.

Find out more at [LukeRobotArm.com](https://lukerobotarm.com) and get yours today!

* [Getting started](#getting-started)
* [Server](#server)
* [Wiki](https://github.com/DeltaEngine/LukeRobotArm/wiki)
* [About the Robot](https://github.com/DeltaEngine/LukeRobotArm/wiki/About-the-Robot)
* [Assembling the robot](https://github.com/DeltaEngine/LukeRobotArm/wiki/Assembly)
* [First setup](https://github.com/DeltaEngine/LukeRobotArm/wiki/First-setup)
* [Setting up the camera](https://github.com/DeltaEngine/LukeRobotArm/wiki/Setting-up-the-camera)
* [Control modes](https://github.com/DeltaEngine/LukeRobotArm/wiki/Control-modes)
* [Function description](https://github.com/DeltaEngine/LukeRobotArm/wiki/Function-description)

---

## Getting started
Luke belongs to the scara robot family and has the standard configuration of RPRR. However it can be configured to the RPRRR configuration by replacxing the 1 degree of freedom hand with the 2 degrees of freedom hand adding twist and enabling it to rotate about it's gripping access.  
If you just want to use your Luke Robot Arm, you don't have to download anything, just go to [LukeRobotArm.com](https://lukerobotarm.com) and follow the instructions.

1. Connect to the Luke-<id> wifi the Sign in page should open automatically or open http://192.168.4.1 in your browser, there you can enter your local wifi credentials so the robot can talk to your phone.
2. After you setup the wiki, your phone should go back to your own wifi and you can use https://LukeRobotArm.com to connect to Luke-<id>
3. Once connected you can control the robot with your phone or laptop using voice, camera, a gamepad connected to Luke or your phone or PC, virtual controls or AI.
4. For the first run, make sure the area surrounding the robot is clear. The calibration process will start automatically, each joint will move into its extremes.
5. Once the robot has been calibrated, on each power cycle, the robot arm will go all the way down to recalibrate its 0. Kindly make sure there is nothing under the arm.

## Server
Luke Robot Arm Server ESP32 Arduino Project. This is the heart of the robot arm, it is the server that controls the robot arm and communicates with the phone app. It is pretty dumb, low power and can stay on all the time. It just follows the instructions you give it, all the fancy stuff happens on the [LukeRobotArm.com](https://lukerobotarm.com) app, usually launched from a phone (Android or iOS), but can be also used from your laptop or PC (Windows, Mac, Linux) to control Luke.
