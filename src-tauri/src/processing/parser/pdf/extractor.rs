use std::path::Path;
use std::time::Instant;
use lopdf::Document;

use crate::ocr::provider::OcrProvider;
use super::analyzer::is_text_usable;
use super::models::{ExtractionMethod, ExtractionSource, PageExtraction, ResumeExtraction};
use super::normalizer::combine_and_normalize_pages;
use super::renderer::{render_or_extract_page_image, DEFAULT_RENDER_DPI};

/// Extracts text from a PDF file using hybrid page-level text extraction and automatic OCR fallback.
///
/// # Arguments
/// * `path` - The path to the PDF file on disk.
/// * `ocr_provider` - The OCR provider to use when pages lack a usable text layer.
///
/// # Returns
/// * `Result<ResumeExtraction, String>` - The complete extraction details including metadata and normalized text.
pub async fn extract_pdf_pages_hybrid<P: AsRef<Path>>(
    path: P,
    ocr_provider: &dyn OcrProvider,
) -> Result<ResumeExtraction, String> {
    let pdf_path = path.as_ref();
    let total_start = Instant::now();

    let doc_res = Document::load(pdf_path);
    let doc = match doc_res {
        Ok(d) => d,
        Err(e) => {
            #[cfg(target_os = "macos")]
            {
                let vision = crate::ocr::apple_vision::AppleVisionProvider::new();
                if vision.is_available() {
                    if let Ok(vision_out) = vision.extract_from_pdf(pdf_path).await {
                        if !vision_out.full_text.trim().is_empty() {
                            let total_pages = vision_out.total_pages as usize;
                            let pages: Vec<PageExtraction> = vision_out.pages.into_iter().map(|p| PageExtraction {
                                page_number: p.page_number as usize,
                                source: ExtractionSource::Ocr,
                                text: p.text,
                                duration_ms: 0,
                            }).collect();
                            let ocr_pages_count = pages.len();
                            let full_text = combine_and_normalize_pages(&pages);
                            let total_duration_ms = total_start.elapsed().as_millis() as u64;
                            return Ok(ResumeExtraction {
                                pages,
                                method: ExtractionMethod::Ocr,
                                total_pages,
                                text_pages: 0,
                                ocr_pages: ocr_pages_count,
                                full_text,
                                total_duration_ms,
                            });
                        }
                    }
                }
            }
            return Err(format!("Failed to load PDF: {}", e));
        }
    };

    let mut page_nums: Vec<u32> = doc.get_pages().keys().copied().collect();
    page_nums.sort_unstable();

    let total_pages = page_nums.len();
    if total_pages == 0 {
        return Err("PDF contains no pages".to_string());
    }

    let mut page_extractions: Vec<PageExtraction> = Vec::with_capacity(total_pages);
    let mut text_pages_count = 0;
    let mut ocr_pages_count = 0;

    let dpi = std::env::var("OCR_DPI")
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(DEFAULT_RENDER_DPI);

    for &page_num in &page_nums {
        let page_start = Instant::now();
        let mut extracted_native_text = String::new();

        if let Ok(text) = doc.extract_text(&[page_num]) {
            extracted_native_text = text;
        }

        // Check if the extracted native text meets usability thresholds
        if is_text_usable(&extracted_native_text) {
            let duration_ms = page_start.elapsed().as_millis() as u64;
            page_extractions.push(PageExtraction {
                page_number: page_num as usize,
                source: ExtractionSource::PdfText,
                text: extracted_native_text,
                duration_ms,
            });
            text_pages_count += 1;
            continue;
        }

        // Native text is missing or unusable: trigger OCR fallback for this page
        let page_image_res = render_or_extract_page_image(&doc, Some(pdf_path), page_num, dpi);
        match page_image_res {
            Ok(image_bytes) => {
                match ocr_provider.extract_text(&image_bytes).await {
                    Ok(ocr_text) => {
                        let duration_ms = page_start.elapsed().as_millis() as u64;
                        page_extractions.push(PageExtraction {
                            page_number: page_num as usize,
                            source: ExtractionSource::Ocr,
                            text: ocr_text,
                            duration_ms,
                        });
                        ocr_pages_count += 1;
                    }
                    Err(err) => {
                        // AC-4: Log error by page number, do not fail entire document if other text exists
                        eprintln!("[OCR Warning] OCR failed for page {}: {}", page_num, err);

                        let duration_ms = page_start.elapsed().as_millis() as u64;
                        if !extracted_native_text.trim().is_empty() {
                            page_extractions.push(PageExtraction {
                                page_number: page_num as usize,
                                source: ExtractionSource::PdfText,
                                text: extracted_native_text,
                                duration_ms,
                            });
                        }
                    }
                }
            }
            Err(render_err) => {
                eprintln!("[Render Warning] Failed to render page {}: {}", page_num, render_err);
                let duration_ms = page_start.elapsed().as_millis() as u64;
                if !extracted_native_text.trim().is_empty() {
                    page_extractions.push(PageExtraction {
                        page_number: page_num as usize,
                        source: ExtractionSource::PdfText,
                        text: extracted_native_text,
                        duration_ms,
                    });
                }
            }
        }
    }

    if page_extractions.is_empty() {
        #[cfg(target_os = "macos")]
        {
            let vision = crate::ocr::apple_vision::AppleVisionProvider::new();
            if vision.is_available() {
                if let Ok(vision_out) = vision.extract_from_pdf(pdf_path).await {
                    if !vision_out.full_text.trim().is_empty() {
                        let total_pages = vision_out.total_pages as usize;
                        let pages: Vec<PageExtraction> = vision_out.pages.into_iter().map(|p| PageExtraction {
                            page_number: p.page_number as usize,
                            source: ExtractionSource::Ocr,
                            text: p.text,
                            duration_ms: 0,
                        }).collect();
                        let ocr_pages_count = pages.len();
                        let full_text = combine_and_normalize_pages(&pages);
                        let total_duration_ms = total_start.elapsed().as_millis() as u64;
                        return Ok(ResumeExtraction {
                            pages,
                            method: ExtractionMethod::Ocr,
                            total_pages,
                            text_pages: 0,
                            ocr_pages: ocr_pages_count,
                            full_text,
                            total_duration_ms,
                        });
                    }
                }
            }
        }
        return Err("PDF appears to be scanned or contains no extractable text layer.".to_string());
    }

    let method = match (text_pages_count > 0, ocr_pages_count > 0) {
        (true, false) => ExtractionMethod::Text,
        (false, true) => ExtractionMethod::Ocr,
        (true, true) => ExtractionMethod::Hybrid,
        (false, false) => ExtractionMethod::Text,
    };

    let full_text = combine_and_normalize_pages(&page_extractions);
    if full_text.trim().is_empty() {
        #[cfg(target_os = "macos")]
        {
            let vision = crate::ocr::apple_vision::AppleVisionProvider::new();
            if vision.is_available() {
                if let Ok(vision_out) = vision.extract_from_pdf(pdf_path).await {
                    if !vision_out.full_text.trim().is_empty() {
                        let total_pages = vision_out.total_pages as usize;
                        let pages: Vec<PageExtraction> = vision_out.pages.into_iter().map(|p| PageExtraction {
                            page_number: p.page_number as usize,
                            source: ExtractionSource::Ocr,
                            text: p.text,
                            duration_ms: 0,
                        }).collect();
                        let ocr_pages_count = pages.len();
                        let full_text = combine_and_normalize_pages(&pages);
                        let total_duration_ms = total_start.elapsed().as_millis() as u64;
                        return Ok(ResumeExtraction {
                            pages,
                            method: ExtractionMethod::Ocr,
                            total_pages,
                            text_pages: 0,
                            ocr_pages: ocr_pages_count,
                            full_text,
                            total_duration_ms,
                        });
                    }
                }
            }
        }
        return Err("PDF appears to be scanned or contains no extractable text layer.".to_string());
    }

    let total_duration_ms = total_start.elapsed().as_millis() as u64;

    Ok(ResumeExtraction {
        pages: page_extractions,
        method,
        total_pages,
        text_pages: text_pages_count,
        ocr_pages: ocr_pages_count,
        full_text,
        total_duration_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ocr::mock::MockOcrProvider;
    use crate::ocr::provider::OcrError;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Object, Stream};
    use uuid::Uuid;

    fn create_synthetic_pdf(pages_data: &[Option<&str>]) -> (tempfile_guard::TestTempFile, Vec<u8>) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });

        let mut page_ids = Vec::new();

        for maybe_text in pages_data {
            let mut resources = dictionary! {
                "Font" => dictionary! {
                    "F1" => font_id,
                },
            };

            let mut contents_id = None;

            if let Some(text) = maybe_text {
                let content = Content {
                    operations: vec![
                        Operation::new("BT", vec![]),
                        Operation::new("Tf", vec!["F1".into(), 12.into()]),
                        Operation::new("Td", vec![50.into(), 700.into()]),
                        Operation::new("Tj", vec![Object::string_literal(*text)]),
                        Operation::new("ET", vec![]),
                    ],
                };
                let content_stream = Stream::new(dictionary! {}, content.encode().unwrap());
                contents_id = Some(doc.add_object(content_stream));
            } else {
                // Image-only page: add an embedded raster Image XObject
                let img_stream = Stream::new(
                    dictionary! {
                        "Type" => Object::Name(b"XObject".to_vec()),
                        "Subtype" => Object::Name(b"Image".to_vec()),
                        "Width" => 10,
                        "Height" => 10,
                        "ColorSpace" => Object::Name(b"DeviceRGB".to_vec()),
                        "BitsPerComponent" => 8,
                    },
                    vec![200u8; 300], // 10x10 RGB
                );
                let img_id = doc.add_object(img_stream);
                resources.set("XObject", dictionary! { "Im1" => Object::Reference(img_id) });
            }

            let mut page_dict = dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Resources" => resources,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            };

            if let Some(cid) = contents_id {
                page_dict.set("Contents", cid);
            }

            let page_id = doc.add_object(page_dict);
            page_ids.push(page_id.into());
        }

        let count = page_ids.len() as i64;
        let pages_dict = dictionary! {
            "Type" => "Pages",
            "Kids" => page_ids,
            "Count" => count,
        };
        doc.set_object(pages_id, pages_dict);

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);

        let mut pdf_bytes = Vec::new();
        doc.save_to(&mut pdf_bytes).unwrap();

        let temp_path = std::env::temp_dir().join(format!("test_pdf_{}.pdf", Uuid::new_v4()));
        std::fs::write(&temp_path, &pdf_bytes).unwrap();

        (tempfile_guard::TestTempFile(temp_path), pdf_bytes)
    }

    mod tempfile_guard {
        use std::path::PathBuf;

        pub struct TestTempFile(pub PathBuf);

        impl Drop for TestTempFile {
            fn drop(&mut self) {
                if self.0.exists() {
                    let _ = std::fs::remove_file(&self.0);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_ac1_normal_text_pdf() {
        let text_p1 = "Alice Smith Senior Software Engineer San Francisco CA Summary Experienced engineer with 10 years experience in Rust Go and distributed systems.";
        let (file, _) = create_synthetic_pdf(&[Some(text_p1)]);

        let mock_ocr = MockOcrProvider::new();
        let extraction = extract_pdf_pages_hybrid(&file.0, &mock_ocr).await.unwrap();

        assert_eq!(extraction.method, ExtractionMethod::Text);
        assert_eq!(extraction.text_pages, 1);
        assert_eq!(extraction.ocr_pages, 0);
        assert_eq!(mock_ocr.get_call_count(), 0, "OCR should NOT be called for normal text PDFs");
        assert!(extraction.full_text.contains("Alice Smith"));
    }

    #[tokio::test]
    async fn test_ac2_screenshot_scanned_pdf_ocr_fallback() {
        // Create an image-only page (None = no text layer, image XObject embedded)
        let (file, _) = create_synthetic_pdf(&[None]);

        let mock_ocr = MockOcrProvider::new().with_text(
            "John Doe Lead DevOps Engineer Skills: Kubernetes Terraform AWS Python Experience: 6 years at CloudTech"
        );
        let extraction = extract_pdf_pages_hybrid(&file.0, &mock_ocr).await.unwrap();

        assert_eq!(extraction.method, ExtractionMethod::Ocr);
        assert_eq!(extraction.text_pages, 0);
        assert_eq!(extraction.ocr_pages, 1);
        assert_eq!(mock_ocr.get_call_count(), 1, "OCR should be called for scanned page");
        assert!(extraction.full_text.contains("John Doe"));
        assert!(extraction.full_text.contains("DevOps Engineer"));
    }

    #[tokio::test]
    async fn test_ac3_mixed_pdf_hybrid_preserves_page_ordering() {
        let text_p1 = "Page One: Alice Smith Software Architect Summary 10 years experience building scalable systems.";
        let text_p3 = "Page Three: EDUCATION Bachelor of Science in Computer Science MIT 2015.";

        // Page 1: Text, Page 2: Scanned/Image, Page 3: Text
        let (file, _) = create_synthetic_pdf(&[Some(text_p1), None, Some(text_p3)]);

        let mock_ocr = MockOcrProvider::new().with_text(
            "Page Two: WORK EXPERIENCE Senior Staff Engineer at MegaCorp 2018 - Present Managed 20 engineers."
        );

        let extraction = extract_pdf_pages_hybrid(&file.0, &mock_ocr).await.unwrap();

        assert_eq!(extraction.method, ExtractionMethod::Hybrid);
        assert_eq!(extraction.total_pages, 3);
        assert_eq!(extraction.text_pages, 2);
        assert_eq!(extraction.ocr_pages, 1);
        assert_eq!(mock_ocr.get_call_count(), 1);

        // Verify page ordering: Page 1 content comes before Page 2 (OCR), which comes before Page 3
        let pos1 = extraction.full_text.find("Alice Smith").unwrap();
        let pos2 = extraction.full_text.find("WORK EXPERIENCE").unwrap();
        let pos3 = extraction.full_text.find("EDUCATION").unwrap();

        assert!(pos1 < pos2, "Page 1 must appear before Page 2");
        assert!(pos2 < pos3, "Page 2 must appear before Page 3");
    }

    #[tokio::test]
    async fn test_ac4_ocr_single_page_failure_resilience() {
        let text_p1 = "Bob Johnson Senior Frontend Engineer React TypeScript CSS GraphQL with 8 years experience building responsive web apps.";

        // Page 1: Text, Page 2: Image (where OCR fails)
        let (file, _) = create_synthetic_pdf(&[Some(text_p1), None]);

        let mock_ocr = MockOcrProvider::new().with_error(OcrError::ExecutionFailed("Engine crash".into()));
        let extraction = extract_pdf_pages_hybrid(&file.0, &mock_ocr).await.unwrap();

        // Page 1 should still succeed and provide parsed resume text
        assert_eq!(extraction.text_pages, 1);
        assert_eq!(extraction.ocr_pages, 0);
        assert!(extraction.full_text.contains("Bob Johnson"));
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn test_ac5_native_apple_vision_pdf_ocr() {
        let vision_provider = crate::ocr::apple_vision::AppleVisionProvider::new();
        if !vision_provider.is_available() {
            return;
        }

        // Create a synthetic image-based PDF
        let temp_pdf = std::env::temp_dir().join(format!("test_apple_vision_{}.pdf", Uuid::new_v4()));
        let swift_cmd = format!(r#"
import Foundation
import PDFKit
import CoreGraphics
import CoreText
import UniformTypeIdentifiers

let pdfData = NSMutableData()
let consumer = CGDataConsumer(data: pdfData as CFMutableData)!
var mediaBox = CGRect(x: 0, y: 0, width: 612, height: 792)
let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil)!

context.beginPage(mediaBox: &mediaBox)
context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
context.fill(mediaBox)

let bitmapWidth = 612 * 2
let bitmapHeight = 792 * 2
let bitmapContext = CGContext(
    data: nil,
    width: bitmapWidth,
    height: bitmapHeight,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
)!

bitmapContext.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
bitmapContext.fill(CGRect(x: 0, y: 0, width: bitmapWidth, height: bitmapHeight))

let font = CTFontCreateWithName("Helvetica" as CFString, 28, nil)
let attr: [NSAttributedString.Key: Any] = [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(red: 0, green: 0, blue: 0, alpha: 1)
]

let text1 = NSAttributedString(string: "Jackson Miller Senior React Developer", attributes: attr)
let line1 = CTLineCreateWithAttributedString(text1)
bitmapContext.textPosition = CGPoint(x: 50, y: bitmapHeight - 100)
CTLineDraw(line1, bitmapContext)

let image = bitmapContext.makeImage()!
context.draw(image, in: mediaBox)
context.endPage()
context.closePDF()

pdfData.write(toFile: "{}", atomically: true)
"#, temp_pdf.display());

        let output = std::process::Command::new("/usr/bin/swift")
            .arg("-e")
            .arg(&swift_cmd)
            .output();

        if let Ok(out) = output {
            if out.status.success() && temp_pdf.exists() {
                let guard = tempfile_guard::TestTempFile(temp_pdf.clone());
                let extraction = extract_pdf_pages_hybrid(&guard.0, &vision_provider).await.unwrap();
                assert_eq!(extraction.method, ExtractionMethod::Ocr);
                assert!(extraction.full_text.contains("Jackson Miller"));
                assert!(extraction.full_text.contains("React Developer"));
            }
        }
    }
}
