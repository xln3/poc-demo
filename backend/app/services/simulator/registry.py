"""Pluggable simulator engine registry."""

import logging
from typing import Dict, Type

from .base import SimulatorBase

logger = logging.getLogger(__name__)


class SimulatorRegistry:
    """
    Discovers and manages simulator engine implementations.

    Engines register themselves via ``register()`` and can be
    looked up by name at runtime.
    """

    _engines: Dict[str, Type[SimulatorBase]] = {}

    @classmethod
    def register(cls, engine_cls: Type[SimulatorBase]) -> Type[SimulatorBase]:
        """Register a simulator engine class (can be used as decorator)."""
        name = engine_cls.engine_name.fget(engine_cls)  # type: ignore[attr-defined]
        if name in cls._engines:
            logger.warning("Overwriting existing engine registration: %s", name)
        cls._engines[name] = engine_cls
        logger.info("Registered simulator engine: %s", name)
        return engine_cls

    @classmethod
    def get(cls, name: str) -> Type[SimulatorBase]:
        """Return engine class by name, or raise KeyError."""
        if name not in cls._engines:
            raise KeyError(f"Unknown simulator engine: {name}. Available: {list(cls._engines.keys())}")
        return cls._engines[name]

    @classmethod
    def list_engines(cls) -> list[dict]:
        """Return metadata for every registered engine."""
        result = []
        for name, engine_cls in cls._engines.items():
            try:
                info = engine_cls().engine_info
            except Exception:
                info = {"name": name, "version": "unknown", "scenes": []}
            result.append(info)
        return result

    @classmethod
    def clear(cls) -> None:
        """Remove all registrations (for testing)."""
        cls._engines.clear()
