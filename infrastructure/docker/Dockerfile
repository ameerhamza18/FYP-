# syntax=docker/dockerfile:1
# TrustLayer API — production image
FROM python:3.12-slim

# Use regional mirrors (significantly faster on Asian/PK networks);
# remove these two ENV/sed lines if building from a fast EU/US connection.
ENV PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ \
    PIP_DEFAULT_TIMEOUT=120
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources || true

# Tesseract for the OCR (vision) service
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /srv/trustlayer

# Install dependencies first (layer caching)
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Application code (backend + services + ml packages)
COPY backend backend
COPY services services
COPY ml ml

# Train the ML model at build time so the image ships with scam_model.joblib
# (dataset is generated synthetically — no external data dependency)
RUN python -m ml.training.generate_dataset && python -m ml.training.train_model

ENV APP_ENV=production DEBUG=false
WORKDIR /srv/trustlayer/backend

# Non-root user
RUN useradd -m appuser && chown -R appuser /srv/trustlayer
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
