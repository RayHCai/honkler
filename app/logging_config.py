import logging
import sys


def setup_logging(debug: bool = False) -> None:
    """Configure structured logging for the Honkler agent worker."""
    level = logging.DEBUG if debug else logging.INFO

    # Custom formatter with colors
    class ColorFormatter(logging.Formatter):
        COLORS = {
            logging.DEBUG: "\033[36m",    # cyan
            logging.INFO: "\033[32m",     # green
            logging.WARNING: "\033[33m",  # yellow
            logging.ERROR: "\033[31m",    # red
            logging.CRITICAL: "\033[35m", # magenta
        }
        RESET = "\033[0m"
        DIM = "\033[2m"
        BOLD = "\033[1m"

        def format(self, record: logging.LogRecord) -> str:
            color = self.COLORS.get(record.levelno, "")
            ts = self.formatTime(record, "%Y-%m-%dT%H:%M:%S")
            ms = f".{int(record.msecs):03d}"
            level = record.levelname
            name = record.name
            msg = record.getMessage()

            formatted = (
                f"{self.DIM}{ts}{ms}{self.RESET} "
                f"{color}{self.BOLD}[{level}]{self.RESET} "
                f"{color}[{name}]{self.RESET} "
                f"{msg}"
            )

            if record.exc_info and record.exc_info[1]:
                formatted += f"\n{self.formatException(record.exc_info)}"

            return formatted

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(ColorFormatter())

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Quiet noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("google").setLevel(logging.WARNING)
