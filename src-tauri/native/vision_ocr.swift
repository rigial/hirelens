import Foundation
import PDFKit
import Vision
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct PageResult: Codable {
    let pageNumber: Int
    let text: String
    let confidence: Float
}

struct OcrOutput: Codable {
    let totalPages: Int
    let pages: [PageResult]
    let fullText: String
}

func renderPDFPage(page: PDFPage, scale: CGFloat = 2.0) -> CGImage? {
    let rect = page.bounds(for: .mediaBox)
    let width = Int(rect.width * scale)
    let height = Int(rect.height * scale)
    guard width > 0 && height > 0 else { return nil }
    
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    
    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: bitmapInfo
    ) else { return nil }
    
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    
    return context.makeImage()
}

func recognizeText(in image: CGImage) -> (text: String, avgConfidence: Float) {
    let requestHandler = VNImageRequestHandler(cgImage: image, options: [:])
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    
    do {
        try requestHandler.perform([request])
        guard let observations = request.results, !observations.isEmpty else {
            return ("", 0.0)
        }
        
        var totalConfidence: Float = 0.0
        var count = 0
        var lines: [String] = []
        
        for observation in observations {
            if let candidate = observation.topCandidates(1).first {
                lines.append(candidate.string)
                totalConfidence += candidate.confidence
                count += 1
            }
        }
        
        let avgConf = count > 0 ? (totalConfidence / Float(count)) : 0.0
        return (lines.joined(separator: "\n"), avgConf)
    } catch {
        return ("", 0.0)
    }
}

func processPDF(path: String) -> OcrOutput? {
    let url = URL(fileURLWithPath: path)
    guard let doc = PDFDocument(url: url) else { return nil }
    
    var pageResults: [PageResult] = []
    var allText: [String] = []
    
    for i in 0..<doc.pageCount {
        guard let page = doc.page(at: i) else { continue }
        if let cgImage = renderPDFPage(page: page) {
            let (text, conf) = recognizeText(in: cgImage)
            pageResults.append(PageResult(pageNumber: i + 1, text: text, confidence: conf))
            if !text.isEmpty {
                allText.append(text)
            }
        }
    }
    
    return OcrOutput(
        totalPages: doc.pageCount,
        pages: pageResults,
        fullText: allText.joined(separator: "\n\n")
    )
}

func processImage(path: String) -> OcrOutput? {
    let url = URL(fileURLWithPath: path)
    guard let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        return nil
    }
    
    let (text, conf) = recognizeText(in: cgImage)
    let pageResult = PageResult(pageNumber: 1, text: text, confidence: conf)
    return OcrOutput(
        totalPages: 1,
        pages: [pageResult],
        fullText: text
    )
}

func processStdinImage() -> OcrOutput? {
    let data = FileHandle.standardInput.readDataToEndOfFile()
    guard !data.isEmpty,
          let imageSource = CGImageSourceCreateWithData(data as CFData, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        return nil
    }
    
    let (text, conf) = recognizeText(in: cgImage)
    let pageResult = PageResult(pageNumber: 1, text: text, confidence: conf)
    return OcrOutput(
        totalPages: 1,
        pages: [pageResult],
        fullText: text
    )
}

func main() {
    let args = CommandLine.arguments
    if args.count < 2 {
        fputs("Usage: vision_ocr [--pdf <path> | --image <path> | --stdin-image | --render-pdf <path> <page_num> <out_png>]\n", stderr)
        exit(1)
    }
    
    let mode = args[1]
    var output: OcrOutput?
    
    if mode == "--pdf" && args.count >= 3 {
        output = processPDF(path: args[2])
    } else if mode == "--image" && args.count >= 3 {
        output = processImage(path: args[2])
    } else if mode == "--stdin-image" {
        output = processStdinImage()
    } else if mode == "--render-pdf" && args.count >= 5 {
        let pdfPath = args[2]
        guard let pageNum = Int(args[3]),
              let doc = PDFDocument(url: URL(fileURLWithPath: pdfPath)),
              let page = doc.page(at: pageNum - 1),
              let cgImage = renderPDFPage(page: page) else {
            fputs("Failed to render PDF page\n", stderr)
            exit(2)
        }
        let outUrl = URL(fileURLWithPath: args[4])
        guard let destination = CGImageDestinationCreateWithURL(outUrl as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            fputs("Failed to create image destination\n", stderr)
            exit(3)
        }
        CGImageDestinationAddImage(destination, cgImage, nil)
        if CGImageDestinationFinalize(destination) {
            print("OK")
            exit(0)
        } else {
            fputs("Failed to finalize image\n", stderr)
            exit(4)
        }
    } else {
        fputs("Invalid arguments\n", stderr)
        exit(1)
    }
    
    guard let res = output else {
        fputs("OCR processing failed\n", stderr)
        exit(2)
    }
    
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted
    if let jsonData = try? encoder.encode(res),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    } else {
        print(res.fullText)
    }
}

main()
