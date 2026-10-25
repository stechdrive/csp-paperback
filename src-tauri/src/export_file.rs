use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
};
use tauri_plugin_fs::FsExt;

// Write beside the destination, then commit the complete file. Failed encoding,
// disk writes or replacement must leave an existing image untouched.
fn save_with_writer(
    path: &Path,
    overwrite: bool,
    write: impl FnOnce(&mut fs::File) -> io::Result<()>,
) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("Missing parent directory"))?;
    if overwrite {
        match fs::symlink_metadata(path) {
            Ok(metadata) if !metadata.file_type().is_file() => {
                return Err(io::Error::other(
                    "Cannot overwrite a directory or symbolic link",
                ))
            }
            Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
            _ => {}
        }
    }
    let mut temporary = tempfile::Builder::new()
        .prefix(".csp-paperback-")
        .tempfile_in(parent)?;
    write(temporary.as_file_mut())?;
    temporary.as_file().sync_all()?;
    if overwrite {
        temporary.persist(path).map_err(|error| error.error)?;
    } else {
        temporary
            .persist_noclobber(path)
            .map_err(|error| error.error)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn write_export_file(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<(), String> {
    let encoded = request
        .headers()
        .get("path")
        .and_then(|value| value.to_str().ok())
        .ok_or("Missing output path")?;
    let path = PathBuf::from(
        percent_encoding::percent_decode_str(encoded)
            .decode_utf8()
            .map_err(|error| error.to_string())?
            .as_ref(),
    );
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err("Invalid output path".into());
    }
    if !path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|ext| {
            ["png", "jpg", "psd"]
                .iter()
                .any(|allowed| ext.eq_ignore_ascii_case(allowed))
        })
    {
        return Err("Only JPG, PNG and PSD exports are supported".into());
    }
    let parent = path
        .parent()
        .ok_or("Missing parent directory")?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let target = parent.join(path.file_name().ok_or("Missing file name")?);
    let scope = app.fs_scope();
    if !scope.is_allowed(&path) || !scope.is_allowed(&target) {
        return Err("書き出し先へのアクセスが許可されていません".into());
    }
    let overwrite = request
        .headers()
        .get("overwrite")
        .and_then(|value| value.to_str().ok())
        == Some("true");
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("Missing image data".into());
    };
    save_with_writer(&target, overwrite, |file| file.write_all(bytes)).map_err(|error| {
        if error.kind() == io::ErrorKind::AlreadyExists {
            "destination-exists".into()
        } else {
            format!("画像を保存できませんでした: {error}")
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_then_replaces_only_with_permission() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("作画_1.png");
        save_with_writer(&path, false, |file| file.write_all(b"old longer image")).unwrap();
        assert_eq!(
            save_with_writer(&path, false, |file| file.write_all(b"new"))
                .unwrap_err()
                .kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(fs::read(&path).unwrap(), b"old longer image");
        save_with_writer(&path, true, |file| file.write_all(b"new")).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"new");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn partial_write_failure_preserves_old_bytes_and_cleans_temporary_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("image.jpg");
        fs::write(&path, b"original").unwrap();
        let result = save_with_writer(&path, true, |file| {
            file.write_all(b"partial")?;
            Err(io::Error::other("disk full"))
        });
        assert!(result.is_err());
        assert_eq!(fs::read(&path).unwrap(), b"original");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn does_not_replace_directories_or_their_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("image.jpg");
        fs::create_dir(&path).unwrap();
        fs::write(path.join("keep"), b"keep").unwrap();
        for overwrite in [false, true] {
            assert!(save_with_writer(&path, overwrite, |file| file.write_all(b"image")).is_err());
            assert_eq!(fs::read(path.join("keep")).unwrap(), b"keep");
        }
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn concurrent_new_writers_cannot_clobber_each_other() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("image.png");
        let gate = std::sync::Arc::new(std::sync::Barrier::new(2));
        let jobs: Vec<_> = [b'A', b'B']
            .into_iter()
            .map(|byte| {
                let path = path.clone();
                let gate = gate.clone();
                std::thread::spawn(move || {
                    save_with_writer(&path, false, |file| {
                        file.write_all(&[byte; 4096])?;
                        gate.wait();
                        Ok(())
                    })
                })
            })
            .collect();
        let results: Vec<_> = jobs.into_iter().map(|job| job.join().unwrap()).collect();
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(
            results
                .iter()
                .filter(|result| result
                    .as_ref()
                    .err()
                    .is_some_and(|error| error.kind() == io::ErrorKind::AlreadyExists))
                .count(),
            1
        );
        let bytes = fs::read(&path).unwrap();
        assert_eq!(bytes.len(), 4096);
        assert!(bytes.iter().all(|byte| *byte == bytes[0]));
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn failed_commit_preserves_the_newly_created_obstacle_and_removes_temporary_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("image.png");
        let result = save_with_writer(&path, true, |file| {
            file.write_all(b"new")?;
            fs::create_dir(&path)?;
            fs::write(path.join("keep"), b"keep")
        });
        assert!(result.is_err());
        assert_eq!(fs::read(path.join("keep")).unwrap(), b"keep");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn replacing_a_hard_link_does_not_change_the_other_link() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("image.png");
        let other = dir.path().join("other.png");
        fs::write(&other, b"original").unwrap();
        fs::hard_link(&other, &path).unwrap();
        save_with_writer(&path, true, |file| file.write_all(b"replacement")).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"replacement");
        assert_eq!(fs::read(&other).unwrap(), b"original");
    }

    #[cfg(unix)]
    #[test]
    fn symbolic_links_are_never_overwritten_or_followed() {
        let dir = tempfile::tempdir().unwrap();
        let other = dir.path().join("original.png");
        let path = dir.path().join("link.png");
        fs::write(&other, b"original").unwrap();
        std::os::unix::fs::symlink(&other, &path).unwrap();
        for overwrite in [false, true] {
            assert!(save_with_writer(&path, overwrite, |file| file.write_all(b"new")).is_err());
            assert_eq!(fs::read(&other).unwrap(), b"original");
        }
    }
}
