"""
handles parsing commands from command bar
"""
import asyncio
from typing import Optional

from app.ai.intent_classsifier import IntentSimilarityModel
from app.schemas.base_command import BaseCommand, MatchResult, CommandResult
from app.ai.llm import Extractor, GeneralLLM


class CommandRouter:
    def __init__(self, intent_classifier: IntentSimilarityModel, llm_extractor: Extractor, groq_llm: GeneralLLM, classifier_confidence_threshold: float = 0.7):
        self.plugins: list[BaseCommand] = []
        self.classifier = intent_classifier
        self.llm_extractor = llm_extractor
        self.groq_llm = groq_llm
        self.confidence_threshold = classifier_confidence_threshold
        self._built = False

    def register_plugin(self, plugin: BaseCommand) -> None:
        if not isinstance(plugin, BaseCommand):
            print(f"Plugin {plugin} is not a subclass of BaseCommand")
            return
        self.plugins.append(plugin)
        self._built = False

    def _ensure_built(self):
        if not self._built:
            self.classifier.build(self.plugins)
            self._built = True

    async def process(self, raw: str) -> CommandResult:
        """
        takes in raw command string, called by api
        """
        if not raw or not raw.strip():
            return CommandResult(success=False, action='EMPTY', response_text="Nothing to process", data={})

        raw = raw.strip()
        self._ensure_built()

        match = await self.classifier.classify(raw)

        if not match:
            return CommandResult(success=False, action='NO_MATCH', response_text="No matching command found", data={})

        if match.confidence < self.confidence_threshold:
            if match.confidence >= 0.5:
                # don't extract slots yet - just ask the user to confirm the intent.
                # send back everything needed to resume without re-classifying.
                return CommandResult(
                    success=True,
                    action='NEEDS_CONFIRMATION',
                    response_text=f"{match.intent_name}?",
                    data={
                        "intent": match.intent,
                        "plugin": match.plugin,
                        "confidence": match.confidence,
                        "raw": raw,
                    }
                )
            else:
                # fall through to llm general response
                try:
                    answer = await asyncio.to_thread(self.groq_llm.ask, raw)
                    return CommandResult(
                        success=True,
                        action='LLM_RESPONSE',
                        response_text=answer,
                        data={},
                    )
                except Exception as e:
                    return CommandResult(
                        success=False,
                        action='LLM_ERROR',
                        response_text=f"Error in LLM response: {str(e)}",
                        data={},
                    )

        plugin = self._get_plugin(match.plugin)
        if not plugin:
            return CommandResult(success=False, action='PLUGIN_NOT_FOUND', response_text=f"Plugin {match.plugin} not found", data={})

        return await self._run_intent(plugin, match.intent, raw)

    async def confirm(self, intent: str, plugin_name: str, raw: str) -> CommandResult:
        """
        resumes processing after the user confirms a NEEDS_CONFIRMATION prompt.
        skips classification entirely - the frontend just echoes back what
        process() sent it in `data` (intent, plugin, raw).
        """
        plugin = self._get_plugin(plugin_name)
        if not plugin:
            return CommandResult(success=False, action='PLUGIN_NOT_FOUND', response_text=f"Plugin {plugin_name} not found", data={})

        # guard against a confirm() call for an intent this plugin doesn't
        # actually own (defensive - shouldn't happen if frontend just echoes data back)
        if not plugin.get_intent(intent):
            return CommandResult(success=False, action='INTENT_NOT_FOUND', response_text=f"Intent {intent} not found on {plugin_name}", data={})

        return await self._run_intent(plugin, intent, raw)

    async def _run_intent(self, plugin: BaseCommand, intent: str, raw: str) -> CommandResult:
        """
        shared path: extract slots (if needed) then hand off to the plugin.
        used by both process() (high-confidence match) and confirm() (post-confirmation).
        """
        try:
            extracted = await self._extract_slots(plugin, intent, raw)
        except Exception as e:
            return CommandResult(success=False, action='EXTRACTION_ERROR', response_text=f"Error extracting slots: {str(e)}", data={})

        try:
            return await plugin.handle(intent, extracted, raw)
        except Exception as e:
            return CommandResult(success=False, action='PLUGIN_ERROR', response_text=f"Error in plugin {plugin.name}: {str(e)}", data={})

    async def _extract_slots(self, plugin: BaseCommand, intent: str, raw: str) -> dict:
        spec = plugin.get_intent(intent)
        if not spec or not spec.slots:
            return {}
        extracted = await asyncio.to_thread(self.llm_extractor.extract, spec, raw)
        return extracted

    def _get_plugin(self, name: str) -> Optional[BaseCommand]:
        for plugin in self.plugins:
            try:
                if plugin.name == name:
                    return plugin
            except AttributeError:
                continue
        return None


router = CommandRouter(
    intent_classifier=IntentSimilarityModel(),
    llm_extractor=Extractor(model_path="app/ai/models/qwen2.5-1.5b-instruct-q4_k_m.gguf"),
    groq_llm=GeneralLLM(model="openai/gpt-oss-120b"),
)