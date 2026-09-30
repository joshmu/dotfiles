// Records Slack message links copied to the clipboard so raygent can still find
// one after something else (e.g. dictation) replaces it. Nothing else is stored.
//
// macOS has no clipboard-change event, so this polls NSPasteboard.changeCount
// (an in-process integer read) and only reads the contents when it changes.
// Output: $RAYGENT_STATE_DIR/slack-clips.json (default ~/.local/state/raygent),
// the last few links with their change count and time, pruned on every write.
import AppKit
import Foundation

let pollInterval = 0.5
let maxClips = 5
let maxAgeMs = 10.0 * 60 * 1000

let stateDir = ProcessInfo.processInfo.environment["RAYGENT_STATE_DIR"]
  ?? NSString(string: "~/.local/state/raygent").expandingTildeInPath
let outPath = (stateDir as NSString).appendingPathComponent("slack-clips.json")

// Whole-clipboard Slack conversation links only; raygent re-parses the details.
let slackLink = try! NSRegularExpression(
  pattern: #"^(https://[a-z0-9-]+\.(enterprise\.)?slack\.com/archives/[CDG][A-Z0-9]+\S*|https://app\.slack\.com/client/T[A-Z0-9]+/[CDG][A-Z0-9]+\S*|slack://channel\?\S+)$"#,
  options: [.caseInsensitive])

struct Clip: Codable {
  let url: String
  let changeCount: Int
  let at: Double  // epoch ms
}

func nowMs() -> Double { Date().timeIntervalSince1970 * 1000 }

func readClips() -> [Clip] {
  guard let data = FileManager.default.contents(atPath: outPath),
    let clips = try? JSONDecoder().decode([Clip].self, from: data)
  else { return [] }
  return clips
}

func record(_ clip: Clip) {
  let fresh = readClips().filter { nowMs() - $0.at < maxAgeMs && $0.url != clip.url }
  let clips = Array((fresh + [clip]).suffix(maxClips))
  do {
    try FileManager.default.createDirectory(atPath: stateDir, withIntermediateDirectories: true)
    let data = try JSONEncoder().encode(clips)
    try data.write(to: URL(fileURLWithPath: outPath), options: .atomic)
  } catch {
    FileHandle.standardError.write("clip-watch: write failed: \(error)\n".data(using: .utf8)!)
  }
}

let pasteboard = NSPasteboard.general
var lastCount = pasteboard.changeCount
print("clip-watch: started, writing \(outPath)")
fflush(stdout)

while true {
  Thread.sleep(forTimeInterval: pollInterval)
  let count = pasteboard.changeCount
  if count == lastCount { continue }
  lastCount = count
  guard let text = pasteboard.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines),
    text.count < 2000,
    slackLink.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
  else { continue }
  record(Clip(url: text, changeCount: count, at: nowMs()))
}
