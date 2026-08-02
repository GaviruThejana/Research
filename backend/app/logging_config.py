"""
Structured logging configuration for the application.

Emits JSON-formatted log lines so they can be easily ingested by log
aggregation systems (ELK, CloudWatch, Datadog, etc.) in production.
"""
from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any, Dict


class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "timestamp": time.strftime(
                "%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)
            ),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        extra_fields = getattr(record, "extra_fields", None)
        if extra_fields:
            payload.update(extra_fields)

        return json.dumps(payload, default=str)


def configure_logging(log_level: str = "INFO") -> None:
    """Configures root logging handlers with the JSON formatter."""
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())

    # Remove any pre-existing handlers to avoid duplicate log lines
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(stream_handler)

    # Tame overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("PIL").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
