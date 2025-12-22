import json
import time
from loguru import logger
from app.db.chat_db import insert_chat_message
from app.rag.rag_logging import log_rag_interaction


class EventGenerator:
    """Class-based SSE event generator for RAG streaming."""
    
    def __init__(
        self,
        generator,
        query: str,
        session_id: str,
        top_k: int,
        provider: str,
        model: str,
        api_key,
        history,
        mongo_db,
        start_time: float,
        user_message_id: str,
        created_new_session: bool,
        response_id: str,
    ):
        self.generator = generator
        self.query = query
        self.session_id = session_id
        self.top_k = top_k
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.history = history
        self.mongo_db = mongo_db
        self.start_time = start_time
        self.user_message_id = user_message_id
        self.created_new_session = created_new_session
        self.response_id = response_id
        self.final_payload = None

    async def event_generator(self):
        """Async generator that wraps RAG streaming events into SSE format."""
        self.final_payload = None

        try:
            async for evt in self.generator.generate_response_stream(
                self.query,
                top_k=self.top_k,
                api_key=self.api_key,
                include_sources=True,
                history=self.history,
            ):
                etype = evt.get("type")

                if etype == "partial":
                    delta = evt.get("delta", "")
                    data = {"type": "partial", "delta": delta}
                    yield f"data: {json.dumps(data)}\n\n"

                elif etype == "error":
                    err = evt.get("error", "")
                    logger.error(f"Streaming error event: {err}")

                    self.final_payload = {
                        "response": "",
                        "sources": [],
                        "error": err,
                    }

                    data = {"type": "error", "error": err}
                    yield f"data: {json.dumps(data)}\n\n"
                    break

                elif etype == "final":
                    self.final_payload = evt.get("response") or {}
                    self.final_payload.setdefault("sources", [])
                    self.final_payload["responseId"] = self.response_id
                    if self.created_new_session:
                        self.final_payload["session_id"] = self.session_id
                    yield (
                        f"data: {json.dumps({'type': 'final', 'payload': self.final_payload})}\n\n"
                    )
                    break

                else:
                    logger.warning(f"UNKNOWN EVENT TYPE: {evt!r}")
                    yield f"data: {json.dumps(evt)}\n\n"

        except Exception as e:
            logger.exception(f"Exception during streaming: {e}")
            err = str(e)
            self.final_payload = {
                "response": "",
                "sources": [],
                "error": err,
            }
            yield f"data: {json.dumps({'type': 'error', 'error': err})}\n\n"

        finally:
            if self.final_payload is None:
                # when Streaming ended without reaching final or error event.
                self.final_payload = {
                    "response": "",
                    "sources": [],
                    "error": "stream_ended_early",
                }
                
    async def _handle_post_streaming(self):
        """Handle DB operations after streaming completes."""
        try:
            if not self.final_payload:
                return
            assistant_content = self.final_payload.get("response", "")
            message_id = await insert_chat_message(
                {
                    "sessionId": self.session_id,
                    "role": "assistant",
                    "content": assistant_content,
                    "responseId": self.response_id,
                },
                mongo_db=self.mongo_db,
            )
            
            sources = self.final_payload.get("sources", []) or []
            contexts = [str(s.get("text", "")) for s in sources]
            execution_time = time.time() - self.start_time
            await log_rag_interaction(
                {
                    "question": self.query,
                    "answer": assistant_content,
                    "contexts": contexts,
                    "metadata": {
                        "session_id": self.session_id,
                        "provider": self.provider,
                        "model": self.model if self.model else "system",
                        "response_id": self.response_id,
                        "execution_time_seconds": execution_time,
                    },
                },
                mongo_db=self.mongo_db,
            )

            # Enrich final payload with session and message IDs for the client
            self.final_payload.setdefault("session_id", self.session_id)
            self.final_payload["userMessageId"] = self.user_message_id
            self.final_payload["messageId"] = message_id

        except Exception as db_exc:
            logger.exception(
                f"Failed to insert assistant message after streaming: {db_exc}"
            )
