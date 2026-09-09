"""
device-agent coordination for Toto.

This module enables the LLM to call tools hosted on external devices (laptop,
phone, ESP32, etc.) that connect to the backend over a WebSocket. Devices
dial out to the backend (NAT/mobile friendly); the backend never initiates.

The registry tracks connected devices and their declared capabilities, merges
device capabilities into the LLM tool list with a `device__{device_id}__{action}`
prefix, and routes dispatches to the correct websocket.

Round-trip example:

    # 1. Device connects and registers
    registry = AgentRegistry()
    await registry.register("laptop", websocket, [
        DeviceCapability(name="screenshot", description="Take a screenshot", parameters={}),
        DeviceCapability(name="list_files", description="List files in a directory",
                         parameters={"type": "object", "properties": {"path": {"type": "string"}}},
                         write=True),
    ])

    # 2. LLM sees tools: device__laptop__screenshot, device__laptop__list_files
    tools = registry.build_tools()

    # 3. LLM calls a device tool
    async def dispatch_and_wait():
        # This runs in the LLM loop
        task = asyncio.create_task(registry.dispatch("laptop", "screenshot", {}))

        # 4. Device sends back result (in its receive loop)
        #    websocket receives: {"request_id": "abc123", "result": {"image": "base64..."}}
        registry.resolve_result("abc123", {"image": "base64..."})

        # 5. dispatch() returns the result
        result = await task
        print(result)  # {"image": "base64..."}

    # 6. Device disconnects
    await registry.unregister("laptop")

    # 7. Any pending dispatches are failed with DeviceDisconnectedError
"""

from __future__ import annotations

import asyncio
import logging
import re
import secrets
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import WebSocket
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Reuse the same tool name validation from llm.py
TOOL_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class AgentError(Exception):
    """Base exception for agent-registry errors."""

    pass


class DeviceNotConnectedError(AgentError):
    """Raised when dispatching to a device that is not connected."""

    def __init__(self, device_id: str):
        self.device_id = device_id
        super().__init__(f"Device '{device_id}' is not connected")


class DeviceTimeoutError(AgentError):
    """Raised when a device does not respond within the timeout."""

    def __init__(self, device_id: str):
        self.device_id = device_id
        super().__init__(f"Device '{device_id}' did not respond in time")


class DeviceDisconnectedError(AgentError):
    """Raised when a device disconnects during a dispatch."""

    def __init__(self, device_id: str):
        self.device_id = device_id
        super().__init__(f"Device '{device_id}' disconnected during dispatch")


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


class DeviceCapability(BaseModel):
    """
    A capability exposed by a connected device.

    Attributes:
        name: The action name (e.g., "screenshot", "list_files").
        description: Human-readable description shown to the LLM.
        parameters: OpenAI-style JSON schema for the action's parameters.
        write: If True, the LLM must get user confirmation before dispatching.
    """

    name: str
    description: str
    parameters: dict = Field(default_factory=dict)
    write: bool = False
    icon: Optional[str] = None  # Lucide icon name
    group: Optional[str] = None  # Grouping for UI display


class ConnectedDevice(BaseModel):
    """
    A device currently connected to the backend.

    Attributes:
        device_id: Unique identifier for the device.
        websocket: The FastAPI WebSocket connection (excluded from serialization).
        display_name: The user-friendly name for the device.
        icon: Lucide icon name for the device (optional).
        capabilities: List of capabilities this device exposes.
        connected_at: Timestamp when the device connected.
    """

    device_id: str
    websocket: Any = Field(exclude=True)
    display_name: Optional[str] = None
    icon: Optional[str] = None
    capabilities: list[DeviceCapability] = Field(default_factory=list)
    connected_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# AgentRegistry
# ---------------------------------------------------------------------------


