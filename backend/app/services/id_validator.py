"""Shared ID sanitization for JSON file-based storage services.

All storage services (dataset, case, test_results) use user-supplied IDs
to construct file paths. Without validation, path traversal attacks like
"../../etc/passwd" could read/write arbitrary files.
"""

import re


# Only allow alphanumeric, hyphens, and underscores (covers UUID format)
_SAFE_ID_PATTERN = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_\-]*$')

# Maximum ID length to prevent abuse
_MAX_ID_LENGTH = 128


def sanitize_id(raw_id: str, label: str = "ID") -> str:
    """Validate and return a safe ID for use in file paths.

    Args:
        raw_id: The user-supplied ID string.
        label: Human-readable label for error messages (e.g. "dataset_id").

    Returns:
        The validated ID string (unchanged).

    Raises:
        ValueError: If the ID contains path traversal characters or
                    doesn't match the safe pattern.
    """
    if not raw_id:
        raise ValueError(f"{label} cannot be empty")

    if len(raw_id) > _MAX_ID_LENGTH:
        raise ValueError(f"{label} exceeds maximum length of {_MAX_ID_LENGTH}")

    if not _SAFE_ID_PATTERN.match(raw_id):
        raise ValueError(
            f"{label} contains invalid characters: only alphanumeric, "
            f"hyphens, and underscores are allowed"
        )

    return raw_id
