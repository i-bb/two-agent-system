import logging
import os
import secrets
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from mem0 import Memory

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")
if not ADMIN_API_KEY:
    logging.warning("ADMIN_API_KEY not set — endpoints are unsecured")

QDRANT_HOST = os.environ.get("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", "6333"))
COLLECTION_NAME = os.environ.get("COLLECTION_NAME", "memories")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

config = {
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": QDRANT_HOST,
            "port": QDRANT_PORT,
            "collection_name": COLLECTION_NAME,
        },
    },
    "llm": {
        "provider": "openai",
        "config": {"api_key": OPENAI_API_KEY, "model": "gpt-4o-mini", "temperature": 0.2},
    },
    "embedder": {
        "provider": "openai",
        "config": {"api_key": OPENAI_API_KEY, "model": "text-embedding-3-small"},
    },
}

logging.info("Initializing Memory with Qdrant at %s:%d", QDRANT_HOST, QDRANT_PORT)
MEMORY_INSTANCE = Memory.from_config(config)
logging.info("Memory initialized")

app = FastAPI(title="Mem0 REST API", version="1.0.0")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Depends(api_key_header)):
    if ADMIN_API_KEY:
        if not api_key or not secrets.compare_digest(api_key, ADMIN_API_KEY):
            raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")
    return api_key


class Message(BaseModel):
    role: str
    content: str


class MemoryCreate(BaseModel):
    messages: List[Message]
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    run_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SearchRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    run_id: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None


@app.get("/")
def home():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/memories")
def add_memory(body: MemoryCreate, _: Optional[str] = Depends(verify_api_key)):
    if not any([body.user_id, body.agent_id, body.run_id]):
        raise HTTPException(status_code=400, detail="user_id, agent_id, or run_id required")
    params = {k: v for k, v in body.model_dump().items() if v is not None and k != "messages"}
    try:
        result = MEMORY_INSTANCE.add(messages=[m.model_dump() for m in body.messages], **params)
        return JSONResponse(content=result)
    except Exception as e:
        logging.exception("add_memory error")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memories")
def get_memories(user_id: Optional[str] = None, agent_id: Optional[str] = None,
                 run_id: Optional[str] = None, _: Optional[str] = Depends(verify_api_key)):
    if not any([user_id, agent_id, run_id]):
        raise HTTPException(status_code=400, detail="user_id, agent_id, or run_id required")
    params = {k: v for k, v in {"user_id": user_id, "agent_id": agent_id, "run_id": run_id}.items() if v}
    try:
        return MEMORY_INSTANCE.get_all(**params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/memories/search")
def search_memories(body: SearchRequest, _: Optional[str] = Depends(verify_api_key)):
    params = {k: v for k, v in body.model_dump().items() if v is not None and k != "query"}
    try:
        return MEMORY_INSTANCE.search(query=body.query, **params)
    except Exception as e:
        logging.exception("search_memories error")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/memories/{memory_id}")
def delete_memory(memory_id: str, _: Optional[str] = Depends(verify_api_key)):
    try:
        MEMORY_INSTANCE.delete(memory_id=memory_id)
        return {"message": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
