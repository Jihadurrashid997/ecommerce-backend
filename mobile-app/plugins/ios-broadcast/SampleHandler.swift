import CoreImage
import ReplayKit
import UIKit
import Darwin

private let socketName = "rtc_SSFD"

final class SampleHandler: RPBroadcastSampleHandler {
    private let writeLock = NSLock()
    private let imageContext = CIContext()
    private var connection: Int32 = -1
    private var lastFrameTime = CFAbsoluteTimeGetCurrent()

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        guard
            let appGroupIdentifier = Bundle.main.object(
                forInfoDictionaryKey: "RTCAppGroupIdentifier"
            ) as? String
        else {
            finishBroadcastWithError(
                NSError(
                    domain: "JRMessengerScreenShare",
                    code: 1,
                    userInfo: [
                        NSLocalizedDescriptionKey:
                            "The screen-share app group is not configured."
                    ]
                )
            )
            return
        }

        guard
            let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroupIdentifier
            )
        else {
            finishBroadcastWithError(
                NSError(
                    domain: "JRMessengerScreenShare",
                    code: 1,
                    userInfo: [
                        NSLocalizedDescriptionKey:
                            "The screen-share app group is not configured."
                    ]
                )
            )
            return
        }

        connect(to: container.appendingPathComponent(socketName).path)
    }

    override func broadcastFinished() {
        closeConnection()
    }

    override func processSampleBuffer(
        _ sampleBuffer: CMSampleBuffer,
        with sampleBufferType: RPSampleBufferType
    ) {
        guard
            sampleBufferType == .video,
            connection >= 0,
            let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
        else {
            return
        }

        let now = CFAbsoluteTimeGetCurrent()
        guard now - lastFrameTime >= 1.0 / 15.0 else {
            return
        }
        lastFrameTime = now

        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let image = imageContext.jpegRepresentation(
            of: CIImage(cvPixelBuffer: pixelBuffer),
            colorSpace: colorSpace,
            options: [.lossyCompressionQuality: 0.65]
        ) else {
            return
        }

        let orientation =
            (CMGetAttachment(
                sampleBuffer,
                key: RPVideoSampleOrientationKey as CFString,
                attachmentModeOut: nil
            ) as? NSNumber)?.intValue ?? 1
        let header = Data(
            """
            HTTP/1.1 200 OK\r
            Content-Length: \(image.count)\r
            Buffer-Width: \(width)\r
            Buffer-Height: \(height)\r
            Buffer-Orientation: \(orientation)\r
            \r
            """.utf8
        )

        writeLock.lock()
        defer { writeLock.unlock() }
        guard connection >= 0 else {
            return
        }
        guard writeAll(header), writeAll(image) else {
            closeConnectionLocked()
            return
        }
    }

    private func connect(to path: String) {
        let descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else {
            return
        }

        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        let pathBytes = Array(path.utf8CString)
        let pathCapacity = MemoryLayout.size(ofValue: address.sun_path)
        guard pathBytes.count <= pathCapacity else {
            Darwin.close(descriptor)
            return
        }

        withUnsafeMutablePointer(to: &address.sun_path) { pathPointer in
            pathPointer.withMemoryRebound(
                to: CChar.self,
                capacity: pathCapacity
            ) { destination in
                for index in pathBytes.indices {
                    destination[index] = pathBytes[index]
                }
            }
        }

        let result = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(
                    descriptor,
                    $0,
                    socklen_t(MemoryLayout<sockaddr_un>.size)
                )
            }
        }
        guard result == 0 else {
            Darwin.close(descriptor)
            finishBroadcastWithError(
                NSError(
                    domain: "JRMessengerScreenShare",
                    code: 2,
                    userInfo: [
                        NSLocalizedDescriptionKey:
                            "Could not connect the screen share to the call."
                    ]
                )
            )
            return
        }
        connection = descriptor
    }

    private func writeAll(_ data: Data) -> Bool {
        data.withUnsafeBytes { bytes in
            guard let baseAddress = bytes.baseAddress else {
                return false
            }
            var offset = 0
            while offset < bytes.count {
                let written = Darwin.write(
                    connection,
                    baseAddress.advanced(by: offset),
                    bytes.count - offset
                )
                if written <= 0 {
                    return false
                }
                offset += written
            }
            return true
        }
    }

    private func closeConnection() {
        writeLock.lock()
        defer { writeLock.unlock() }
        closeConnectionLocked()
    }

    private func closeConnectionLocked() {
        guard connection >= 0 else {
            return
        }
        Darwin.close(connection)
        connection = -1
    }
}
