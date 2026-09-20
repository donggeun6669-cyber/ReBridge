// macOS Vision 로컬 OCR (무료·오프라인). 사용: ocr_vision <pdf> <page_index...>
// 각 쪽을 300dpi 로 그려 한국어·영어로 인식하고, 줄마다 "y\tx\t글자" 를 출력한다(위→아래 정렬은 파이썬에서).
import Foundation
import PDFKit
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
    FileHandle.standardError.write("usage: ocr_vision <pdf> <page_index...>\n".data(using: .utf8)!)
    exit(2)
}
for s in args[2...] {
    guard let idx = Int(s), let page = doc.page(at: idx) else { continue }
    let box = page.bounds(for: .mediaBox)
    let scale: CGFloat = 300.0 / 72.0
    let w = Int(box.width * scale), h = Int(box.height * scale)
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
    ctx.setFillColor(NSColor.white.cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)
    guard let img = ctx.makeImage() else { continue }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["ko-KR", "en-US"]
    req.usesLanguageCorrection = false
    let handler = VNImageRequestHandler(cgImage: img, options: [:])
    try? handler.perform([req])
    print("=====PAGE \(idx)")
    for o in (req.results ?? []) {
        guard let top = o.topCandidates(1).first else { continue }
        let b = o.boundingBox
        print(String(format: "%.4f\t%.4f\t%.3f\t", 1 - b.maxY, b.minX, top.confidence) + top.string)
    }
}
