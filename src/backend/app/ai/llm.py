from llama_cpp import Llama
from app.schemas.base_command import IntentSpec
import json
import logging
import os
import dotenv
from groq import Groq

logger = logging.getLogger(__name__)

dotenv.load_dotenv()

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
    groq llm used for general purposes
    """
    def __init__(self, model: str = "llama-3.3-70b-versatile"):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = model

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