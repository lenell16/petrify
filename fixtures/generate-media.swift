// Rebuild the short local video from NASA source photographs: swift fixtures/generate-media.swift
import AppKit
import AVFoundation
import CoreVideo

let directory = URL(fileURLWithPath: "fixtures/assets", isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
let width = 640
let height = 960

func frame(_ index: Int, sources: [NSImage]) -> NSImage {
    let image = NSImage(size: NSSize(width: width, height: height))
    image.lockFocus()
    let source = sources[index / 36]
    let zoom = CGFloat(index % 36) / 35
    let w = CGFloat(width) * (1.6 + zoom * 0.2)
    let h = CGFloat(height) * (1.0 + zoom * 0.12)
    source.draw(in: NSRect(x: (CGFloat(width) - w) / 2, y: (CGFloat(height) - h) / 2, width: w, height: h),
                from: .zero, operation: .copy, fraction: 1)
    image.unlockFocus()
    return image
}

func bitmap(_ image: NSImage) -> NSBitmapImageRep {
    NSBitmapImageRep(data: image.tiffRepresentation!)!
}

func writeVideo(_ name: String, _ files: [String]) throws {
    let sources = files.map { NSImage(contentsOf: directory.appendingPathComponent($0))! }
    let output = directory.appendingPathComponent(name)
    try? FileManager.default.removeItem(at: output)
    let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
    ])
    input.expectsMediaDataInRealTime = false
    let attributes: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
    ]
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
    writer.add(input)
    writer.startWriting()
    writer.startSession(atSourceTime: .zero)
    for index in 0..<108 {
        while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.01) }
        var buffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
        let pixels = buffer!
        CVPixelBufferLockBaseAddress(pixels, [])
        let context = CGContext(data: CVPixelBufferGetBaseAddress(pixels), width: width, height: height,
                                bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixels),
                                space: CGColorSpaceCreateDeviceRGB(),
                                bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
        let image = bitmap(frame(index, sources: sources)).cgImage!
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        CVPixelBufferUnlockBaseAddress(pixels, [])
        guard adaptor.append(pixels, withPresentationTime: CMTime(value: Int64(index), timescale: 12)) else {
            fatalError("Video frame failed: \(String(describing: writer.error))")
        }
    }
    input.markAsFinished()
    let done = DispatchSemaphore(value: 0)
    writer.finishWriting { done.signal() }
    done.wait()
    guard writer.status == .completed else { fatalError("Video failed: \(String(describing: writer.error))") }
}

try writeVideo("motion.mp4", ["S39-23-020.jpg", "S39-23-036.jpg", "iss072e083078.jpg"])
try writeVideo("earth.mp4", ["iss045e013851.jpg", "0300804.jpg", "iss072e083078.jpg"])
