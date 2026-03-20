FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    "mem0ai>=0.1.100" \
    "qdrant-client>=1.7.0" \
    fastapi \
    "uvicorn[standard]" \
    python-dotenv

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
