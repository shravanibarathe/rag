import json
import asyncio
import time
from typing import List, Optional
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, BackgroundTasks, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from .core.config import settings
from .core.database import Base, engine, get_db, Document, Chunk, ChatHistory
from .services.document_service import document_service
from .services.rag_service import rag_service

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Auto-create pgvector extension + tables on startup with 5 retry attempts
    retries = 5
    for attempt in range(retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.commit()
            Base.metadata.create_all(bind=engine)
            print("Database initialized successfully.")
            break
        except Exception as e:
            print(f"Database connection attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(5)
            else:
                raise

@app.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    results = []
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            continue
            
        # Process PDF and get chunks
        chunks_data = await document_service.process_pdf(file)
        
        # Save document
        db_doc = Document(filename=file.filename, processed={"status": "processing"})
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        # Get embeddings for each chunk and save
        # Doing this sequentially might be slow but it serves the requirement
        for chunk_data in chunks_data:
            content = chunk_data["content"]
            metadata = chunk_data["metadata"]
            
            # Embed chunk
            embedding = rag_service.get_embedding(content)
            
            db_chunk = Chunk(
                document_id=db_doc.id,
                content=content,
                embedding=embedding,
                metadata_json=metadata
            )
            db.add(db_chunk)
            
        db_doc.processed = {"status": "success", "chunks_count": len(chunks_data)}
        db.commit()
        
        results.append({
            "filename": file.filename,
            "status": "success",
            "chunks": len(chunks_data)
        })
        
    return {"message": "Files processed successfully", "details": results}

@app.get("/chat")
async def chat(
    query: str,
    session_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        # Get history
        history_records = db.query(ChatHistory).filter(ChatHistory.session_id == session_id).order_by(ChatHistory.timestamp).all()
        history = [{"role": h.role, "content": h.content} for h in history_records]
        
        # Save user query
        user_msg = ChatHistory(session_id=session_id, role="user", content=query)
        db.add(user_msg)
        db.commit()
        
        # Generate Answer
        answer = await rag_service.generate_answer(db, query, history)
        
        # Save AI response
        ai_msg = ChatHistory(session_id=session_id, role="ai", content=answer)
        db.add(ai_msg)
        db.commit()
        
        return {"answer": answer, "session_id": session_id}
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{session_id}")
async def get_history(session_id: str, db: Session = Depends(get_db)):
    history = db.query(ChatHistory).filter(ChatHistory.session_id == session_id).order_by(ChatHistory.timestamp).all()
    return [{"role": h.role, "content": h.content, "timestamp": h.timestamp} for h in history]

@app.get("/sessions")
async def get_sessions(db: Session = Depends(get_db)):
    # Returns list of unique session IDs
    sessions = db.query(ChatHistory.session_id).distinct().all()
    return {"sessions": [s[0] for s in sessions]}

@app.get("/documents")
async def get_documents(db: Session = Depends(get_db)):
    # Returns list of uploaded documents
    docs = db.query(Document).all()
    return [{"filename": d.filename, "status": d.processed.get("status") if d.processed else "unknown", "chunks": d.processed.get("chunks_count") if d.processed else 0} for d in docs]

@app.delete("/documents/{filename}")
async def delete_document(filename: str, db: Session = Depends(get_db)):
    # Find document
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Chunks are linked via document_id, but we need to delete them first if no cascade
    # Assuming SQLAlchemy model has relationship with cascade='all, delete-orphan'
    # Actually, let's manual delete to be sure
    db.query(Chunk).filter(Chunk.document_id == doc.id).delete()
    db.delete(doc)
    db.commit()
    return {"message": f"Document {filename} deleted successfully"}
