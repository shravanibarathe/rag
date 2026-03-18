import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy import create_engine
from pgvector.sqlalchemy import Vector

from .config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True, nullable=False)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    processed = Column(JSON, nullable=True)

    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(3072), nullable=False)
    metadata_json = Column(JSON, nullable=True)

    document = relationship("Document", back_populates="chunks")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
