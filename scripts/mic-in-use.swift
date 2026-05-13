#!/usr/bin/env swift
// Exit 0 if any audio input device is currently in use by any process,
// 1 otherwise. Covers Zoom, OpenWhispr, Meet, Teams, browsers — anything
// opening a mic via CoreAudio. Iterates every input-capable device so
// non-default mics (BlackHole, specific USB mics, etc.) are also caught.
import CoreAudio
import Foundation

let SYS = AudioObjectID(kAudioObjectSystemObject)

func devices() -> [AudioDeviceID] {
  var addr = AudioObjectPropertyAddress(
    mSelector: kAudioHardwarePropertyDevices,
    mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(SYS, &addr, 0, nil, &size) == noErr else { return [] }
  let count = Int(size) / MemoryLayout<AudioDeviceID>.size
  var ids = [AudioDeviceID](repeating: 0, count: count)
  guard AudioObjectGetPropertyData(SYS, &addr, 0, nil, &size, &ids) == noErr else { return [] }
  return ids
}

func hasInputStreams(_ device: AudioDeviceID) -> Bool {
  var addr = AudioObjectPropertyAddress(
    mSelector: kAudioDevicePropertyStreams,
    mScope: kAudioDevicePropertyScopeInput,
    mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(device, &addr, 0, nil, &size) == noErr else { return false }
  return size > 0
}

func isRunningSomewhere(_ device: AudioDeviceID) -> Bool {
  var running: UInt32 = 0
  var size = UInt32(MemoryLayout<UInt32>.size)
  var addr = AudioObjectPropertyAddress(
    mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
    mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain)
  let status = AudioObjectGetPropertyData(device, &addr, 0, nil, &size, &running)
  return status == noErr && running != 0
}

for device in devices() where hasInputStreams(device) {
  if isRunningSomewhere(device) { exit(0) }
}
exit(1)
