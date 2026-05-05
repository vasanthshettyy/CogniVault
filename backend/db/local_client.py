import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

class LocalTable:
    def __init__(self, table_name: str, db_path: Path):
        self.table_name = table_name
        self.db_path = db_path

    def _load_db(self) -> Dict[str, List[Dict[str, Any]]]:
        if not self.db_path.exists():
            return {}
        try:
            return json.loads(self.db_path.read_text())
        except Exception:
            return {}

    def _save_db(self, data: Dict[str, List[Dict[str, Any]]]):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db_path.write_text(json.dumps(data, indent=2))

    def insert(self, data: Dict[str, Any]):
        self._last_op = ("insert", data)
        return self

    def select(self, columns: str = "*"):
        self._last_op = ("select", columns)
        return self

    def update(self, data: Dict[str, Any]):
        self._last_op = ("update", data)
        return self

    def delete(self):
        self._last_op = ("delete", None)
        return self

    def eq(self, column: str, value: Any):
        if not hasattr(self, "_filters"): self._filters = []
        self._filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self._order_by = (column, desc)
        return self

    def limit(self, count: int):
        self._limit = count
        return self

    def execute(self):
        db = self._load_db()
        table = db.get(self.table_name, [])
        op_type, op_data = self._last_op
        
        class Response:
            def __init__(self, data): self.data = data

        if op_type == "insert":
            new_row = op_data.copy()
            # Add auto-generated IDs if missing
            id_fields = {
                "users": "id",
                "user_uploads": "upload_id",
                "ai_analyses": "analysis_id",
                "history": "history_id"
            }
            pk = id_fields.get(self.table_name)
            if pk and pk not in new_row:
                new_row[pk] = str(uuid.uuid4())
            
            # Add timestamps
            now = datetime.utcnow().isoformat()
            if "created_at" not in new_row: new_row["created_at"] = now
            if "uploaded_at" not in new_row and self.table_name == "user_uploads": new_row["uploaded_at"] = now
            
            table.append(new_row)
            db[self.table_name] = table
            self._save_db(db)
            return Response([new_row])

        elif op_type == "select":
            filters = getattr(self, "_filters", [])
            results = [row for row in table if all(row.get(c) == v for c, v in filters)]
            
            # Basic Join Support for history table
            columns = op_data if isinstance(op_data, str) else "*"
            if self.table_name == "history" and ("user_uploads" in columns or "ai_analyses" in columns):
                uploads = db.get("user_uploads", [])
                analyses = db.get("ai_analyses", [])
                for row in results:
                    if "user_uploads" in columns:
                        up_id = row.get("upload_id")
                        row["user_uploads"] = next((u for u in uploads if u.get("upload_id") == up_id), {})
                    if "ai_analyses" in columns:
                        an_id = row.get("analysis_id")
                        row["ai_analyses"] = next((a for a in analyses if a.get("analysis_id") == an_id), {})

            if hasattr(self, "_order_by"):
                col, desc = self._order_by
                results.sort(key=lambda x: str(x.get(col, "")), reverse=desc)
            
            if hasattr(self, "_limit"):
                results = results[:self._limit]
                
            return Response(results)

        elif op_type == "update":
            filters = getattr(self, "_filters", [])
            updated = []
            for row in table:
                if all(row.get(c) == v for c, v in filters):
                    row.update(op_data)
                    updated.append(row)
            db[self.table_name] = table
            self._save_db(db)
            return Response(updated)

        elif op_type == "delete":
            filters = getattr(self, "_filters", [])
            new_table = [row for row in table if not all(row.get(c) == v for c, v in filters)]
            db[self.table_name] = new_table
            self._save_db(db)
            return Response([])

        return Response([])

class LocalStorage:
    def __init__(self, bucket_name: str, root_dir: Path):
        self.bucket_name = bucket_name
        self.root_dir = root_dir / bucket_name

    def upload(self, path: str, file: bytes, file_options: Optional[Dict] = None):
        dest = self.root_dir / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(file)
        return {"path": path}

    def download(self, path: str):
        src = self.root_dir / path
        if not src.exists(): raise FileNotFoundError("File not found")
        return src.read_bytes()

    def remove(self, paths: List[str]):
        for p in paths:
            src = self.root_dir / p
            if src.exists(): src.unlink()
        return paths

class LocalClient:
    def __init__(self):
        self.root = Path(__file__).resolve().parents[1] / ".tmp" / "local_db"
        self.db_path = self.root / "db.json"
        self.storage_root = self.root / "storage"

    def table(self, table_name: str):
        return LocalTable(table_name, self.db_path)

    @property
    def storage(self):
        class StorageWrapper:
            def __init__(self, root): self.root = root
            def from_(self, bucket): return LocalStorage(bucket, self.root)
            def list_buckets(self): return [{"id": "user-uploads", "name": "user-uploads"}]
            def create_bucket(self, name, options=None): return {"name": name}
        return StorageWrapper(self.storage_root)

def get_local_client():
    return LocalClient()
