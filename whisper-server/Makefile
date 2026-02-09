.PHONY: install run tiny base small medium large clean help

# Load .env file if it exists
-include .env
export

# Default settings
MODEL ?= base
DEVICE ?= auto
COMPUTE_TYPE ?= int8
BATCH_SIZE ?= 3

help:
	@echo "Whisper Server Commands"
	@echo "======================="
	@echo ""
	@echo "Setup:"
	@echo "  make install     - Install dependencies"
	@echo ""
	@echo "Run with specific models:"
	@echo "  make tiny        - Run with tiny model (~1GB RAM)"
	@echo "  make base        - Run with base model (~2GB RAM) [default]"
	@echo "  make small       - Run with small model (~4GB RAM)"
	@echo "  make medium      - Run with medium model (~6GB RAM)"
	@echo "  make large       - Run with large-v3 model (~8GB RAM)"
	@echo ""
	@echo "Batch size (latency vs quality):"
	@echo "  BATCH_SIZE=3     - Fast (3s latency) [default]"
	@echo "  BATCH_SIZE=5     - Better quality (5s latency)"
	@echo ""
	@echo "Examples:"
	@echo "  make base BATCH_SIZE=3   - Base model, fast latency"
	@echo "  make medium BATCH_SIZE=5 - Medium model, better quality"
	@echo "  make run MODEL=small DEVICE=cpu BATCH_SIZE=5"
	@echo ""
	@echo "Other:"
	@echo "  make clean       - Remove cached models and temp files"
	@echo "  make health      - Check if server is running"

install:
	poetry install

run:
	WHISPER_MODEL=$(MODEL) WHISPER_DEVICE=$(DEVICE) WHISPER_COMPUTE_TYPE=$(COMPUTE_TYPE) WHISPER_BATCH_SIZE=$(BATCH_SIZE) poetry run python server.py

tiny:
	WHISPER_MODEL=tiny WHISPER_DEVICE=$(DEVICE) WHISPER_COMPUTE_TYPE=$(COMPUTE_TYPE) WHISPER_BATCH_SIZE=$(BATCH_SIZE) poetry run python server.py

base:
	WHISPER_MODEL=base WHISPER_DEVICE=$(DEVICE) WHISPER_COMPUTE_TYPE=$(COMPUTE_TYPE) WHISPER_BATCH_SIZE=$(BATCH_SIZE) poetry run python server.py

small:
	WHISPER_MODEL=small WHISPER_DEVICE=$(DEVICE) WHISPER_COMPUTE_TYPE=$(COMPUTE_TYPE) WHISPER_BATCH_SIZE=$(BATCH_SIZE) poetry run python server.py

medium:
	WHISPER_MODEL=medium WHISPER_DEVICE=$(DEVICE) WHISPER_COMPUTE_TYPE=$(COMPUTE_TYPE) WHISPER_BATCH_SIZE=$(BATCH_SIZE) poetry run python server.py

large:
	WHISPER_MODEL=large-v3 WHISPER_DEVICE=$(DEVICE) WHISPER_COMPUTE_TYPE=$(COMPUTE_TYPE) WHISPER_BATCH_SIZE=$(BATCH_SIZE) poetry run python server.py

health:
	@curl -s http://127.0.0.1:8765/health | python3 -m json.tool || echo "Server not running"

clean:
	rm -rf __pycache__
	rm -rf .pytest_cache
	find . -name "*.pyc" -delete
