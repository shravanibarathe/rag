import fitz  # PyMuPDF
from fastapi import UploadFile
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
import asyncio

class DocumentService:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            length_function=len
        )

    def extract_text_from_pdf(self, file_content: bytes) -> str:
        pdf_document = fitz.open(stream=file_content, filetype="pdf")
        text = ""
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            text += page.get_text() + "\n"
        pdf_document.close()
        return text

    def chunk_text(self, text: str) -> List[str]:
        return self.text_splitter.split_text(text)

    async def process_pdf(self, file: UploadFile) -> List[Dict[str, Any]]:
        file_content = await file.read()
        
        # CPU-bound tasks should ideally run in an executor
        text = await asyncio.to_thread(self.extract_text_from_pdf, file_content)
        chunks = await asyncio.to_thread(self.chunk_text, text)
        
        results = []
        for i, chunk in enumerate(chunks):
            results.append({
                "content": chunk,
                "metadata": {
                    "source": file.filename,
                    "chunk_index": i
                }
            })
            
        return results

document_service = DocumentService()
