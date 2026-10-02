# syntax=docker/dockerfile:1
# TrustLayer API — production image
FROM python:3.12-slim

# Optional mirror build args (e.g. --build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/)
ARG PIP_INDEX_URL=""
ENV PIP_INDEX_URL=$PIP_INDEX_URL \
    PIP_DEFAULT_TIMEOUT=120 \
    PYTHONPATH=/srv/trustlayer:/srv/trustlayer/backend

# Tesseract for the OCR (vision) service
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng curl \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /srv/trustlayer

# Install dependencies first (layer caching)
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Application code (backend + services + ml packages)
COPY backend backend
COPY services services
COPY ml ml

# Use existing model if present, or generate & train if missing
RUN if [ ! -f ml/models/scam_model.joblib ]; then \
        python -m ml.training.generate_dataset && python -m ml.training.train_model; \
    fi

ENV APP_ENV=production DEBUG=false
WORKDIR /srv/trustlayer/backend

# Non-root user
RUN useradd -m appuser && chown -R appuser /srv/trustlayer
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
