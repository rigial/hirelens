use std::fs::File;
use std::io::Read;
use std::path::Path;
use quick_xml::events::Event;
use quick_xml::reader::Reader;

pub fn extract_docx_text<P: AsRef<Path>>(path: P) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open DOCX file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid DOCX zip archive: {}", e))?;

    let mut document_xml = match archive.by_name("word/document.xml") {
        Ok(f) => f,
        Err(_) => return Err("Missing word/document.xml in DOCX file".to_string()),
    };

    let mut xml_content = String::new();
    document_xml.read_to_string(&mut xml_content).map_err(|e| format!("Failed to read XML: {}", e))?;

    let mut reader = Reader::from_str(&xml_content);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut text_output = String::new();
    let mut in_text = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"w:t" => {
                in_text = true;
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"w:t" => {
                in_text = false;
            }
            Ok(Event::Text(e)) if in_text => {
                if let Ok(txt) = e.unescape() {
                    text_output.push_str(&txt);
                    text_output.push(' ');
                }
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"w:p" => {
                text_output.push('\n');
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("Error parsing DOCX XML: {}", e)),
            _ => (),
        }
        buf.clear();
    }

    if text_output.trim().is_empty() {
        return Err("DOCX file contains no readable text.".to_string());
    }

    Ok(text_output)
}
