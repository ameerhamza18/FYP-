"""Automated database backup, checksum verification, and disaster-recovery utility.

Designed for production Docker containers, cron execution, or manual disaster recovery:
- Exports gzipped SQL dump from PostgreSQL (or SQLite backup for dev).
- Generates SHA256 integrity checksum for tamper verification.
- Auto-prunes snapshots older than retention days (default: 7).
- Supports disaster recovery restore via --restore <snapshot_file>.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("trustlayer.backup")


def sha256_file(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_db_params(database_url: str):
    parsed = urlparse(database_url)
    return {
        "engine": parsed.scheme,
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "dbname": parsed.path.lstrip("/"),
    }


def perform_backup(backup_dir: Path, retention_days: int = 7) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    db_url = os.environ.get("DATABASE_URL", "sqlite:///./trustlayer.db")
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d_%H%M%S")

    if db_url.startswith("sqlite"):
        # SQLite dev mode backup
        raw_path = db_url.replace("sqlite:///", "")
        src = Path(raw_path)
        if not src.exists():
            backend_src = Path("backend") / raw_path.lstrip("./")
            if backend_src.exists():
                src = backend_src
            else:
                # If neither exists, check repo root or raise
                raise FileNotFoundError(f"SQLite file not found at: {raw_path}")
        dest_file = backup_dir / f"trustlayer_backup_{timestamp}.db.gz"
        logger.info("Compressing SQLite database %s -> %s", src, dest_file)
        with open(src, "rb") as f_in, gzip.open(dest_file, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

    else:
        # PostgreSQL production backup
        params = get_db_params(db_url)
        dest_file = backup_dir / f"trustlayer_backup_{timestamp}.sql.gz"
        logger.info("Dumping PostgreSQL database '%s' at %s:%s", params["dbname"], params["host"], params["port"])

        env = os.environ.copy()
        if params["password"]:
            env["PGPASSWORD"] = params["password"]

        cmd = [
            "pg_dump",
            "-h", params["host"],
            "-p", params["port"],
            "-U", params["user"],
            "-F", "p",
            params["dbname"],
        ]

        proc = subprocess.Popen(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with gzip.open(dest_file, "wb") as f_out:
            while chunk := proc.stdout.read(65536):
                f_out.write(chunk)

        _, stderr = proc.communicate()
        if proc.returncode != 0:
            dest_file.unlink(missing_ok=True)
            raise RuntimeError(f"pg_dump failed (code {proc.returncode}): {stderr.decode('utf-8')}")

    # Compute and write SHA-256 checksum
    checksum = sha256_file(dest_file)
    checksum_file = dest_file.with_suffix(".gz.sha256")
    checksum_file.write_text(f"{checksum}  {dest_file.name}\n", encoding="utf-8")
    logger.info("Backup created: %s (%d bytes, SHA256: %s)", dest_file.name, dest_file.stat().st_size, checksum[:16])

    # Prune stale backups older than retention_days
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=retention_days)
    for p in backup_dir.glob("trustlayer_backup_*"):
        if p.is_file():
            mtime = dt.datetime.fromtimestamp(p.stat().st_mtime, tz=dt.timezone.utc)
            if mtime < cutoff:
                logger.info("Pruning expired backup: %s", p.name)
                p.unlink(missing_ok=True)

    return dest_file


def perform_restore(backup_file: Path):
    if not backup_file.is_file():
        raise FileNotFoundError(f"Backup file not found: {backup_file}")

    # Checksum verification if available
    chk_file = backup_file.with_suffix(".gz.sha256")
    if chk_file.is_file():
        expected = chk_file.read_text(encoding="utf-8").split()[0].strip()
        actual = sha256_file(backup_file)
        if actual != expected:
            raise ValueError(f"Checksum mismatch! Expected {expected}, got {actual}")
        logger.info("Integrity checksum verified.")

    db_url = os.environ.get("DATABASE_URL", "sqlite:///./trustlayer.db")

    if db_url.startswith("sqlite"):
        dest_path = Path(db_url.replace("sqlite:///", ""))
        logger.info("Restoring SQLite database to %s", dest_path)
        with gzip.open(backup_file, "rb") as f_in, open(dest_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
        logger.info("Restore complete.")
    else:
        params = get_db_params(db_url)
        env = os.environ.copy()
        if params["password"]:
            env["PGPASSWORD"] = params["password"]

        cmd = [
            "psql",
            "-h", params["host"],
            "-p", params["port"],
            "-U", params["user"],
            "-d", params["dbname"],
        ]
        logger.info("Restoring PostgreSQL database from %s", backup_file)
        with gzip.open(backup_file, "rb") as f_in:
            proc = subprocess.run(cmd, env=env, stdin=f_in, capture_output=True)
            if proc.returncode != 0:
                raise RuntimeError(f"psql restore failed: {proc.stderr.decode('utf-8')}")
        logger.info("Restore complete.")


def main():
    parser = argparse.ArgumentParser(description="TrustLayer Database Backup & Recovery Utility")
    parser.add_argument("--dir", default=os.environ.get("BACKUP_DIR", "./backups"), help="Directory to store backups")
    parser.add_argument("--retention", type=int, default=7, help="Days to retain backups before rotation")
    parser.add_argument("--restore", help="Path to backup file (.sql.gz or .db.gz) to restore")
    args = parser.parse_args()

    if args.restore:
        perform_restore(Path(args.restore))
    else:
        perform_backup(Path(args.dir), retention_days=args.retention)


if __name__ == "__main__":
    main()
