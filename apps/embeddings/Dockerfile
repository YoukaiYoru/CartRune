FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends git libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
# The Azure VM is CPU-only. Installing the CPU wheels explicitly avoids
# pulling CUDA/NVIDIA runtime packages into the image.
RUN pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8700
CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8700"]
