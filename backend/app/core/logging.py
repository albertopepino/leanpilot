"""
Structured logging configuration using structlog.
Provides JSON logging in production, colorized console in development.
"""
import logging
import sys

import structlog


def setup_logging(debug: bool = False):
    """Configure structlog + stdlib logging integration."""

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if debug:
        # Pretty console output for development
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer()
    else:
        # JSON output for production (machine-parseable for ELK/Datadog/etc.)
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if debug else logging.INFO)

    # Quieten noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING if not debug else logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
