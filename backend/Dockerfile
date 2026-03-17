FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user
RUN adduser --disabled-password --no-create-home appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "python init_db.py && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]
