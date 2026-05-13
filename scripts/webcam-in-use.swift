#!/usr/bin/env swift
// Exit 0 if any camera device is currently in use by any process, 1
// otherwise. Covers FaceTime cam, external webcams, Continuity Camera,
// virtual cams. Iterates every CMIO device and checks the canonical
// kCMIODevicePropertyDeviceIsRunningSomewhere flag.
import CoreMediaIO
import Foundation

let SYS = CMIOObjectID(kCMIOObjectSystemObject)

// CMIOObjectGetPropertyData takes dataSize by value + a separate `used`
// out-param — unlike the CoreAudio equivalent which uses one inout size.
// Don't "harmonise" the two Swift detectors; the signatures differ.
func devices() -> [CMIOObjectID] {
  var addr = CMIOObjectPropertyAddress(
    mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyDevices),
    mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
    mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
  var size: UInt32 = 0
  guard CMIOObjectGetPropertyDataSize(SYS, &addr, 0, nil, &size) == noErr else { return [] }
  let count = Int(size) / MemoryLayout<CMIOObjectID>.size
  var ids = [CMIOObjectID](repeating: 0, count: count)
  var used: UInt32 = 0
  guard CMIOObjectGetPropertyData(SYS, &addr, 0, nil, size, &used, &ids) == noErr else { return [] }
  return ids
}

func isRunningSomewhere(_ device: CMIOObjectID) -> Bool {
  var running: UInt32 = 0
  let size = UInt32(MemoryLayout<UInt32>.size)
  var used: UInt32 = 0
  var addr = CMIOObjectPropertyAddress(
    mSelector: CMIOObjectPropertySelector(kCMIODevicePropertyDeviceIsRunningSomewhere),
    mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
    mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
  let status = CMIOObjectGetPropertyData(device, &addr, 0, nil, size, &used, &running)
  return status == noErr && running != 0
}

for device in devices() where isRunningSomewhere(device) { exit(0) }
exit(1)
