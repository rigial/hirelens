use rusqlite::{Connection, Result, params};
use uuid::Uuid;

/// Convert a slice of 32-bit floats into a raw byte vector (little-endian bytes)
pub fn vector_to_blob(vec: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(vec.len() * 4);
    for &val in vec {
        bytes.extend_from_slice(&val.to_le_bytes());
    }
    bytes
}

/// Convert a raw byte slice back into a vector of 32-bit floats
pub fn blob_to_vector(blob: &[u8]) -> Result<Vec<f32>, String> {
    if !blob.len().is_multiple_of(4) {
        return Err(format!("Invalid vector blob length {}: must be a multiple of 4 bytes", blob.len()));
    }
    let mut vec = Vec::with_capacity(blob.len() / 4);
    for chunk in blob.chunks_exact(4) {
        let arr: [u8; 4] = chunk.try_into().map_err(|_| "Failed to parse float chunk".to_string())?;
        vec.push(f32::from_le_bytes(arr));
    }
    Ok(vec)
}

/// Insert or update a resume embedding vector BLOB for a specific resume and job
pub fn upsert_resume_embedding(
    conn: &Connection,
    resume_id: &str,
    job_id: &str,
    embedding: &[f32],
) -> Result<String> {
    let id = Uuid::new_v4().to_string();
    let blob = vector_to_blob(embedding);

    conn.execute(
        "INSERT INTO embeddings (id, resume_id, job_id, embedding, created_at)
         VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
         ON CONFLICT(resume_id, job_id) DO UPDATE SET
            embedding = excluded.embedding,
            created_at = CURRENT_TIMESTAMP",
        params![id, resume_id, job_id, blob],
    )?;

    Ok(id)
}

/// Retrieve the raw float embedding vector for a given resume and job
pub fn get_resume_embedding(
    conn: &Connection,
    resume_id: &str,
    job_id: &str,
) -> Result<Option<Vec<f32>>> {
    let mut stmt = conn.prepare(
        "SELECT embedding FROM embeddings WHERE resume_id = ?1 AND job_id = ?2 LIMIT 1"
    )?;

    let mut rows = stmt.query(params![resume_id, job_id])?;
    if let Some(row) = rows.next()? {
        let blob: Vec<u8> = row.get(0)?;
        match blob_to_vector(&blob) {
            Ok(vec) => Ok(Some(vec)),
            Err(e) => Err(rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Blob,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
            )),
        }
    } else {
        Ok(None)
    }
}

/// Insert or update a job description embedding vector BLOB
pub fn upsert_job_embedding(
    conn: &Connection,
    job_id: &str,
    embedding: &[f32],
) -> Result<()> {
    let blob = vector_to_blob(embedding);

    conn.execute(
        "INSERT INTO job_embeddings (job_id, embedding, updated_at)
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(job_id) DO UPDATE SET
            embedding = excluded.embedding,
            updated_at = CURRENT_TIMESTAMP",
        params![job_id, blob],
    )?;

    Ok(())
}

/// Retrieve the cached float embedding vector for a given job description
pub fn get_job_embedding(
    conn: &Connection,
    job_id: &str,
) -> Result<Option<Vec<f32>>> {
    let mut stmt = conn.prepare(
        "SELECT embedding FROM job_embeddings WHERE job_id = ?1 LIMIT 1"
    )?;

    let mut rows = stmt.query(params![job_id])?;
    if let Some(row) = rows.next()? {
        let blob: Vec<u8> = row.get(0)?;
        match blob_to_vector(&blob) {
            Ok(vec) => Ok(Some(vec)),
            Err(e) => Err(rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Blob,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
            )),
        }
    } else {
        Ok(None)
    }
}

/// Find top matching resumes for a job using sqlite-vec cosine distance function
pub fn find_similar_resumes_sqlite_vec(
    conn: &Connection,
    job_id: &str,
    query_vector: &[f32],
    limit: usize,
) -> Result<Vec<(String, f64)>> {
    let query_blob = vector_to_blob(query_vector);
    let mut stmt = conn.prepare(
        "SELECT resume_id, vec_distance_cosine(embedding, ?1) AS distance
         FROM embeddings
         WHERE job_id = ?2
         ORDER BY distance ASC
         LIMIT ?3"
    )?;

    let rows = stmt.query_map(params![query_blob, job_id, limit as i64], |row| {
        let resume_id: String = row.get(0)?;
        let distance: f64 = row.get(1)?;
        // Cosine similarity = 1.0 - cosine distance
        let similarity = 1.0 - distance;
        Ok((resume_id, similarity))
    })?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::init_db;

    #[test]
    fn test_vector_blob_roundtrip() {
        let original: Vec<f32> = vec![0.123, -0.456, 0.789, 0.0, 1.0, -1.0];
        let blob = vector_to_blob(&original);
        assert_eq!(blob.len(), original.len() * 4);

        let decoded = blob_to_vector(&blob).expect("Failed to decode blob");
        assert_eq!(original.len(), decoded.len());
        for (a, b) in original.iter().zip(decoded.iter()) {
            assert!((a - b).abs() < 1e-6);
        }
    }

    #[test]
    fn test_blob_to_vector_invalid_length() {
        let invalid_blob = vec![1, 2, 3]; // Not multiple of 4
        assert!(blob_to_vector(&invalid_blob).is_err());
    }

    #[test]
    fn test_resume_and_job_embedding_crud() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join(format!("test_embed_db_{}.sqlite", Uuid::new_v4()));
        let conn = init_db(&db_path).expect("Failed to initialize test DB");

        // Seed a job and resume
        let job_id = Uuid::new_v4().to_string();
        let resume_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO jobs (id, title, description) VALUES (?1, 'Software Engineer', 'Rust, TypeScript')",
            params![job_id],
        ).unwrap();

        conn.execute(
            "INSERT INTO resumes (id, job_id, file_name, file_path, file_type, file_size) VALUES (?1, ?2, 'test.pdf', '/tmp/test.pdf', 'pdf', 100)",
            params![resume_id, job_id],
        ).unwrap();

        // 1. Job embedding
        let job_vec: Vec<f32> = vec![0.1, 0.2, 0.3, 0.4];
        upsert_job_embedding(&conn, &job_id, &job_vec).expect("Failed to upsert job embedding");

        let fetched_job_vec = get_job_embedding(&conn, &job_id)
            .expect("Failed to fetch job embedding")
            .expect("Job embedding should exist");
        assert_eq!(job_vec, fetched_job_vec);

        // 2. Resume embedding
        let resume_vec: Vec<f32> = vec![0.1, 0.2, 0.35, 0.45];
        upsert_resume_embedding(&conn, &resume_id, &job_id, &resume_vec)
            .expect("Failed to upsert resume embedding");

        let fetched_resume_vec = get_resume_embedding(&conn, &resume_id, &job_id)
            .expect("Failed to fetch resume embedding")
            .expect("Resume embedding should exist");
        assert_eq!(resume_vec, fetched_resume_vec);

        // 3. Vector similarity search with sqlite-vec
        let query_vec = vec![0.1, 0.2, 0.3, 0.4];
        let matches = find_similar_resumes_sqlite_vec(&conn, &job_id, &query_vec, 5)
            .expect("Failed to run sqlite-vec similarity");
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].0, resume_id);
        assert!(matches[0].1 > 0.95); // High similarity

        std::fs::remove_file(&db_path).ok();
    }
}
