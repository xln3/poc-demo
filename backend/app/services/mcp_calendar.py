"""
Calendar MCP Service
Provides tools for calendar operations: list events, create, update, delete.
Uses Google Calendar API format, but designed for generic calendar operations.
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# In-memory event storage for demo/mock mode
MOCK_EVENTS: Dict[str, List[Dict[str, Any]]] = {}


class CalendarService:
    """Service for calendar operations."""

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test calendar API connection."""
        api_type = config.get("type", "mock")

        if api_type == "mock":
            return {
                "success": True,
                "message": "Calendar service ready (mock mode)",
            }
        elif api_type == "google":
            return await self._test_google_connection(config)
        else:
            return {"success": False, "error": f"Unsupported calendar type: {api_type}"}

    async def _test_google_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test Google Calendar API connection."""
        access_token = config.get("accessToken")
        if not access_token:
            return {"success": False, "error": "Missing 'accessToken' configuration"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"maxResults": 1},
                    timeout=10.0,
                )

                if response.status_code == 200:
                    return {"success": True, "message": "Connected to Google Calendar"}
                elif response.status_code == 401:
                    return {"success": False, "error": "Invalid or expired access token"}
                else:
                    return {"success": False, "error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a calendar tool."""
        api_type = config.get("type", "mock")

        tool_handlers = {
            "calendar_list_events": self._list_events,
            "calendar_create_event": self._create_event,
            "calendar_update_event": self._update_event,
            "calendar_delete_event": self._delete_event,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(api_type, params, config)

    def _get_mock_calendar_id(self, config: Dict[str, Any]) -> str:
        """Get a unique calendar ID for mock storage."""
        return config.get("calendarId", "primary")

    async def _list_events(
        self, api_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List calendar events."""
        calendar_id = params.get("calendar_id", "primary")
        time_min = params.get("time_min")
        time_max = params.get("time_max")
        max_results = params.get("max_results", 50)

        if api_type == "mock":
            return self._list_events_mock(calendar_id, time_min, time_max, max_results)
        elif api_type == "google":
            return await self._list_events_google(config, calendar_id, time_min, time_max, max_results)
        else:
            return {"success": False, "error": f"Unsupported calendar type: {api_type}"}

    def _list_events_mock(
        self, calendar_id: str, time_min: Optional[str], time_max: Optional[str], max_results: int
    ) -> Dict[str, Any]:
        """List events from mock storage."""
        events = MOCK_EVENTS.get(calendar_id, [])

        # Filter by time range if specified
        filtered_events = []
        for event in events:
            start_time = event.get("start", {}).get("dateTime", "")
            if time_min and start_time < time_min:
                continue
            if time_max and start_time > time_max:
                continue
            filtered_events.append(event)

        # Sort by start time and limit
        filtered_events.sort(key=lambda e: e.get("start", {}).get("dateTime", ""))
        filtered_events = filtered_events[:max_results]

        return {
            "success": True,
            "result": {"calendar_id": calendar_id, "count": len(filtered_events), "events": filtered_events},
        }

    async def _list_events_google(
        self, config: Dict[str, Any], calendar_id: str, time_min: Optional[str], time_max: Optional[str], max_results: int
    ) -> Dict[str, Any]:
        """List events from Google Calendar."""
        access_token = config.get("accessToken")
        if not access_token:
            return {"success": False, "error": "Missing access token"}

        try:
            async with httpx.AsyncClient() as client:
                params = {"maxResults": min(max_results, 250), "singleEvents": "true", "orderBy": "startTime"}
                if time_min:
                    params["timeMin"] = time_min
                if time_max:
                    params["timeMax"] = time_max

                response = await client.get(
                    f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params=params,
                    timeout=15.0,
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"API error: {response.status_code}"}

                data = response.json()
                events = [
                    {
                        "id": e.get("id"),
                        "summary": e.get("summary"),
                        "start": e.get("start"),
                        "end": e.get("end"),
                        "location": e.get("location"),
                        "description": e.get("description"),
                        "attendees": [a.get("email") for a in e.get("attendees", [])],
                    }
                    for e in data.get("items", [])
                ]

                return {
                    "success": True,
                    "result": {"calendar_id": calendar_id, "count": len(events), "events": events},
                }
        except Exception as e:
            return {"success": False, "error": f"List events failed: {str(e)}"}

    async def _create_event(
        self, api_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a calendar event."""
        calendar_id = params.get("calendar_id", "primary")
        summary = params.get("summary")
        start = params.get("start")
        end = params.get("end")
        description = params.get("description", "")
        location = params.get("location", "")
        attendees = params.get("attendees", [])

        if not summary:
            return {"success": False, "error": "Missing 'summary' parameter"}
        if not start or not end:
            return {"success": False, "error": "Missing 'start' or 'end' parameter"}

        if api_type == "mock":
            return self._create_event_mock(calendar_id, summary, start, end, description, location, attendees)
        elif api_type == "google":
            return await self._create_event_google(config, calendar_id, summary, start, end, description, location, attendees)
        else:
            return {"success": False, "error": f"Unsupported calendar type: {api_type}"}

    def _create_event_mock(
        self, calendar_id: str, summary: str, start: Dict, end: Dict, description: str, location: str, attendees: List[str]
    ) -> Dict[str, Any]:
        """Create event in mock storage."""
        import uuid

        event_id = str(uuid.uuid4())[:8]

        event = {
            "id": event_id,
            "summary": summary,
            "start": start,
            "end": end,
            "description": description,
            "location": location,
            "attendees": [{"email": a} for a in attendees],
            "created": datetime.utcnow().isoformat() + "Z",
        }

        if calendar_id not in MOCK_EVENTS:
            MOCK_EVENTS[calendar_id] = []
        MOCK_EVENTS[calendar_id].append(event)

        return {"success": True, "result": {"id": event_id, "summary": summary, "created": True}}

    async def _create_event_google(
        self, config: Dict[str, Any], calendar_id: str, summary: str, start: Dict, end: Dict, description: str, location: str, attendees: List[str]
    ) -> Dict[str, Any]:
        """Create event in Google Calendar."""
        access_token = config.get("accessToken")
        if not access_token:
            return {"success": False, "error": "Missing access token"}

        try:
            async with httpx.AsyncClient() as client:
                body = {
                    "summary": summary,
                    "start": start,
                    "end": end,
                    "description": description,
                    "location": location,
                }
                if attendees:
                    body["attendees"] = [{"email": a} for a in attendees]

                response = await client.post(
                    f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                    timeout=15.0,
                )

                if response.status_code not in [200, 201]:
                    return {"success": False, "error": f"API error: {response.status_code}"}

                data = response.json()
                return {
                    "success": True,
                    "result": {
                        "id": data.get("id"),
                        "summary": data.get("summary"),
                        "htmlLink": data.get("htmlLink"),
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Create event failed: {str(e)}"}

    async def _update_event(
        self, api_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update a calendar event."""
        calendar_id = params.get("calendar_id", "primary")
        event_id = params.get("event_id")
        updates = params.get("updates", {})

        if not event_id:
            return {"success": False, "error": "Missing 'event_id' parameter"}

        if api_type == "mock":
            return self._update_event_mock(calendar_id, event_id, updates)
        elif api_type == "google":
            return await self._update_event_google(config, calendar_id, event_id, updates)
        else:
            return {"success": False, "error": f"Unsupported calendar type: {api_type}"}

    def _update_event_mock(
        self, calendar_id: str, event_id: str, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update event in mock storage."""
        events = MOCK_EVENTS.get(calendar_id, [])

        for event in events:
            if event.get("id") == event_id:
                event.update(updates)
                return {"success": True, "result": {"id": event_id, "updated": True}}

        return {"success": False, "error": f"Event not found: {event_id}"}

    async def _update_event_google(
        self, config: Dict[str, Any], calendar_id: str, event_id: str, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update event in Google Calendar."""
        access_token = config.get("accessToken")
        if not access_token:
            return {"success": False, "error": "Missing access token"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events/{event_id}",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    json=updates,
                    timeout=15.0,
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"API error: {response.status_code}"}

                data = response.json()
                return {"success": True, "result": {"id": data.get("id"), "updated": True}}
        except Exception as e:
            return {"success": False, "error": f"Update event failed: {str(e)}"}

    async def _delete_event(
        self, api_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Delete a calendar event."""
        calendar_id = params.get("calendar_id", "primary")
        event_id = params.get("event_id")

        if not event_id:
            return {"success": False, "error": "Missing 'event_id' parameter"}

        if api_type == "mock":
            return self._delete_event_mock(calendar_id, event_id)
        elif api_type == "google":
            return await self._delete_event_google(config, calendar_id, event_id)
        else:
            return {"success": False, "error": f"Unsupported calendar type: {api_type}"}

    def _delete_event_mock(self, calendar_id: str, event_id: str) -> Dict[str, Any]:
        """Delete event from mock storage."""
        events = MOCK_EVENTS.get(calendar_id, [])

        for i, event in enumerate(events):
            if event.get("id") == event_id:
                events.pop(i)
                return {"success": True, "result": {"id": event_id, "deleted": True}}

        return {"success": False, "error": f"Event not found: {event_id}"}

    async def _delete_event_google(
        self, config: Dict[str, Any], calendar_id: str, event_id: str
    ) -> Dict[str, Any]:
        """Delete event from Google Calendar."""
        access_token = config.get("accessToken")
        if not access_token:
            return {"success": False, "error": "Missing access token"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events/{event_id}",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10.0,
                )

                if response.status_code == 204:
                    return {"success": True, "result": {"id": event_id, "deleted": True}}
                elif response.status_code == 404:
                    return {"success": False, "error": f"Event not found: {event_id}"}
                else:
                    return {"success": False, "error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"Delete event failed: {str(e)}"}


# Global service instance
calendar_service = CalendarService()