class AgentRegistry:
    """
    Tracks connected devices and routes dispatches to them.

    This class is dependency-injected (created once in lifespan, passed to
    the websocket endpoint and the CommandRouter). No module-level singleton.

    Concurrency note: all state mutation is synchronous (no await between
    check-and-set), single-threaded asyncio. A plain dict is sufficient; no
    lock is required.
    """

    def __init__(self):
        self._devices: dict[str, ConnectedDevice] = {}
        self._pending: dict[str, tuple[str, asyncio.Future]] = {}
        # request_id -> (device_id, future)

    # -----------------------------------------------------------------------
    # Registration
    # -----------------------------------------------------------------------

    def register(
        self,
        device_id: str,
        websocket: WebSocket,
        display_name: Optional[str],
        icon: Optional[str],
        capabilities: list[DeviceCapability],
    ) -> None:
        """
        Register a connected device.

        If a device with the same device_id already exists, fail all its
        pending futures with DeviceDisconnectedError (stale socket cleanup),
        then replace it with the new connection.
        """
        existing = self._devices.get(device_id)
        if existing is not None:
            # Fail pending futures from the old connection
            self._fail_pending_futures(device_id, DeviceDisconnectedError(device_id))
            logger.info(
                "Device '%s' reconnected; replaced old connection", device_id
            )

        device = ConnectedDevice(
            device_id=device_id,
            websocket=websocket,
            display_name=display_name,
            icon=icon,
            capabilities=capabilities,
            connected_at=datetime.utcnow(),
        )
        self._devices[device_id] = device
        logger.info(
            "Device '%s' registered with %d capabilities",
            device_id,
            len(capabilities),
        )

    def unregister(self, device_id: str, websocket: Optional[WebSocket] = None) -> None:
        """
        Unregister a device.

        Fails all pending futures for this device with DeviceDisconnectedError.

        The optional `websocket` parameter guards against the stale-socket case:
        if a device reconnects before the old receive loop's finally block runs,
        the old loop's unregister call will pass the old websocket. If the
        stored entry's websocket differs, this is a no-op (the new connection
        should not be dropped by a stale cleanup).
        """
        device = self._devices.get(device_id)
        if device is None:
            return

        # Stale-socket guard: only unregister if the websocket matches
        if websocket is not None and device.websocket is not websocket:
            logger.debug(
                "Skipping unregister for '%s': websocket mismatch (stale cleanup)",
                device_id,
            )
            return

        self._devices.pop(device_id, None)
        self._fail_pending_futures(device_id, DeviceDisconnectedError(device_id))
        logger.info("Device '%s' unregistered", device_id)

    def _fail_pending_futures(self, device_id: str, error: Exception) -> None:
        """Fail all pending futures owned by a device."""
        to_remove = [
            request_id
            for request_id, (owner_device_id, _) in self._pending.items()
            if owner_device_id == device_id
        ]
        for request_id in to_remove:
            _, future = self._pending.pop(request_id)
            if not future.done():
                future.set_exception(error)
            logger.debug(
                "Failed pending request %s for device '%s'", request_id, device_id
            )

    # -----------------------------------------------------------------------
    # Queries
    # -----------------------------------------------------------------------

    def is_connected(self, device_id: str) -> bool:
        """Check if a device is currently connected."""
        return device_id in self._devices

    def list_connected(self) -> list[str]:
        """List all connected device IDs."""
        return list(self._devices.keys())

    def get_capability(
        self, device_id: str, action: str
    ) -> Optional[DeviceCapability]:
        """
        Look up a specific capability on a device.

        Used by the CommandRouter write-gate to check if a device tool
        requires user confirmation.
        """
        device = self._devices.get(device_id)
        if device is None:
            return None
        for cap in device.capabilities:
            if cap.name == action:
                return cap
        return None

    # -----------------------------------------------------------------------
    # Dispatch
    # -----------------------------------------------------------------------

    async def dispatch(
        self,
        device_id: str,
        action: str,
        payload: dict,
        timeout: float = 10.0,
    ) -> dict:
        """
        Dispatch an action to a connected device and wait for the result.

        Args:
            device_id: The device to dispatch to.
            action: The capability/action name to invoke.
            payload: Arguments for the action.
            timeout: Maximum time to wait for a response (seconds).

        Returns:
            The result dict from the device.

        Raises:
            DeviceNotConnectedError: Device is not connected.
            DeviceTimeoutError: Device did not respond in time.
            DeviceDisconnectedError: Device disconnected during dispatch.
        """
        device = self._devices.get(device_id)
        if device is None:
            raise DeviceNotConnectedError(device_id)

        request_id = uuid.uuid4().hex
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[request_id] = (device_id, future)

        try:
            # Send the request
            message = {
                "request_id": request_id,
                "action": action,
                "payload": payload,
            }
            try:
                await device.websocket.send_json(message)
            except Exception as e:
                # Socket died mid-flight
                logger.error(
                    "Failed to send to device '%s': %s", device_id, e
                )
                raise DeviceDisconnectedError(device_id) from e

            # Wait for the result
            try:
                result = await asyncio.wait_for(future, timeout)
                return result
            except asyncio.TimeoutError:
                logger.warning(
                    "Timeout waiting for device '%s' (request_id=%s)",
                    device_id,
                    request_id,
                )
                raise DeviceTimeoutError(device_id)

        finally:
            # Always clean up pending entry
            self._pending.pop(request_id, None)

    def resolve_result(self, request_id: str, result: dict) -> None:
        """
        Resolve a pending dispatch with a result from the device.

        Called when the device sends back a response with a request_id.
        No-op if the request_id is unknown (already timed out / consumed).
        """
        entry = self._pending.get(request_id)
        if entry is None:
            # Already timed out or consumed
            logger.debug(
                "Ignoring result for unknown request_id=%s", request_id
            )
            return

        device_id, future = entry
        if not future.done():
            future.set_result(result)
            logger.debug(
                "Resolved request %s for device '%s'", request_id, device_id
            )
        else:
            logger.debug(
                "Request %s already done (cancelled/timed out)", request_id
            )

    # -----------------------------------------------------------------------
    # Tool building
    # -----------------------------------------------------------------------

    def build_tools(self) -> list[dict]:
        """
        Build OpenAI tool definitions for all connected devices.

        This is called on every LLM request so device churn is reflected
        without rebuilding the expensive plugin classifier.

        Tool names are prefixed: device__{device_id}__{action}
        Invalid tool names (per TOOL_NAME_RE) are skipped with a warning.
        """
        tools = []
        for device_id, device in self._devices.items():
            for cap in device.capabilities:
                # Build the prefixed tool name
                tool_name = f"device__{device_id}__{cap.name}"

                # Validate tool name
                if not TOOL_NAME_RE.match(tool_name):
                    logger.warning(
                        "Skipping invalid tool name '%s' from device '%s'",
                        tool_name,
                        device_id,
                    )
                    continue

                tool = {
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "description": f"[{device_id}] {cap.description}",
                        "parameters": cap.parameters,
                    },
                }
                tools.append(tool)

        return tools


