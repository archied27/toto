import json
import logging
import os
import re

import dotenv
from llama_cpp import Llama
from openai import AsyncOpenAI, OpenAI

from app.schemas.base_command import BaseCommand, IntentSpec

logger = logging.getLogger(__name__)

dotenv.load_dotenv()

# ---------------------------------------------------------------------------
# tool calling – generate OpenAI tool definitions from read intents
# ---------------------------------------------------------------------------

TOOL_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

# system prompt used when the general LLM can call read intents as tools
TOOL_SYSTEM_PROMPT = (
    "You are Toto, a helpful personal assistant. You can call tools to fetch "
    "live data about the user's tasks, weather and web searches instead of guessing. "
    "If a tool is relevant to the question, call it and ground your answer in "
    "its result. If no tool is relevant, answer from general knowledge and say "
    "clearly if you don't know. "
    "If you use the web search, only use it a maximum of 2 times, DO NOT USE IT MORE THAN 2 TIMES. "
    "Provide short to medium length answers with little to no emojis. "
    "Your responses are rendered using GitHub Flavored Markdown and your HTML is rendered directly (when not in code blocks)"
    "in a React application. Use coloured text where necessary to highlight and signify your answers. "
    "Use Markdown and HTML only, use headings to organise your responses, "
    "starting with h2's. Do not use filler such as 'Certainly!'"
    "Finish your answer with a short summary of the sources you used, e.g. 'Sources: tool1, tool2' or 'Sources: none'."
)


def intent_to_tool(spec: IntentSpec) -> dict:
    """Convert an IntentSpec into an OpenAI function-tool definition."""
    if not TOOL_NAME_RE.match(spec.name):
        raise ValueError(f"Intent name {spec.name!r} is not a valid OpenAI tool name")
    parameters = spec.slots.model_json_schema() if spec.slots else {"type": "object", "properties": {}}
    return {
        "type": "function",
        "function": {
            "name": spec.name,
            "description": spec.description,
            "parameters": parameters,
        },
    }


def build_tools(plugins: list[BaseCommand], intent_types: tuple[str, ...] = ("read",)) -> list[dict]:
    """Tool definitions for every intent whose type is in *intent_types*."""
    return [
        intent_to_tool(spec)
        for p in plugins
        for spec in p.get_intents()
        if spec.type in intent_types
    ]


def build_tool_index(plugins: list[BaseCommand], intent_types: tuple[str, ...] = ("read",)) -> dict[str, tuple[BaseCommand, IntentSpec]]:
    """Map tool name → (plugin, spec) so a tool call can be executed."""
    return {
        spec.name: (p, spec)
        for p in plugins
        for spec in p.get_intents()
        if spec.type in intent_types
    }


def tool_status_text(spec: IntentSpec) -> str:
    """Short status line shown above the stream while a tool runs."""
    label = spec.command_name.strip()
    if not label:
        return "Working…"
    # Turn the leading verb of the command name into a natural status line:
    # "Show Today's Tasks" -> "Checking today's tasks…", "Search The Web" ->
    # "Searching the web…", "Add A New Task" -> "adding a new task…".
    verbs = {
        "show": "Checking",
        "search": "Searching",
        "add": "Adding",
        "get": "Checking",
    }
    first, _, rest = label.partition(" ")
    verb = verbs.get(first.lower(), "Checking")
    suffix = f" {rest.lower()}" if rest else ""
    return f"{verb}{suffix}…"


class Extractor:
    """
    local llm used for data extraction
    """
    def __init__(self, model_path: str, n_ctx: int = 1024):
        self.model = Llama(model_path=model_path, n_ctx=n_ctx)

    def extract(self, spec: IntentSpec, raw: str) -> dict:
        schema = spec.slots.model_json_schema()
        examples = "\n".join(f"- \"{ex}\"" for ex in spec.examples)

        system_prompt = (
            "You are a precise information extraction engine. You extract structured "
            "fields from a short user command and return ONLY a JSON object matching "
            "the given schema. \n\n"
            "Rules:\n"
            "1. Only extract information that is explicitly present in the text. Never invent, "
            "infer, or guess a value that isn't stated.\n"
            "2. If a field is optional and not present in the text, omit it or set it to null - "
            "do not make one up.\n"
            "3. Do not copy example values from the instructions below into your answer - they "
            "are only there to show you the pattern, not the current input.\n"
            "4. Return raw JSON only. No markdown, no code fences, no explanation."
        )

        user_prompt = (
            f"Intent: {spec.name}\n"
            f"Description: {spec.description}\n\n"
            f"Example utterances that trigger this intent (for context only, not for extraction):\n"
            f"{examples}\n\n"
            f"Now extract the fields from this text:\n"
            f"\"{raw}\""
        )

        if spec.slot_examples:
            worked = "\n\n".join(
                f"Text: \"{text}\"\nJSON: {json.dumps(expected)}"
                for text, expected in spec.slot_examples
            )
            user_prompt += f"\n\nWorked examples:\n{worked}"

        resp = self.model.create_chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object", "schema": schema},
            temperature=0,
            max_tokens=256,
        )

        content = resp["choices"][0]["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.error(f"Extractor returned invalid JSON for intent={spec.name}: {content!r}")
            raise

class GeneralLLM:
    """
    llm used for general purposes, via an OpenAI-compatible endpoint
    """
    def __init__(self, model: str = "toto"):
        self.async_client = AsyncOpenAI(
            base_url=os.getenv("OMNIROUTE_BASE_URL"),
            api_key=os.getenv("OMNIROUTE_API_KEY"),
        )
        self.client = OpenAI(
            base_url=os.getenv("OMNIROUTE_BASE_URL"),
            api_key=os.getenv("OMNIROUTE_API_KEY"),
        )
        self.model = model

    def chat(self, messages: list[dict], tools: list[dict] | None = None, temperature: float = 0.3):
        kwargs: dict = {"model": self.model, "messages": messages, "temperature": temperature}
        if tools:
            kwargs["tools"] = tools
        return self.client.chat.completions.create(**kwargs)

    async def chat_stream(self, messages: list[dict], tools: list[dict] | None = None, temperature: float = 0.3):
        kwargs: dict = {"model": self.model, "messages": messages, "temperature": temperature}
        if tools:
            kwargs["tools"] = tools
        stream = await self.async_client.chat.completions.create(**kwargs, stream=True)
        async for chunk in stream:
            yield chunk

    def ask(self, question: str, context: str | None = None) -> str:
        system_prompt = (
            "You are a helpful assistant answering questions grounded in the "
            "provided data. If context is given, answer only using that context - "
            "do not invent details. If no context is given, answer from general "
            "knowledge, and say clearly if you don't know."
            "Provide short to medium length answers."
            "Your response are rendered using GitHub Flavored Markdown in a React application"
            "Use Markdown only, use headings to organise your responses, starting with h2's"
            "Do not use filler such as 'Certainly!'"
        )

        user_content = question if not context else f"Context:\n{context}\n\nQuestion: {question}"

        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,
        )
        return resp.choices[0].message.content