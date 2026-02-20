"""Abstract base class for simulation environments."""

import uuid
from abc import ABC, abstractmethod
from typing import Optional


class SimulatorBase(ABC):
    """
    Base interface for pluggable simulation engines.

    Each implementation runs inside a Docker container
    and communicates via this abstract interface.
    """

    def generate_session_id(self) -> str:
        return f"sim-{self.engine_name}-{uuid.uuid4().hex[:8]}"

    @abstractmethod
    async def start(self, config: dict) -> str:
        """Start simulation environment. Returns session_id."""

    async def start_with_progress(self, config: dict, session_id: str,
                                  status_dict: dict) -> str:
        """Start with progress reporting. Default falls back to start()."""
        return await self.start(config)

    @abstractmethod
    async def step(self, session_id: str, action: dict) -> dict:
        """Execute one action step. Returns {observation, reward, done, info}."""

    @abstractmethod
    async def render(self, session_id: str) -> bytes:
        """Get current frame as JPEG bytes."""

    @abstractmethod
    async def stop(self, session_id: str) -> None:
        """Stop and cleanup simulation."""

    @abstractmethod
    async def get_action_space(self) -> dict:
        """Return description of available actions."""

    @property
    @abstractmethod
    def engine_name(self) -> str:
        """Human-readable engine name."""

    @property
    def engine_info(self) -> dict:
        """Extended engine metadata."""
        return {
            "name": self.engine_name,
            "version": "0.1.0",
            "scenes": [],
        }