# ---------------------------------------------------------------------------
# WebSocket protocol handler
# ---------------------------------------------------------------------------


async def handle_agent_connection(
    websocket: WebSocket,
    agent_registry: AgentRegistry,
    shared_secret: str,
) -> None:
    """
    Handle a device agent WebSocket connection.

    Protocol:
    1. Device sends first message: {"type": "register", "device": "...",
       "token": "...", "capabilities": [...]}
    2. Token is validated against shared_secret (fail closed if empty).
    3. On success, device is registered and the loop processes incoming
       messages with request_id + result to resolve pending dispatches.
    4. On disconnect or error, device is unregistered in finally block.

    Close codes:
        4000: Invalid registration message
        4001: Invalid or missing token
    """
    device_id: Optional[str] = None

    try:
        # Read first message (registration)
        try:
            msg = await websocket.receive_json()
        except Exception:
            await websocket.close(code=4000)
            return

        # Validate registration message
        if (
            not isinstance(msg, dict)
            or msg.get("type") != "register"
            or "device" not in msg
            or "token" not in msg
        ):
            await websocket.close(code=4000)
            return

        device_id = msg.get("device")
        token = msg.get("token", "")
        capabilities_data = msg.get("capabilities", [])

        # Validate token (fail closed)
        if not shared_secret or not secrets.compare_digest(token, shared_secret):
            logger.warning(
                "Rejected connection from device '%s': invalid token", device_id
            )
            await websocket.close(code=4001)
            return

        # Parse capabilities
        capabilities = []
        for cap_data in capabilities_data:
            try:
                cap = DeviceCapability(**cap_data)
                capabilities.append(cap)
            except Exception as e:
                logger.warning(
                    "Skipping invalid capability from device '%s': %s",
                    device_id,
                    e,
                )

        # Register the device
        agent_registry.register(device_id, websocket, capabilities)

        # Main receive loop
        while True:
            try:
                msg = await websocket.receive_json()
            except Exception:
                # Malformed JSON or disconnect
                break

            # Resolve pending dispatches
            if isinstance(msg, dict) and "request_id" in msg and "result" in msg:
                agent_registry.resolve_result(msg["request_id"], msg["result"])
            # Other messages are ignored

    except Exception as e:
        logger.error("Error in agent connection: %s", e)

    finally:
        # Always unregister on disconnect or error
        if device_id is not None:
            agent_registry.unregister(device_id, websocket)
