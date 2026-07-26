from llama_cpp import Llama
from app.schemas.base_command import IntentSpec
import json
import logging

logger = logging.getLogger(__name__)


class Extractor:
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